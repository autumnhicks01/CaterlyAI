import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";

// Lead enrichment agent for enhancing lead data
export const enrichmentAgent = new Agent({
  name: "Lead Enrichment Agent",
  instructions: `
    You are a business analyst specializing in catering industry lead enrichment.
    Extract key venue details, event capabilities, and contact information.
    Format your response as structured JSON with venue details, contact info, and event capabilities.
  `,
  model: openai("gpt-4o"),
});

// Core types
interface EnrichmentData {
  venueName?: string;
  aiOverview?: string;
  eventManagerName?: string;
  eventManagerEmail?: string;
  eventManagerPhone?: string;
  commonEventTypes?: string[];
  inHouseCatering?: boolean;
  venueCapacity?: number;
  amenities?: string[] | string;
  pricingInformation?: string;
  preferredCaterers?: string[];
  website?: string;
  leadScore?: {
    score: number;
    reasons: string[];
    potential: 'high' | 'medium' | 'low';
    lastCalculated: string;
  };
  lastUpdated?: string;
  [key: string]: any;
}

// Result interface for batch operations
interface EnrichmentResult {
  success: boolean;
  message: string;
  results?: {
    processed?: number;
    total?: number;
    succeeded?: number;
    successful?: number;
    failed?: number;
    skipped?: number;
    errors?: string[];
  };
  error?: string;
  enrichedBusinesses?: any[];
}

// Main function - enrich lead data
export async function enrichLeadData(lead: any, extractedData: any = {}): Promise<any> {
  console.log(`[ENRICHMENT-AGENT] Starting AI enrichment for lead: ${lead.name}`);
  
  try {
    // Get website content from extracted data
    const websiteContent = extractedData?.content || 
                          extractedData?.text || 
                          (typeof extractedData === 'string' ? extractedData : '');
    
    // Prepare lead info
    const leadInfo = {
      name: lead.name,
      type: lead.type || 'venue',
      website: lead.website_url || extractedData?.website || '',
      address: lead.address || extractedData?.physicalAddress || '',
      city: lead.city || '',
      state: lead.state || '',
      phone: lead.contact_phone || lead.phone || '',
      email: lead.contact_email || lead.email || ''
    };
    
    console.log(`[ENRICHMENT-AGENT] Processing lead with website: ${leadInfo.website}`);
    
    // Generate enrichment data (direct implementation to avoid agent interface issues)
    let enrichmentData: EnrichmentData;
    
    try {
      // Create the prompt for analysis
      const prompt = createPrompt(leadInfo, websiteContent);
      
      // Call OpenAI directly
      const response = await callOpenAI(prompt);
      
      // Parse the response
      enrichmentData = parseResponse(response, leadInfo);
      
      // Extract additional data from content if needed
      if (websiteContent && websiteContent.length > 200) {
        enrichmentData = extractAdditionalData(enrichmentData, websiteContent, leadInfo);
      }
    } catch (aiError) {
      console.warn(`[ENRICHMENT-AGENT] AI enrichment failed, using fallback: ${aiError}`);
      // Create fallback data if AI fails
      enrichmentData = createFallbackData(leadInfo);
    }
    
    // Calculate lead score
    enrichmentData.leadScore = calculateLeadScore(enrichmentData);
    enrichmentData.lastUpdated = new Date().toISOString();
    
    console.log(`[ENRICHMENT-AGENT] Generated lead score: ${enrichmentData.leadScore?.score} (${enrichmentData.leadScore?.potential})`);
    
    if (enrichmentData.aiOverview) {
      console.log(`[ENRICHMENT-AGENT] Generated description: "${enrichmentData.aiOverview.substring(0, 100)}..."`);
    }
    
    return {
      success: true,
      enrichmentData
    };
  } catch (error) {
    console.error(`[ENRICHMENT-AGENT] Error enriching lead ${lead.name}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : `Unknown error enriching lead ${lead.name}`
    };
  }
}

// Batch enrichment function that works with the workflow manager
export async function enrichLeads(leadIds: string[]): Promise<EnrichmentResult> {
  try {
    // Validate input
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return {
        success: false,
        message: 'No valid leadIds provided.'
      };
    }

    console.log(`[EnrichmentAgent] Processing ${leadIds.length} leads for enrichment`);

    // Fetch the leads from the API instead of direct Supabase access
    let leads;
    try {
      console.log(`[EnrichmentAgent] Fetching leads with IDs: ${leadIds.join(', ')}`);
      const response = await fetch('/api/leads/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ leadIds }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch leads: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      leads = data.leads;
      console.log(`[EnrichmentAgent] Successfully fetched ${leads?.length || 0} leads`);
    } catch (fetchError) {
      console.error('[EnrichmentAgent] Exception fetching leads:', fetchError);
      return { 
        success: false, 
        message: 'Failed to fetch leads from API',
        error: fetchError instanceof Error ? fetchError.message : String(fetchError)
      };
    }

    if (!leads || leads.length === 0) {
      return {
        success: false,
        message: 'No leads found with the provided IDs'
      };
    }

    // Track results for response
    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[]
    };

    // Process leads in parallel using Promise.all
    const processLeadPromises = leads.map(async (lead: any, index: number) => {
      console.log(`[EnrichmentAgent] Processing lead ${index + 1}/${leads.length}: ${lead.name} (${lead.id})`);
      
      // Get the website URL from either company_website or website_url field
      const websiteUrl = lead.company_website || lead.website_url;
      
      if (!websiteUrl) {
        console.log(`[EnrichmentAgent] Lead ${lead.id} has no website URL; skipping.`);
        return {
          status: 'skipped',
          leadId: lead.id,
          message: 'No website URL available'
        };
      }

      try {
        // Extract website content
        let websiteContent;
        try {
          // Import the firecrawl tool dynamically
          const { firecrawlTool } = await import('@/tools/firecrawl');
          
          console.log(`[EnrichmentAgent] Extracting content from: ${websiteUrl}`);
          const result = await firecrawlTool.extract({
            urls: [normalizeUrl(websiteUrl)],
            formats: ["markdown", "text"],
            timeout: 120000, // 2 minutes
            waitTime: 5000
          });
          
          if (result.success && result.data) {
            websiteContent = firecrawlTool.extractContent(result.data);
            console.log(`[EnrichmentAgent] Extracted ${websiteContent.length} chars from website`);
          }
        } catch (extractError) {
          console.error(`[EnrichmentAgent] Extraction failed:`, extractError);
          // We continue even if extraction fails - will use AI without website content
        }
        
        // Process lead with AI
        const enrichmentResult = await enrichLeadData(lead, { 
          content: websiteContent,
          website: websiteUrl
        });
        
        if (!enrichmentResult.success) {
          throw new Error(enrichmentResult.error || 'Failed to enrich lead');
        }
        
        // Update the lead via the API
        try {
          const updateResponse = await fetch('/api/leads/update', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              leadId: lead.id,
              enrichment_data: enrichmentResult.enrichmentData,
              status: 'enriched',
              lead_score: enrichmentResult.enrichmentData.leadScore?.score,
              lead_score_label: enrichmentResult.enrichmentData.leadScore?.potential
            }),
          });
          
          if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            throw new Error(`Failed to update lead: ${updateResponse.status} - ${errorText}`);
          }
          
          const updatedLead = await updateResponse.json();
          
          // Return the enriched lead
          return {
            status: 'success',
            leadId: lead.id,
            lead: updatedLead.lead || {
              ...lead,
              enrichment_data: enrichmentResult.enrichmentData,
              status: 'enriched',
              lead_score: enrichmentResult.enrichmentData.leadScore?.score,
              lead_score_label: enrichmentResult.enrichmentData.leadScore?.potential
            }
          };
        } catch (updateError) {
          throw new Error(`Failed to update lead: ${updateError instanceof Error ? updateError.message : String(updateError)}`);
        }
      } catch (error) {
        console.error(`[EnrichmentAgent] Error processing lead ${lead.id}:`, error);
        return {
          status: 'failed',
          leadId: lead.id,
          message: error instanceof Error ? error.message : String(error)
        };
      }
    });

    // Wait for all lead processing to complete
    const processResults = await Promise.all(processLeadPromises);
    
    // Extract successful leads for the response
    const enrichedBusinesses = processResults
      .filter(result => result.status === 'success')
      .map(result => result.lead);
    
    // Compile the results
    processResults.forEach(result => {
      results.processed++;
      
      if (result.status === 'success') {
        results.successful++;
      } else if (result.status === 'failed') {
        results.failed++;
        if (result.message) {
          results.errors.push(`Lead ${result.leadId}: ${result.message}`);
        }
      } else if (result.status === 'skipped') {
        results.skipped++;
      }
    });

    console.log(`[EnrichmentAgent] Enrichment completed. Results: ${JSON.stringify({
      processed: results.processed,
      successful: results.successful,
      failed: results.failed,
      skipped: results.skipped
    })}`);

    return {
      success: true,
      message: 'Enrichment process completed.',
      results: {
        processed: results.processed,
        succeeded: results.successful,
        total: results.processed,
        successful: results.successful,
        failed: results.failed,
        skipped: results.skipped,
        errors: results.errors.length > 0 ? results.errors : undefined
      },
      enrichedBusinesses
    };
  } catch (err) {
    console.error('[EnrichmentAgent] Unexpected error:', err);
    return { 
      success: false, 
      message: 'Unexpected error in enrichment process',
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

// Normalize URL function
function normalizeUrl(url: string): string {
  try {
    // Make sure URL starts with http:// or https://
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    // Parse the URL to get just the origin (protocol + hostname)
    const parsedUrl = new URL(url);
    return parsedUrl.origin;
  } catch (error) {
    console.error(`[EnrichmentAgent] Error normalizing URL ${url}:`, error);
    return url; // Return original if parsing fails
  }
}

// Create a prompt for the AI model
function createPrompt(leadInfo: any, websiteContent: string = ''): string {
  return `You are analyzing a venue business for a catering company.
Please extract key details from the following information. Focus on finding contact emails and event details.

BUSINESS INFORMATION:
Name: ${leadInfo.name}
${leadInfo.type ? `Type: ${leadInfo.type}` : ''}
${leadInfo.address ? `Address: ${leadInfo.address}` : ''}
${leadInfo.website ? `Website: ${leadInfo.website}` : ''}
${leadInfo.phone ? `Phone: ${leadInfo.phone}` : ''}
${leadInfo.email ? `Email: ${leadInfo.email}` : ''}

${websiteContent ? 'WEBSITE CONTENT (extract):\n' + websiteContent.substring(0, 3000) + (websiteContent.length > 3000 ? '...(content truncated)' : '') : 'No website content available.'}

YOUR MOST IMPORTANT TASK is to find contact emails! Look very carefully for email addresses in the website content.
Specifically search for patterns like name@domain.com throughout the text.
Look at "Contact Us" sections, footers, and staff directories for email addresses.
Contact information is ABSOLUTELY CRITICAL - without it, this lead cannot be used.

Focus particularly on finding the event manager's or event coordinator's contact information.
Common titles to look for: "Event Manager", "Event Coordinator", "Event Director", "Catering Manager", etc.

Search for phrases like "For event inquiries, contact..." or "To schedule an event, email..."

Provide a response in valid JSON format:
{
  "venueName": "name of the venue",
  "website": "website URL if available",
  "aiOverview": "2-3 sentence description of the venue",
  "eventManagerName": "contact person name if found (especially event coordinator/manager)",
  "eventManagerEmail": "contact email (VERY IMPORTANT, search thoroughly for email addresses)",
  "eventManagerPhone": "contact phone number with area code",
  "commonEventTypes": ["types", "of", "events", "they", "host"],
  "venueCapacity": number of people they can accommodate or null,
  "inHouseCatering": boolean or null (whether they provide their own catering),
  "amenities": ["list", "of", "amenities"],
  "pricingInformation": "pricing details if available",
  "preferredCaterers": ["list", "of", "preferred", "caterers"] 
}`;
}

// Call OpenAI API for enrichment
async function callOpenAI(prompt: string): Promise<string> {
  try {
    console.log('[ENRICHMENT-AGENT] Calling OpenAI API with GPT-4o model...');

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key is not configured');
    }
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a business analyst specializing in catering industry lead enrichment. Extract key venue details, event capabilities, and contact information. Format your response as structured JSON with venue details, contact info, and event capabilities.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from OpenAI API');
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error('[ENRICHMENT-AGENT] Error in callOpenAI:', error);
    throw new Error(`Failed to call OpenAI API: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Parse AI response
function parseResponse(response: string, leadInfo: any): EnrichmentData {
  try {
    let parsedData: any;
    
    try {
      parsedData = JSON.parse(response);
    } catch (jsonError) {
      // Try to find JSON in the text if direct parsing fails
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse JSON from response');
      }
    }
    
    // Map the parsed data to our EnrichmentData structure
    const result: EnrichmentData = {
      venueName: parsedData.venueName || leadInfo.name,
      aiOverview: parsedData.aiOverview,
      eventManagerName: parsedData.eventManagerName || parsedData.contact_name,
      eventManagerEmail: parsedData.eventManagerEmail || parsedData.contact_email || leadInfo.email,
      eventManagerPhone: parsedData.eventManagerPhone || parsedData.contact_phone || leadInfo.phone,
      website: parsedData.website || leadInfo.website,
      commonEventTypes: parsedData.commonEventTypes || parsedData.event_types || [],
      venueCapacity: typeof parsedData.venueCapacity === 'number' ? parsedData.venueCapacity : null,
      inHouseCatering: typeof parsedData.inHouseCatering === 'boolean' ? parsedData.inHouseCatering : null,
      amenities: parsedData.amenities || [],
      pricingInformation: parsedData.pricingInformation || parsedData.pricing_info || '',
      preferredCaterers: parsedData.preferredCaterers || []
    };
    
    return result;
  } catch (error) {
    console.error('[ENRICHMENT-AGENT] Error parsing AI response:', error);
    
    // Return basic data from the lead info
    return { 
      venueName: leadInfo.name,
      website: leadInfo.website,
      eventManagerEmail: leadInfo.email,
      eventManagerPhone: leadInfo.phone,
      aiOverview: `${leadInfo.name} is a venue located at ${leadInfo.address || 'an unknown location'}.`
    };
  }
}

// Extract additional data from website content
function extractAdditionalData(data: EnrichmentData, content: string, leadInfo: any): EnrichmentData {
  try {
    // Look for missing email addresses - this is critical
    if (!data.eventManagerEmail) {
      const emails = extractEmails(content);
      if (emails.length > 0) {
        data.eventManagerEmail = emails[0];
        console.log(`[ENRICHMENT-AGENT] Extracted email from content: ${data.eventManagerEmail}`);
      }
    }
    
    // Try to extract phone numbers if missing
    if (!data.eventManagerPhone) {
      const phones = extractPhones(content);
      if (phones.length > 0) {
        data.eventManagerPhone = phones[0];
        console.log(`[ENRICHMENT-AGENT] Extracted phone from content: ${data.eventManagerPhone}`);
      }
    }

    // Try to extract venue capacity if missing
    if (!data.venueCapacity) {
      const capacity = extractVenueCapacity(content);
      if (capacity) {
        data.venueCapacity = capacity;
        console.log(`[ENRICHMENT-AGENT] Extracted venue capacity: ${capacity}`);
      }
    }
    
    // Try to extract event types if missing
    if (!data.commonEventTypes || data.commonEventTypes.length === 0) {
      const eventTypes = extractEventTypes(content);
      if (eventTypes.length > 0) {
        data.commonEventTypes = eventTypes;
        console.log(`[ENRICHMENT-AGENT] Extracted event types: ${eventTypes.join(', ')}`);
      }
    }
    
    // Try to determine in-house catering if not already set
    if (data.inHouseCatering === null || data.inHouseCatering === undefined) {
      data.inHouseCatering = checkForInHouseCatering(content);
      console.log(`[ENRICHMENT-AGENT] Determined in-house catering: ${data.inHouseCatering}`);
    }
    
    return data;
  } catch (error) {
    console.error('[ENRICHMENT-AGENT] Error in extractAdditionalData:', error);
    return data;
  }
}

// Extract emails from content
function extractEmails(content: string): string[] {
  if (!content) return [];
  
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const matches = content.match(emailPattern) || [];
  
  // Filter out common false positives
  const filteredEmails = [...new Set(matches)].filter(email => {
    // Skip common false positives
    return !(email.includes('example.com') || 
        email.includes('yourdomain.com') || 
        email.includes('domain.com') || 
        email.includes('@email') ||
        email.includes('your@') ||
        email.includes('user@') ||
        email.includes('name@') ||
        email.includes('email@') ||
        email.includes('info@example') ||
        email.includes('test@') ||
        email.includes('username@') ||
        email.includes('no-reply@'));
  });
  
  // Try to find event-related emails first
  const eventEmails = filteredEmails.filter(email => 
    email.includes('event') || 
    email.includes('catering') || 
    email.includes('booking') || 
    email.includes('sales') || 
    email.includes('venue') ||
    email.includes('reservation') ||
    email.includes('events') ||
    email.includes('book') ||
    email.includes('inquiry')
  );
  
  // If we have event-related emails, prioritize them
  if (eventEmails.length > 0) {
    console.log(`[ENRICHMENT-AGENT] Found ${eventEmails.length} event-related emails: ${eventEmails.join(', ')}`);
    return eventEmails;
  }
  
  // Sort general emails to prioritize more legitimate-looking ones
  // Prefer shorter domains and addresses that don't start with common prefixes
  const sortedEmails = filteredEmails.sort((a, b) => {
    // Prefer emails that aren't generic
    const aIsGeneric = a.startsWith('info@') || a.startsWith('contact@') || a.startsWith('hello@');
    const bIsGeneric = b.startsWith('info@') || b.startsWith('contact@') || b.startsWith('hello@');
    
    if (aIsGeneric && !bIsGeneric) return 1;
    if (!aIsGeneric && bIsGeneric) return -1;
    
    // Prefer shorter domain parts (likely the primary domain)
    const aDomain = a.split('@')[1];
    const bDomain = b.split('@')[1];
    if (aDomain.length !== bDomain.length) {
      return aDomain.length - bDomain.length;
    }
    
    // Prefer shorter email addresses overall
    return a.length - b.length;
  });
  
  console.log(`[ENRICHMENT-AGENT] Found ${sortedEmails.length} total emails after filtering`);
  return sortedEmails;
}

// Extract phone numbers from content
function extractPhones(content: string): string[] {
  if (!content) return [];
  
  const phonePattern = /(?:\+1|1)?\s*\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/g;
  const matches = content.match(phonePattern) || [];
  
  return [...new Set(matches)];
}

// Extract venue capacity from content
function extractVenueCapacity(content: string): number | null {
  try {
    const capacityPattern = /(?:capacity|accommodate|up to|maximum)[^\d]*(\d+)[^\d]*(guest|people|person|attendee|seat)/i;
    const match = content.match(capacityPattern);
    
    if (match && match[1]) {
      const capacity = parseInt(match[1]);
      if (!isNaN(capacity) && capacity > 20 && capacity < 2000) {
        return capacity;
      }
    }
    return null;
  } catch (error) {
    console.error('[ENRICHMENT-AGENT] Error extracting venue capacity:', error);
    return null;
  }
}

// Extract event types from content
function extractEventTypes(content: string): string[] {
  const eventKeywords = [
    'wedding', 'corporate', 'meeting', 'social', 'party', 'conference',
    'celebration', 'ceremony', 'reception', 'seminar', 'retreat', 'gala'
  ];
  
  return eventKeywords
    .filter(keyword => content.toLowerCase().includes(keyword))
    .map(keyword => keyword.charAt(0).toUpperCase() + keyword.slice(1));
}

// Check for in-house catering
function checkForInHouseCatering(content: string): boolean {
  const lowerContent = content.toLowerCase();
  
  // Patterns suggesting in-house catering
  const inHousePatterns = [
    'in-house catering', 'our catering', 'catering services provided',
    'on-site catering', 'our chef', 'our culinary team'
  ];
  
  // Patterns suggesting outside catering
  const outsidePatterns = [
    'preferred caterers', 'approved caterers', 'outside catering',
    'select from our list of caterers', 'catering not provided'
  ];
  
  // Check for in-house patterns
  for (const pattern of inHousePatterns) {
    if (lowerContent.includes(pattern)) {
      return true;
    }
  }
  
  // Check for outside patterns
  for (const pattern of outsidePatterns) {
    if (lowerContent.includes(pattern)) {
      return false;
    }
  }
  
  // Default to null if unclear
  return false;
}

// Create fallback data when AI fails
function createFallbackData(leadInfo: any): EnrichmentData {
  return {
    venueName: leadInfo.name,
    website: leadInfo.website || '',
    eventManagerPhone: leadInfo.phone || '',
    eventManagerEmail: leadInfo.email || '',
    aiOverview: `${leadInfo.name} is a ${leadInfo.type || 'venue'} located at ${leadInfo.address || 'an unknown location'}.`,
    commonEventTypes: ['Wedding', 'Corporate', 'Social'],
    amenities: []
  };
}

// Calculate lead score
export function calculateLeadScore(enrichmentData: any) {
  let score = 0;
  const reasons: string[] = [];
  
  // Contact information (up to 35 points) - crucial for lead scoring
  if (enrichmentData.eventManagerEmail) {
    score += 25; // Higher weight for email
    reasons.push('Has contact email');
  }
  
  if (enrichmentData.eventManagerPhone) {
    score += 10;
    reasons.push('Has contact phone');
  }
  
  if (enrichmentData.eventManagerName) {
    score += 5;
    reasons.push('Has contact name');
  }
  
  // Event hosting capabilities (up to 30 points)
  if (enrichmentData.venueCapacity && enrichmentData.venueCapacity > 50) {
    score += 15;
    reasons.push(`Venue capacity: ${enrichmentData.venueCapacity}`);
  }
  
  if (enrichmentData.commonEventTypes && enrichmentData.commonEventTypes.length > 0) {
    score += 10;
    reasons.push(`Hosts events: ${enrichmentData.commonEventTypes.join(', ')}`);
  }
  
  if (enrichmentData.pricingInformation) {
    score += 5;
    reasons.push('Pricing information available');
  }
  
  // Catering relationship (up to 25 points)
  if (enrichmentData.inHouseCatering === false) {
    // Venues without in-house catering are better leads
    score += 25;
    reasons.push('No in-house catering (potential for partnership)');
  } else if (enrichmentData.inHouseCatering === true) {
    // Venues with in-house catering may still need backup
    score += 5;
    reasons.push('Has in-house catering');
  }
  
  // Website/data quality (up to 10 points)
  if (enrichmentData.website) {
    score += 5;
    reasons.push('Has functional website');
  }
  
  if (enrichmentData.aiOverview && enrichmentData.aiOverview.length > 100) {
    score += 5;
    reasons.push('Has detailed venue description');
  }
  
  // Cap score at 100
  score = Math.min(score, 100);
  
  // Determine potential level
  let potential: 'high' | 'medium' | 'low' = 'low';
  if (score >= 70) {
    potential = 'high';
  } else if (score >= 40) {
    potential = 'medium';
  }
  
  return {
    score,
    reasons,
    potential,
    lastCalculated: new Date().toISOString()
  };
}
