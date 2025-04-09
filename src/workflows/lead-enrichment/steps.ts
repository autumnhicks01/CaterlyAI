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
          console.log(`[FIRECRAWL] Extracting data for lead ${lead.id} from URL: ${websiteUrl}`);
          
          // Verify the Firecrawl API key exists before making the call
          const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
          if (!firecrawlApiKey) {
            console.error(`[FIRECRAWL] Missing API key for extraction`);
            return {
              leadId: lead.id,
              success: false,
              error: 'Firecrawl API key is not configured',
              lead
            };
          }
          
          // Verify the API key is properly formatted
          if (firecrawlApiKey.length < 20) {
            console.error(`[FIRECRAWL] API key appears to be invalid (too short)`);
            return {
              leadId: lead.id,
              success: false,
              error: 'Firecrawl API key appears to be invalid',
              lead
            };
          }
          
          console.log(`[FIRECRAWL] Using API key starting with: ${firecrawlApiKey.substring(0, 5)}...`);
          
          // Configure Firecrawl with optimal extraction settings for venue websites
          const extractionResult = await firecrawlTool.extract({
            urls: [websiteUrl],
            waitTime: 8000,                // Increase wait time for better content loading
            enableWebSearch: false,        // We don't need web search
            includeHtml: true,             // Include HTML for better extraction
            extractMetadata: true,         // Extract all possible metadata
            waitUntil: 'networkidle0',     // Wait until network is idle for better loading
            formats: ['text', 'markdown']  // Request both text and markdown formats
          });
          
          console.log(`[FIRECRAWL] Extraction result status for ${lead.name}: ${extractionResult.success ? 'Success' : 'Failed'}`);
          
          // If successful, ensure the website_url is updated in the lead object for later steps
          if (extractionResult.success && websiteUrl !== lead.website_url) {
            lead.website_url = websiteUrl;
            console.log(`Updated lead ${lead.id} website_url to: ${websiteUrl}`);
          }
          
          // Prepare HTML content for enrichment
          let htmlContent = '';
          if (extractionResult.data) {
            console.log(`[FIRECRAWL] Extraction data received for ${lead.name}. Processing data format...`);
            
            // Extract HTML/text content from various possible locations in the response
            if (typeof extractionResult.data.content === 'string') {
              htmlContent = extractionResult.data.content;
              console.log(`[FIRECRAWL] Using direct content string (${htmlContent.length} chars)`);
            } else if (extractionResult.data.text) {
              // Direct text property from v1 API
              htmlContent = extractionResult.data.text;
              console.log(`[FIRECRAWL] Using text property (${htmlContent.length} chars)`);
            } else if (extractionResult.data.formats && extractionResult.data.formats.text) {
              htmlContent = extractionResult.data.formats.text;
              console.log(`[FIRECRAWL] Using formats.text (${htmlContent.length} chars)`);
            } else if (extractionResult.data.formats && extractionResult.data.formats.markdown) {
              htmlContent = extractionResult.data.formats.markdown;
              console.log(`[FIRECRAWL] Using formats.markdown (${htmlContent.length} chars)`);
            } else if (extractionResult.data.formats && extractionResult.data.formats.html) {
              // Extract text from HTML if needed
              htmlContent = extractionResult.data.formats.html;
              console.log(`[FIRECRAWL] Using formats.html (${htmlContent.length} chars)`);
            } else if (Array.isArray(extractionResult.data.content)) {
              // If content is an array, concatenate all text content
              htmlContent = extractionResult.data.content
                .filter((item: any) => item && (item.content || item.text))
                .map((item: any) => item.content || item.text)
                .join('\n\n');
              console.log(`[FIRECRAWL] Using array content (${htmlContent.length} chars)`);
            } else if (extractionResult.data.contactInformation) {
              // If we have contact information but no content, create a minimal text representation
              const contactInfo = extractionResult.data.contactInformation;
              htmlContent = `Contact Information:\n`;
              if (contactInfo.email) htmlContent += `Email: ${contactInfo.email}\n`;
              if (contactInfo.phone) htmlContent += `Phone: ${contactInfo.phone}\n`;
              if (contactInfo.contactPersonName) htmlContent += `Contact: ${contactInfo.contactPersonName}\n`;
              if (contactInfo.address) htmlContent += `Address: ${contactInfo.address}\n`;
              console.log(`[FIRECRAWL] Using contact information (${htmlContent.length} chars)`);
            }
            
            // Final fallback: if we still don't have content, stringify the data
            if (htmlContent.length < 100) {
              console.log(`[FIRECRAWL] Content too short, using full data object`);
              htmlContent = JSON.stringify(extractionResult.data, null, 2);
            }
            
            console.log(`Lead ${lead.id} - Extracted ${htmlContent.length} characters of content`);
          } else {
            console.log(`[FIRECRAWL] No data received for ${lead.name}`);
          }
          
          return {
            leadId: lead.id,
            websiteData: htmlContent || extractionResult.data,
            rawData: extractionResult.data,
            success: extractionResult.success && htmlContent.length > 0,
            error: !htmlContent.length ? 'No content extracted' : extractionResult.error,
            lead
          };
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
          
          const enrichment = await enrichLeadData(result.lead, websiteContent);
          
          if (enrichment.success) {
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
            
            // Add a timestamp to track when the enrichment happened
            enrichment.enrichmentData.lastEnriched = new Date().toISOString();
            
            // Record the source of the data
            enrichment.enrichmentData.dataSource = "Firecrawl + Enrichment Agent";
            
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
    
    const supabase = await createClient();
    const updateResults = [];
    
    for (const result of processedResults) {
      if (result.success && result.enrichmentData) {
        // Create the update data object with proper typing
        const updateData: Record<string, any> = {
          enrichment_data: result.enrichmentData,
          status: 'enriched',
          updated_at: new Date().toISOString()
        };
        
        // If we have a fixed/normalized website URL, include it in the update
        if (result.lead.website_url) {
          updateData.website_url = result.lead.website_url;
          console.log(`Updating lead ${result.leadId} with website_url: ${result.lead.website_url}`);
        }
        
        // Update contact information if it was found during enrichment
        if (result.lead.contact_email) {
          updateData.contact_email = result.lead.contact_email;
          console.log(`Updating lead ${result.leadId} with contact_email: ${result.lead.contact_email}`);
        } else if (result.enrichmentData.eventManagerEmail) {
          updateData.contact_email = result.enrichmentData.eventManagerEmail;
          console.log(`Updating lead ${result.leadId} with email from enrichment: ${result.enrichmentData.eventManagerEmail}`);
        }
        
        if (result.lead.contact_phone) {
          updateData.contact_phone = result.lead.contact_phone;
          console.log(`Updating lead ${result.leadId} with contact_phone: ${result.lead.contact_phone}`);
        } else if (result.enrichmentData.eventManagerPhone) {
          updateData.contact_phone = result.enrichmentData.eventManagerPhone;
          console.log(`Updating lead ${result.leadId} with phone from enrichment: ${result.enrichmentData.eventManagerPhone}`);
        }
        
        if (result.lead.contact_name) {
          updateData.contact_name = result.lead.contact_name;
          console.log(`Updating lead ${result.leadId} with contact_name: ${result.lead.contact_name}`);
        } else if (result.enrichmentData.eventManagerName) {
          updateData.contact_name = result.enrichmentData.eventManagerName;
          console.log(`Updating lead ${result.leadId} with name from enrichment: ${result.enrichmentData.eventManagerName}`);
        }
        
        // Add lead score information
        if (result.enrichmentData.leadScore) {
          updateData.lead_score = result.enrichmentData.leadScore.score;
          updateData.lead_score_label = result.enrichmentData.leadScore.potential;
          console.log(`Updating lead ${result.leadId} with score: ${updateData.lead_score} (${updateData.lead_score_label})`);
        }
        
        // Track whether we have an email (important for lead qualification)
        updateData.has_email = !!(updateData.contact_email || result.enrichmentData.eventManagerEmail);
        
        // Log what we're updating
        if (result.preservedData) {
          console.log(`Lead ${result.leadId} - Using preserved enrichment data: `, {
            name: result.enrichmentData.venueName,
            website: result.enrichmentData.website,
            hasScore: !!result.enrichmentData.leadScore,
            hasEmail: updateData.has_email
          });
        } else {
          console.log(`Lead ${result.leadId} - Updating with new enrichment data (has email: ${updateData.has_email})`);
        }
        
        // Remove lastUpdated and other fields that might cause database issues
        if (updateData.enrichment_data) {
          // Fields to clean before database storage
          const fieldsToClean = ['lastUpdated', 'lastEnriched'];
          
          for (const field of fieldsToClean) {
            if (updateData.enrichment_data[field]) {
              delete updateData.enrichment_data[field];
            }
          }
        }
        
        // @ts-ignore - supabase client return type mismatch
        const { error } = await supabase
          .from('saved_leads')
          .update(updateData)
          .eq('id', result.leadId);
        
        updateResults.push({
          leadId: result.leadId,
          success: !error,
          error: error?.message,
          preserved: !!result.preservedData,
          hasEmail: updateData.has_email
        });
      } else {
        updateResults.push({
          leadId: result.leadId,
          success: false,
          error: result.error || 'No enrichment data'
        });
      }
    }
    
    // Create summary with preserved count
    const successful = updateResults.filter(r => r.success).length;
    const preserved = updateResults.filter(r => r.preserved).length;
    const withEmail = updateResults.filter(r => r.hasEmail).length;
    const failed = updateResults.filter(r => !r.success).length;
 
    return {
      updateResults,
      successful,
      preserved,
      withEmail,
      failed,
      total: updateResults.length,
      summary: `Updated ${successful} leads (${preserved} using preserved data, ${withEmail} with email), ${failed} failed`
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