import { Lead } from './schemas';
import { Step } from '@mastra/core/workflows';
import { createClient } from '@/utils/supabase/client-compat';
import { firecrawlTool } from '@/tools/firecrawl';
import { enrichLeadData, calculateLeadScore } from '@/agents/enrichmentAgent';
import { z } from 'zod';

/**
 * Helper function to normalize and validate URLs
 */
function normalizeUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  
  // Remove whitespace
  url = url.trim();
  
  // Add protocol if missing
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  try {
    // Validate the URL
    new URL(url);
    return url;
  } catch (error) {
    console.warn(`Invalid URL found: ${url}`);
    return null;
  }
}

/**
 * Step to fetch leads from the database
 */
export const fetchLeadsStep = new Step({
  id: 'fetch-leads',
  description: 'Fetch leads from the database',
  execute: async (context) => {
    // Access triggerData safely with TypeScript workaround for linter error
    const leadIds = (context as any).triggerData?.leadIds || [];
    
    if (leadIds.length === 0) {
      throw new Error('No lead IDs provided');
    }
    
    console.log(`Fetching ${leadIds.length} leads from the database`);
    
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('saved_leads')
      .select('*')
      .in('id', leadIds);

    if (error) {
      throw new Error(`Error fetching leads: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error('No leads found with the provided IDs');
    }
    
    // Log and debug the leads that were fetched
    data.forEach((lead: Lead) => {
      console.log(`Fetched lead: ${lead.name} (${lead.id}), Website URL: ${lead.website_url || 'None'}, Enrichment Website: ${lead.enrichment_data?.website || 'None'}`);
    });
    
    return { leads: data };
  }
});

/**
 * Step to extract website data for leads
 */
export const extractWebsiteDataStep = new Step({
  id: 'extract-website-data',
  description: 'Extract data from lead websites',
  execute: async (context) => {
    // @ts-ignore - getStepResult is used in the existing code but not properly typed
    const { leads } = context.getStepResult('fetch-leads') || { leads: [] };
    
    const extractionResults = await Promise.all(
      leads.map(async (lead: Lead) => {
        // Check if this lead already has enough data to skip extraction
        // If we have complete/sufficient data, we can skip the website extraction to save time and resources
        const hasEssentialData = lead.enrichment_data && 
                                 lead.enrichment_data.aiOverview && 
                                 lead.enrichment_data.venueCapacity &&
                                 lead.enrichment_data.commonEventTypes;
        
        if (hasEssentialData) {
          console.log(`Lead ${lead.id} (${lead.name}) - Already has essential data, skipping extraction`);
          return {
            leadId: lead.id,
            success: true,
            websiteData: { message: "Skipped extraction - using existing data" },
            skippedExtraction: true,
            lead
          };
        }
        
        // Check for website URL in both primary location and enrichment data
        let websiteUrl = lead.website_url;
        
        // Try to get website from enrichment data if not in primary field
        if (!websiteUrl && lead.enrichment_data?.website) {
          websiteUrl = lead.enrichment_data.website;
        }
        
        // Log the URL status before normalization
        console.log(`Lead ${lead.id} (${lead.name}) - Raw URL: ${websiteUrl || 'None'}`);
        
        // Normalize and validate URL
        const normalizedUrl = normalizeUrl(websiteUrl);
        websiteUrl = normalizedUrl !== null ? normalizedUrl : undefined;
        
        // Log the URL status after normalization
        console.log(`Lead ${lead.id} (${lead.name}) - Normalized URL: ${websiteUrl || 'None'}`);
        
        if (!websiteUrl) {
          return {
            leadId: lead.id,
            success: false,
            error: 'No valid website URL available',
            lead
          };
        }
        
        try {
          console.log(`[FIRECRAWL] Environment check - API key length: ${process.env.FIRECRAWL_API_KEY?.length}`);
          
          const startTime = Date.now();
          
          // Use the updated approach with wildcards and schema for better extraction
          try {
            console.log(`[FIRECRAWL] Using improved extraction with schema for: ${websiteUrl}`);
            
            // Add wildcard to crawl the entire site for better results
            const urlWithWildcard = websiteUrl.endsWith('/') ? `${websiteUrl}*` : `${websiteUrl}/*`;
            console.log(`[FIRECRAWL] Using wildcard URL pattern: ${urlWithWildcard}`);
            
            // Define a proper schema for venue extraction
            const extractSchema = {
              type: "object",
              properties: {
                venueName: { type: "string", description: "Name of the venue" },
                physicalAddress: { type: "string", description: "Complete physical address of the venue including street, city, state and zip code" },
                contactInformation: {
                  type: "object",
                  properties: {
                    phone: { type: "string", description: "Main contact phone number for the venue" },
                    email: { type: "string", description: "IMPORTANT: Main contact email address for the venue - search thoroughly in contact forms and pages" },
                    contactPersonName: { type: "string", description: "Name of the main contact person" }
                  },
                  required: ["email", "phone"]
                },
                managementContact: {
                  type: "object",
                  properties: {
                    managementContactName: { type: "string", description: "Name of the venue/event manager" },
                    managementContactEmail: { type: "string", description: "CRITICAL: Email of the venue/event manager - search extensively in all pages and forms" },
                    managementContactPhone: { type: "string", description: "Phone number of the venue/event manager" }
                  },
                  required: ["managementContactEmail"]
                },
                eventTypes: { 
                  type: "array", 
                  items: { type: "string" },
                  description: "Types of events hosted at the venue (weddings, corporate, etc.)" 
                },
                venueCapacity: { type: "string", description: "The capacity/maximum occupancy of the venue" },
                inHouseCatering: { type: "boolean", description: "Whether the venue offers in-house catering" },
                amenities: { 
                  type: "array", 
                  items: { type: "string" },
                  description: "List of amenities offered by the venue" 
                },
                preferredCaterers: { 
                  type: "array", 
                  items: { type: "string" },
                  description: "List of preferred caterers if any" 
                },
                pricingInformation: { type: "string", description: "Pricing information for the venue" },
                description: { type: "string", description: "A brief description of the venue" },
                eventDetails: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      eventName: { type: "string" },
                      eventDate: { type: "string" }
                    }
                  },
                  description: "Details of recent or upcoming events at the venue"
                }
              },
              required: ["contactInformation"]
            };

            const extractPrompt = `
            Extract comprehensive venue information from this website, formatted exactly according to the provided schema.
            
            *** MOST CRITICAL REQUIREMENT: Find at least one valid email address for contacting the venue. ***
            
            Specifically look for and extract:
            1. The venue name and complete physical address
            2. All contact information including phone, email, and contact person details
            3. Types of events hosted (be specific: weddings, corporate events, etc.)
            4. Venue capacity numbers
            5. Whether they offer in-house catering (true/false)
            6. Complete list of amenities offered
            7. List of preferred caterers (if mentioned)
            8. Any pricing information available
            9. A concise description of the venue
            
            EMAIL EXTRACTION INSTRUCTIONS (HIGHEST PRIORITY):
            - Search thoroughly for ANY email addresses on the site, especially in:
              * "Contact Us" pages
              * Staff/Team directories
              * Footer sections
              * Inquiry/booking forms (examine form fields and surrounding text)
              * Event planning or rental information pages
              * PDF brochures or documents linked from the site
            - Look for text patterns like "Email:", "Contact:", or email addresses directly
            - Check for JavaScript-based email protection and decode if needed
            - If an email is displayed as an image, note this in your response
            - Check both general contact emails and specific staff emails
            
            IMPORTANT: If you find multiple emails, prioritize ones for:
            1. Event managers/coordinators
            2. Sales/booking contacts
            3. General inquiries
            
            If in-house catering is mentioned anywhere, mark it as true. 
            If preferred or exclusive caterers are listed, capture all of them accurately.
            
            If you can't find specific information for a field, leave it empty rather than guessing.
            `;
            
            // Make direct API call for extraction
            const extractResponse = await fetch('https://api.firecrawl.dev/extract', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`
              },
              body: JSON.stringify({ 
                urls: [urlWithWildcard],
                prompt: extractPrompt,
                schema: extractSchema,
                enableWebSearch: true
              })
            });
            
            // Check response
            const responseData = await extractResponse.json();
            console.log(`[FIRECRAWL] Extract API response status: ${extractResponse.status}`);
            
            // Handle different response formats
            let extractionResult: { success: boolean; data: any; error: string | null; url?: string } = { 
              success: false, 
              data: null, 
              error: 'Unknown error' 
            };
            
            if (responseData.success === true && responseData.data) {
              // Direct success response
              extractionResult = { 
                success: true, 
                data: responseData.data,
                error: null,
                url: websiteUrl
              };
              console.log(`[FIRECRAWL] Extraction successful with direct response`);
            } else if (responseData.status === "processing" || responseData.job_id) {
              // Async job - poll for results
              const jobId = responseData.job_id;
              console.log(`[FIRECRAWL] Got job ID for polling: ${jobId}`);
              
              // Poll for results
              if (process.env.FIRECRAWL_API_KEY) {
                extractionResult = await pollForResults(jobId, process.env.FIRECRAWL_API_KEY);
              } else {
                console.error('[FIRECRAWL] API key not available for polling');
                extractionResult = {
                  success: false,
                  data: null,
                  error: 'API key not available for polling'
                };
              }
            } else {
              console.log(`[FIRECRAWL] Unexpected response format, trying to handle anyway`);
              extractionResult = { 
                success: responseData.success || false, 
                data: responseData.data || responseData,
                error: responseData.error || 'Unexpected response format',
                url: websiteUrl
              };
            }
            
            console.log(`[FIRECRAWL] Final extraction result status for ${lead.name}: ${extractionResult.success ? 'Success' : 'Failed'}`);
            const extractionTime = (Date.now() - startTime) / 1000;
            console.log(`[FIRECRAWL] Lead ${lead.id} - Website content extraction completed in ${extractionTime.toFixed(2)}s`);
            
            return {
              leadId: lead.id,
              websiteData: extractionResult.data,
              rawData: extractionResult.data,
              success: extractionResult.success,
              error: extractionResult.error,
              lead
            };
          } catch (schemaError) {
            console.log(`[FIRECRAWL] Schema-based extraction failed, falling back to normal extraction`);
            console.error(`[FIRECRAWL] Schema extraction error:`, schemaError);
            
            // Fall back to the original extraction method
            const extractionResult = await firecrawlTool.extract({
              urls: [websiteUrl],
              waitTime: 8000,
              enableWebSearch: false,
              includeHtml: true,
              extractMetadata: true,
              waitUntil: 'networkidle0',
              formats: ['text', 'markdown']
            });
            
            return {
              leadId: lead.id,
              websiteData: extractionResult.data,
              rawData: extractionResult.data,
              success: extractionResult.success,
              error: extractionResult.error,
              lead
            };
          }
        } catch (error) {
          console.error(`Error extracting data for lead ${lead.id}:`, error);
          return {
            leadId: lead.id,
            success: false,
            error: error instanceof Error ? error.message : String(error),
            lead
          };
        }
      })
    );
    
    // Summarize extraction results
    const successCount = extractionResults.filter((r: any) => r.success).length;
    const skippedCount = extractionResults.filter((r: any) => r.skippedExtraction).length;
    const failCount = extractionResults.filter((r: any) => !r.success).length;
    console.log(`Extraction completed - Success: ${successCount} (${skippedCount} skipped), Failed: ${failCount}, Total: ${extractionResults.length}`);
    
    return { extractionResults };
  }
});

/**
 * Step to process the extracted data
 */
export const processDataStep = new Step({
  id: 'process-data',
  description: 'Process extracted website data',
  execute: async (context) => {
    // @ts-ignore - getStepResult is used in the existing code but not properly typed
    const { extractionResults } = context.getStepResult('extract-website-data') || { extractionResults: [] };
    
    const processedResults = await Promise.all(extractionResults.map(async (result: any) => {
      // If extraction was skipped, we can use the existing enrichment data
      if (result.skippedExtraction && result.lead.enrichment_data) {
        console.log(`Lead ${result.leadId} - Using existing enrichment data (extraction was skipped)`);
        return {
          leadId: result.leadId,
          success: true,
          enrichmentData: result.lead.enrichment_data,
          lead: result.lead,
          preservedData: true
        };
      }
      
      // If extraction was successful, enrich the lead data
      if (result.success) {
        try {
          // First check if we have direct HTML/text content
          let websiteContent = '';
          
          if (typeof result.websiteData === 'string') {
            // If it's already a string, use it directly
            websiteContent = result.websiteData;
          } else if (result.rawData) {
            // If we have raw data, try to extract content in various formats
            const rawData = result.rawData;
            
            if (rawData.content && typeof rawData.content === 'string') {
              websiteContent = rawData.content;
            } else if (rawData.text) {
              // Direct text property from v1 API
              websiteContent = rawData.text;
            } else if (rawData.formats && rawData.formats.markdown) {
              websiteContent = rawData.formats.markdown;
            } else if (rawData.formats && rawData.formats.text) {
              websiteContent = rawData.formats.text;
            } else if (Array.isArray(rawData.content)) {
              websiteContent = rawData.content
                .filter((item: any) => item && (item.content || item.text))
                .map((item: any) => item.content || item.text)
                .join('\n\n');
            } else {
              // If no better format found, stringify the data
              websiteContent = JSON.stringify(rawData);
            }
          } else if (result.websiteData) {
            // Last resort - stringify whatever we have
            websiteContent = typeof result.websiteData === 'object' ? 
                            JSON.stringify(result.websiteData) : 
                            String(result.websiteData);
          }
          
          console.log(`Lead ${result.leadId} - Processing ${websiteContent.length} characters of content`);
          
          // Store the Firecrawl data in the lead object so enrichmentAgent can access it
          if (result.rawData) {
            // Create a structured Firecrawl extraction result
            console.log(`[PROCESS-DATA] Lead ${result.leadId} - Preparing extracted data for AI analysis`);
            const firecrawlExtracted: any = {
              venueName: result.lead.name,
              physicalAddress: result.lead.address || '',
              eventTypes: [],
              venueCapacity: null,
              inHouseCatering: null,
              amenities: [],
              preferredCaterers: [],
              contactInformation: {
                email: '',
                phone: '',
                contactPersonName: ''
              },
              managementContact: {
                managementContactName: '',
                managementContactEmail: '',
                managementContactPhone: ''
              },
              pricingInformation: ''
            };
            
            // Extract structured data
            if (result.rawData.structuredData) {
              // Process event types from schema.org data
              const eventTypes = extractEventTypesFromStructuredData(result.rawData.structuredData);
              if (eventTypes.length > 0) {
                firecrawlExtracted.eventTypes = eventTypes;
              }
            }
            
            // Extract contact information
            if (result.rawData.contactInformation) {
              const contactInfo = result.rawData.contactInformation;
              firecrawlExtracted.contactInformation = contactInfo;
              
              // Also populate management contact with the same info
              firecrawlExtracted.managementContact = {
                managementContactName: contactInfo.contactPersonName || '',
                managementContactEmail: contactInfo.email || '',
                managementContactPhone: contactInfo.phone || ''
              };
              
              // Only update if we found valuable information
              if (contactInfo.email && !result.lead.contact_email) {
                console.log(`[FIRECRAWL] Adding email from contactInformation: ${contactInfo.email}`);
                result.lead.contact_email = contactInfo.email;
              }
              
              if (contactInfo.phone && !result.lead.contact_phone) {
                console.log(`[FIRECRAWL] Adding phone from contactInformation: ${contactInfo.phone}`);
                result.lead.contact_phone = contactInfo.phone;
              }
              
              if (contactInfo.contactPersonName && !result.lead.contact_name) {
                console.log(`[FIRECRAWL] Adding contact name from contactInformation: ${contactInfo.contactPersonName}`);
                result.lead.contact_name = contactInfo.contactPersonName;
              }
            }
            
            // Store the complete extracted data in the lead object
            result.lead.firecrawl_data = firecrawlExtracted;
            
            // Add structured data from Firecrawl to the website content if available
            if (result.rawData.structuredData) {
              // Add structured data at the beginning of the content for better enrichment
              websiteContent = `STRUCTURED DATA FROM WEBSITE:\n${JSON.stringify(result.rawData.structuredData, null, 2)}\n\n` + websiteContent;
              console.log(`[FIRECRAWL] Added structured data to website content`);
            }
          }
          
          console.log(`[PROCESS-DATA] Lead ${result.leadId} - Calling AI enrichment (enrichLeadData) with ${websiteContent.length} chars of website content`);
          console.log(`[PROCESS-DATA] Lead ${result.leadId} - Website URL: ${result.lead.website_url}`);
          
          // Add detailed API diagnostics
          console.log(`[PROCESS-DATA] AI Config - Model: GPT-4o, Environment check - OPENAI_API_KEY exists: ${Boolean(process.env.OPENAI_API_KEY)}`);
          console.log(`[PROCESS-DATA] Lead ${result.leadId} - Starting AI enrichment process for '${result.lead.name}'`);
          
          // This is the main call to AI enrichment
          const enrichment = await enrichLeadData(result.lead, websiteContent);
          
          if (enrichment.success) {
            console.log(`[PROCESS-DATA] Lead ${result.leadId} - AI enrichment successful`);
            // Merge any direct Firecrawl contact information with the enrichment data
            if (result.rawData && result.rawData.contactInformation) {
              const contactInfo = result.rawData.contactInformation;
              
              // Preserve contact information if available
              if (contactInfo.email && !enrichment.enrichmentData.eventManagerEmail) {
                enrichment.enrichmentData.eventManagerEmail = contactInfo.email;
              }
              
              if (contactInfo.phone && !enrichment.enrichmentData.eventManagerPhone) {
                enrichment.enrichmentData.eventManagerPhone = contactInfo.phone;
              }
              
              if (contactInfo.contactPersonName && !enrichment.enrichmentData.eventManagerName) {
                enrichment.enrichmentData.eventManagerName = contactInfo.contactPersonName;
              }
            }
            
            // Generate an AI overview if we don't already have one
            if (!enrichment.enrichmentData.aiOverview) {
              try {
                console.log(`[PROCESS-DATA] Lead ${result.leadId} - Generating AI overview`);
                
                // Create a comprehensive prompt with all available data
                const aiPrompt = `
                Create a comprehensive overview of this venue for a catering company lead.
                
                Venue Information:
                - Name: ${enrichment.enrichmentData.venueName || result.lead.name}
                - Address: ${enrichment.enrichmentData.address || result.lead.address || ''}
                - Contact: Phone: ${enrichment.enrichmentData.eventManagerPhone || result.lead.contact_phone || ''}, Email: ${enrichment.enrichmentData.eventManagerEmail || result.lead.contact_email || ''}
                - Event Types: ${enrichment.enrichmentData.commonEventTypes?.join(', ') || ''}
                - Capacity: ${enrichment.enrichmentData.venueCapacity || ''}
                - In-house Catering: ${enrichment.enrichmentData.inHouseCatering ? 'Yes' : 'No'}
                - Amenities: ${Array.isArray(enrichment.enrichmentData.amenities) ? enrichment.enrichmentData.amenities.join(', ') : enrichment.enrichmentData.amenities || ''}
                - Preferred Caterers: ${enrichment.enrichmentData.preferredCaterers?.join(', ') || ''}
                
                Create a concise, fact-based summary (1-3 paragraphs) that highlights:
                1. The venue location and types of events hosted
                2. Catering situation (in-house or external)
                3. Contact information
                4. Any other key details relevant to a catering company
                
                Write in third person, present tense. Focus on facts, not marketing language.
                `;
                
                // Call OpenAI API to generate the overview
                const aiOverviewResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
                  },
                  body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [
                      { role: 'system', content: 'You are an AI assistant that creates factual summaries of venue information for catering companies.' },
                      { role: 'user', content: aiPrompt }
                    ],
                    temperature: 0.3,
                    max_tokens: 300
                  })
                });
                
                const aiResponse = await aiOverviewResponse.json();
                
                if (aiResponse.choices && aiResponse.choices.length > 0) {
                  const aiOverview = aiResponse.choices[0].message.content.trim();
                  console.log(`[PROCESS-DATA] Lead ${result.leadId} - Generated AI overview: ${aiOverview.substring(0, 100)}...`);
                  enrichment.enrichmentData.aiOverview = aiOverview;
                } else {
                  console.log(`[PROCESS-DATA] Lead ${result.leadId} - AI overview generation failed, no valid response`);
                }
              } catch (aiError) {
                console.error(`[PROCESS-DATA] Lead ${result.leadId} - Error generating AI overview:`, aiError);
                // Continue without the overview
              }
            }
            
            // Add a timestamp to track when the enrichment happened
            enrichment.enrichmentData.lastEnriched = new Date().toISOString();
            
            // Record the source of the data
            enrichment.enrichmentData.dataSource = "Firecrawl + Enrichment Agent";
            
            // Log sample of the AI enrichment data
            if (enrichment.enrichmentData.aiOverview) {
              console.log(`[PROCESS-DATA] Lead ${result.leadId} - AI overview: "${enrichment.enrichmentData.aiOverview.substring(0, 100)}..."`);
            }
            if (enrichment.enrichmentData.leadScore) {
              console.log(`[PROCESS-DATA] Lead ${result.leadId} - Lead score: ${enrichment.enrichmentData.leadScore.score} (${enrichment.enrichmentData.leadScore.potential})`);
            }
            
            return {
              leadId: result.leadId,
              success: true,
              enrichmentData: enrichment.enrichmentData,
              lead: result.lead
            };
          } else {
            console.error(`Failed to enrich lead ${result.leadId}: ${enrichment.error}`);
            return {
              leadId: result.leadId,
              success: false,
              error: enrichment.error || 'Enrichment process failed',
              lead: result.lead
            };
          }
        } catch (err) {
          console.error(`Error processing data for lead ${result.leadId}:`, err);
          return {
            leadId: result.leadId,
            success: false,
            error: err instanceof Error ? err.message : String(err),
            lead: result.lead
          };
        }
      }
      
      // If extraction failed, return the error
      return {
        leadId: result.leadId,
        success: false,
        error: result.error || 'Failed to extract or enrich data',
        lead: result.lead
      };
    }));
    
    // Summarize processing results
    const successCount = processedResults.filter((r: any) => r.success).length;
    const failCount = processedResults.filter((r: any) => !r.success).length;
    console.log(`Processing completed - Success: ${successCount}, Failed: ${failCount}, Total: ${processedResults.length}`);
    
    return { processedResults };
  }
});

/**
 * Step to update leads in the database
 */
export const updateLeadsStep = new Step({
  id: 'update-leads',
  description: 'Update leads with enriched data',
  execute: async (context) => {
    // @ts-ignore - getStepResult is used in the existing code but not properly typed
    const { processedResults } = context.getStepResult('process-data') || { processedResults: [] };
    
    console.log(`[UPDATE-LEADS] Starting database update for ${processedResults.length} processed leads`);
    
    const supabase = await createClient();
    const updateResults = [];
    
    // Verify database connection first
    try {
      const { data: connectionTest, error: connectionError } = await supabase.from('saved_leads').select('id').limit(1);
      
      if (connectionError) {
        console.error(`[UPDATE-LEADS] Database connection test failed: ${connectionError.message}`);
        throw new Error(`Database connection test failed: ${connectionError.message}`);
      }
      
      console.log(`[UPDATE-LEADS] Database connection verified successfully`);
    } catch (connectionTestError) {
      console.error(`[UPDATE-LEADS] Exception testing database connection: ${connectionTestError instanceof Error ? connectionTestError.message : 'Unknown error'}`);
    }
    
    for (const result of processedResults) {
      if (result.success && result.enrichmentData) {
        console.log(`[UPDATE-LEADS] Updating lead ${result.leadId} with enrichment data`);
        
        // Prepare database update data with proper status
        const updateData: Record<string, any> = {
          enrichment_data: result.enrichmentData,
          status: 'enriched', // Explicitly set the status to 'enriched'
          updated_at: new Date().toISOString()
        };
        
        // Verify the status field is set correctly
        console.log(`[UPDATE-LEADS] Setting status='enriched' for lead ${result.leadId} (previous status: ${result.lead.status || 'none'})`);
        
        // If we have a fixed/normalized website URL, include it in the update
        if (result.lead.website_url) {
          updateData.website_url = result.lead.website_url;
          console.log(`[UPDATE-LEADS] Including website_url: ${result.lead.website_url}`);
        }
        
        // Update contact information if it was found during enrichment
        if (result.lead.contact_email) {
          updateData.contact_email = result.lead.contact_email;
          console.log(`[UPDATE-LEADS] Including contact_email: ${result.lead.contact_email}`);
        } else if (result.enrichmentData.eventManagerEmail) {
          updateData.contact_email = result.enrichmentData.eventManagerEmail;
          console.log(`[UPDATE-LEADS] Including email from enrichment: ${result.enrichmentData.eventManagerEmail}`);
        }
        
        if (result.lead.contact_phone) {
          updateData.contact_phone = result.lead.contact_phone;
          console.log(`[UPDATE-LEADS] Including contact_phone: ${result.lead.contact_phone}`);
        } else if (result.enrichmentData.eventManagerPhone) {
          updateData.contact_phone = result.enrichmentData.eventManagerPhone;
          console.log(`[UPDATE-LEADS] Including phone from enrichment: ${result.enrichmentData.eventManagerPhone}`);
        }
        
        if (result.lead.contact_name) {
          updateData.contact_name = result.lead.contact_name;
          console.log(`[UPDATE-LEADS] Including contact_name: ${result.lead.contact_name}`);
        } else if (result.enrichmentData.eventManagerName) {
          updateData.contact_name = result.enrichmentData.eventManagerName;
          console.log(`[UPDATE-LEADS] Including name from enrichment: ${result.enrichmentData.eventManagerName}`);
        }
        
        // Add lead score information
        if (result.enrichmentData.leadScore) {
          updateData.lead_score = result.enrichmentData.leadScore.score;
          updateData.lead_score_label = result.enrichmentData.leadScore.potential;
          console.log(`[UPDATE-LEADS] Including lead score: ${updateData.lead_score} (${updateData.lead_score_label})`);
        }
        
        // Update timestamp
        updateData.updated_at = new Date().toISOString();
        
        try {
          console.log(`[UPDATE-LEADS] Sending update to database for lead ${result.leadId}`);
          
          // @ts-ignore - supabase client return type mismatch
          const { data: updatedData, error } = await supabase
            .from('saved_leads')
            .update(updateData)
            .eq('id', result.leadId)
            .select();
          
          if (error) {
            console.error(`[UPDATE-LEADS] Database update error for lead ${result.leadId}:`, error);
            
            // Try a fallback with minimal fields
            console.log(`[UPDATE-LEADS] Trying fallback update with minimal fields`);
            const minimalUpdate = {
              status: 'enriched',
              updated_at: new Date().toISOString()
            };
            
            const { error: fallbackError } = await supabase
              .from('saved_leads')
              .update(minimalUpdate)
              .eq('id', result.leadId);
              
            if (fallbackError) {
              console.error(`[UPDATE-LEADS] Fallback update also failed:`, fallbackError);
              updateResults.push({
                leadId: result.leadId,
                success: false,
                error: fallbackError.message,
                preserved: !!result.preservedData,
                lead: result.lead,
                enrichmentData: result.enrichmentData
              });
            } else {
              console.log(`[UPDATE-LEADS] Fallback update succeeded for lead ${result.leadId}`);
              updateResults.push({
                leadId: result.leadId,
                success: true,
                minimally_updated: true,
                preserved: !!result.preservedData,
                lead: result.lead,
                enrichmentData: result.enrichmentData
              });
            }
          } else {
            console.log(`[UPDATE-LEADS] Successfully updated lead ${result.leadId}`);
            if (updatedData && updatedData.length > 0) {
              console.log(`[UPDATE-LEADS] Updated lead data:`, updatedData[0].id, updatedData[0].status);
            }
            
            updateResults.push({
              leadId: result.leadId,
              success: true,
              preserved: !!result.preservedData,
              lead: result.lead,
              enrichmentData: result.enrichmentData
            });
          }
        } catch (updateError) {
          console.error(`[UPDATE-LEADS] Exception updating lead ${result.leadId}:`, updateError);
          updateResults.push({
            leadId: result.leadId,
            success: false,
            error: updateError instanceof Error ? updateError.message : String(updateError),
            preserved: !!result.preservedData
          });
        }
      } else {
        console.log(`[UPDATE-LEADS] Skipping update for lead ${result.leadId} - no enrichment data or processing failed`);
        updateResults.push({
          leadId: result.leadId,
          success: false,
          error: result.error || 'No enrichment data',
          preserved: !!result.preservedData
        });
      }
    }
    
    // Create summary with preserved count
    const successful = updateResults.filter(r => r.success).length;
    const preserved = updateResults.filter(r => r.preserved).length;
    const failed = updateResults.filter(r => !r.success).length;
 
    console.log(`[UPDATE-LEADS] Completed database updates. Results: ${successful} successful, ${failed} failed`);
    
    // Verify the status was updated correctly
    try {
      const successfulLeadIds = updateResults
        .filter(r => r.success)
        .map(r => r.leadId);
        
      if (successfulLeadIds.length > 0) {
        console.log(`[UPDATE-LEADS] Verifying status updates for ${successfulLeadIds.length} leads`);
        
        const { data: verificationData, error: verificationError } = await supabase
          .from('saved_leads')
          .select('id, status, enrichment_data')
          .in('id', successfulLeadIds);
          
        if (verificationError) {
          console.error(`[UPDATE-LEADS] Verification query failed:`, verificationError);
        } else if (verificationData) {
          const enrichedCount = verificationData.filter(lead => lead.status === 'enriched').length;
          const withAiData = verificationData.filter(lead => 
            lead.enrichment_data && 
            (lead.enrichment_data.aiOverview || lead.enrichment_data.leadScore)
          ).length;
          
          console.log(`[UPDATE-LEADS] Verification complete: ${enrichedCount} of ${verificationData.length} leads have 'enriched' status`);
          console.log(`[UPDATE-LEADS] ${withAiData} of ${verificationData.length} leads have AI-generated data`);
          
          // Log any leads that don't have the expected status
          const notEnriched = verificationData.filter(lead => lead.status !== 'enriched');
          if (notEnriched.length > 0) {
            console.warn(`[UPDATE-LEADS] ${notEnriched.length} leads don't have 'enriched' status:`, notEnriched.map(l => l.id));
          }
          
          // Log any leads missing AI data
          const missingAiData = verificationData.filter(lead => 
            !lead.enrichment_data || 
            (!lead.enrichment_data.aiOverview && !lead.enrichment_data.leadScore)
          );
          
          if (missingAiData.length > 0) {
            console.warn(`[UPDATE-LEADS] ${missingAiData.length} leads are missing AI-generated data:`, missingAiData.map(l => l.id));
          }
        }
      }
    } catch (verificationError) {
      console.error(`[UPDATE-LEADS] Exception during verification:`, verificationError);
    }
    
    return {
      updateResults,
      successful,
      preserved,
      failed,
      total: updateResults.length,
      summary: `Updated ${successful} leads (${preserved} using preserved data), ${failed} failed`
    };
  }
});

/**
 * Extract event types from structured data
 */
function extractEventTypesFromStructuredData(structuredData: any[]): string[] {
  if (!structuredData || !Array.isArray(structuredData)) {
    return [];
  }
  
  const eventTypes: Set<string> = new Set();
  
  // Keywords that indicate event types
  const eventKeywords = [
    'wedding', 'corporate', 'meeting', 'party', 'celebration',
    'conference', 'reception', 'ceremony', 'gala', 'charity', 
    'fundraiser', 'retreat', 'seminar', 'workshop', 'birthday',
    'anniversary', 'reunion', 'shower', 'banquet', 'dinner',
    'social', 'gathering', 'networking', 'holiday'
  ];
  
  // Process each structured data item
  for (const item of structuredData) {
    // Check if the item is an event
    if (item['@type'] === 'Event') {
      if (item.name) {
        const name = item.name.toLowerCase();
        // Check if the event name contains any of our event keywords
        for (const keyword of eventKeywords) {
          if (name.includes(keyword)) {
            // Capitalize the first letter of each word
            const formattedType = keyword
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
            eventTypes.add(formattedType);
          }
        }
      }
    }
    
    // Check for event offerings in service descriptions
    if (item['@type'] === 'Service' || item['@type'] === 'LocalBusiness' || item['@type'] === 'Organization') {
      const description = item.description || '';
      
      if (typeof description === 'string') {
        const descLower = description.toLowerCase();
        
        // Check for event keywords in the description
        for (const keyword of eventKeywords) {
          if (descLower.includes(keyword)) {
            // Capitalize the first letter of each word
            const formattedType = keyword
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
            eventTypes.add(formattedType);
          }
        }
      }
    }
  }
  
  return Array.from(eventTypes);
}

// Helper function to poll for async job results
async function pollForResults(jobId: string, apiKey: string): Promise<{ success: boolean; data: any; error: string | null }> {
  let extractionComplete = false;
  let retries = 0;
  const maxRetries = 8;
  let result: { success: boolean; data: any; error: string | null } = { 
    success: false, 
    data: null, 
    error: 'Polling timeout' 
  };
  
  while (!extractionComplete && retries < maxRetries) {
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds between polls
    
    console.log(`[FIRECRAWL] Checking status for job ${jobId}, attempt ${retries + 1}/${maxRetries}`);
    try {
      const statusResponse = await fetch(`https://api.firecrawl.dev/extract/${jobId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      const statusData = await statusResponse.json();
      
      if (statusData.status === "completed") {
        console.log(`[FIRECRAWL] Extraction completed for job ${jobId}`);
        result = { 
          success: true, 
          data: statusData.data,
          error: null 
        };
        extractionComplete = true;
      } else if (statusData.status === "failed") {
        console.log(`[FIRECRAWL] Job failed: ${statusData.error || 'Unknown error'}`);
        result = { 
          success: false, 
          data: null,
          error: statusData.error || 'Job failed' 
        };
        extractionComplete = true;
      } else {
        console.log(`[FIRECRAWL] Extraction in progress: ${statusData.status}, retrying in 3s...`);
        retries++;
      }
    } catch (error) {
      console.error(`[FIRECRAWL] Error polling for job ${jobId}:`, error);
      retries++;
    }
  }
  
  return result;
}