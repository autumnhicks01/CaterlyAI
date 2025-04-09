import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";

// Lead enrichment agent for enhancing lead data
export const enrichmentAgent = new Agent({
  name: "Lead Enrichment Agent",
  instructions: `
    You are a business analyst specializing in catering industry lead enrichment.
    Your expertise is in analyzing business data to determine potential catering
    clients, with a focus on venues, event spaces, and corporations.
    
    When analyzing leads:
    1. Extract and verify key business details from website content
    2. Identify event hosting capabilities and facilities
    3. Determine the types of events typically hosted
    4. Assess catering requirements and preferences
    5. Evaluate lead quality for catering services
    
    IMPORTANT: Preserve any accurate information already provided in the lead data.
    Don't overwrite the following fields if they already have valid data:
    - Business name (use the exact name provided)
    - Contact information (phone, email)
    - Website URL 
    - Address
    
    Provide the following structured information:
    - venueName: [Formal business name]
    - aiOverview: [2-3 sentence business description]
    - eventManagerName: [Event coordinator name if available]
    - eventManagerEmail: [Contact email]
    - eventManagerPhone: [Contact phone]
    - commonEventTypes: [Array of event types hosted]
    - inHouseCatering: [Boolean indicating if they have in-house catering]
    - venueCapacity: [Estimated capacity number]
    - amenities: [Array of venue amenities]
    - pricingInformation: [Any pricing data found]
    - preferredCaterers: [Array of any mentioned preferred caterers]
    - website: [Website URL]
    - leadScore: {
        score: [Numerical score 0-100],
        reasons: [Array of factors affecting score],
        potential: ["high", "medium", or "low"],
        lastCalculated: [Timestamp]
      }
  `,
  model: openai("gpt-4o"),
});

/**
 * Interface for enrichment data
 */
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
  websiteContent?: string;
  leadScore?: {
    score: number;
    reasons: string[];
    potential: 'high' | 'medium' | 'low';
    lastCalculated: string;
  };
  [key: string]: any; // Allow for additional properties
}

/**
 * Enriches lead data with additional information
 */
export async function enrichLeadData(lead: any, websiteContent?: string) {
  if (!lead) {
    return { success: false, error: "No lead data provided" };
  }
  
  // Preserve existing data to avoid duplicating work
  const existingData = {
    name: lead.name || lead.company,
    address: lead.address,
    website: lead.website_url || lead.website || lead.contact?.website,
    phone: lead.contact_phone || lead.contact?.phone || lead.phone,
    email: lead.contact_email || lead.contact?.email,
    type: lead.type || lead.category || 'Business'
  };
  
  try {
    // Create prompt for the agent
    let prompt = createEnrichmentPrompt(existingData, 
      websiteContent ? truncateText(websiteContent, 15000) : undefined);
    
    // Generate enrichment data
    const response = await enrichmentAgent.generate([
      { role: "user", content: prompt }
    ]);
    
    // Parse the response
    let enrichmentData = parseAgentResponse(response.text, existingData);
    
    // Extract additional data from website content if needed
    enrichmentData = extractDataFromContent(websiteContent, enrichmentData, existingData);
    
    // Ensure we have proper business_id
    enrichmentData.business_id = lead.id ? 
      `web_${Date.now()}_${lead.id.substring(0, 5)}` : 
      `web_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    
    // Calculate lead score if missing
    if (!enrichmentData.leadScore) {
      enrichmentData.leadScore = calculateLeadScore(enrichmentData);
    }
    
    // Ensure all required fields exist 
    enrichmentData = normalizeEnrichmentData(enrichmentData, lead);
    
    // Extract Firecrawl data if available in the lead object
    if (lead.firecrawl_data || lead.extractedData) {
      const firecrawlData = lead.firecrawl_data || lead.extractedData;
      enrichmentData.firecrawlExtracted = firecrawlData;
      
      // Copy any useful data from firecrawl into the main object if missing
      if (firecrawlData) {
        // Contact information
        if (firecrawlData.contactInformation) {
          if (firecrawlData.contactInformation.email && !enrichmentData.eventManagerEmail) {
            enrichmentData.eventManagerEmail = firecrawlData.contactInformation.email;
          }
          if (firecrawlData.contactInformation.phone && !enrichmentData.eventManagerPhone) {
            enrichmentData.eventManagerPhone = firecrawlData.contactInformation.phone;
          }
          if (firecrawlData.contactInformation.contactPersonName && !enrichmentData.eventManagerName) {
            enrichmentData.eventManagerName = firecrawlData.contactInformation.contactPersonName;
          }
        }
        
        // Venue details
        if (firecrawlData.amenities && (!enrichmentData.amenities || enrichmentData.amenities.length === 0)) {
          enrichmentData.amenities = firecrawlData.amenities;
        }
        
        if (firecrawlData.eventTypes && (!enrichmentData.commonEventTypes || enrichmentData.commonEventTypes.length === 0)) {
          enrichmentData.commonEventTypes = firecrawlData.eventTypes;
        }
        
        if (firecrawlData.venueCapacity && !enrichmentData.venueCapacity) {
          enrichmentData.venueCapacity = firecrawlData.venueCapacity;
        }
        
        if (firecrawlData.preferredCaterers && (!enrichmentData.preferredCaterers || enrichmentData.preferredCaterers.length === 0)) {
          enrichmentData.preferredCaterers = firecrawlData.preferredCaterers;
        }
        
        if (firecrawlData.inHouseCatering !== undefined && enrichmentData.inHouseCatering === undefined) {
          enrichmentData.inHouseCatering = firecrawlData.inHouseCatering;
        }
        
        // Update description if we have something better
        if (firecrawlData.description && (!enrichmentData.description || enrichmentData.description.length < 100)) {
          enrichmentData.description = firecrawlData.description;
        }
      }
    }
    
    // Create or enhance description if needed
    if (!enrichmentData.description && websiteContent) {
      // Extract a good description from website content
      const extractedDescription = generateDescriptionFromContent(existingData.name, existingData.type, existingData.address, websiteContent);
      if (extractedDescription) {
        enrichmentData.description = extractedDescription;
      }
    }
    
    // Store website content in a safe way
    if (websiteContent) {
      enrichmentData.websiteContent = truncateText(websiteContent, 2000);
    }

    // Add timestamp
    enrichmentData.lastUpdated = new Date().toISOString();
    
    return {
      success: true,
      enrichmentData,
      leadId: lead.id
    };
  } catch (error) {
    return createFallbackResponse(error, existingData, lead.id, websiteContent);
  }
}

/**
 * Creates the enrichment prompt for the LLM
 */
function createEnrichmentPrompt(existingData: any, websiteContent?: string): string {
  let prompt = `You are a business research specialist who helps extract valuable information about catering businesses.
I'll give you information about a catering business, and I need you to extract and verify key details.

${websiteContent ? 'I have a website extract for this business which you should use as your primary information source:' : 'I\'m sorry, but I don\'t have website content for this business yet, so you must work with the provided data.'}

${websiteContent ? '### WEBSITE CONTENT ###\n' + websiteContent + '\n### END WEBSITE CONTENT ###\n\n' : ''}

Here's what I already know about this business:
Name: ${existingData.name || existingData.business_name || 'Unknown'}
${existingData.description ? 'Description: ' + existingData.description : ''}
${existingData.phone ? 'Phone: ' + existingData.phone : ''}
${existingData.address ? 'Address: ' + existingData.address : ''}
${existingData.city ? 'City: ' + existingData.city : ''}
${existingData.state ? 'State: ' + existingData.state : ''}
${existingData.zip_code ? 'Zip: ' + existingData.zip_code : ''}
${existingData.website ? 'Website: ' + existingData.website : ''}
${existingData.website_url ? 'Website URL: ' + existingData.website_url : ''}
${existingData.email ? 'Email: ' + existingData.email : ''}
${existingData.enrichment_data && existingData.enrichment_data.email ? 'Contact Email: ' + existingData.enrichment_data.email : ''}
${existingData.enrichment_data && existingData.enrichment_data.contact_name ? 'Contact Name: ' + existingData.enrichment_data.contact_name : ''}

${websiteContent ? 'I need you to carefully analyze the website content to extract the following information:' : 'Based on the limited information I have, please provide the best assessment of the following:'}

1. Emails - VERY IMPORTANT: Search for email addresses in the website content. Common formats include:
   - name@domain.com
   - contact@domain.com
   - info@domain.com
   - catering@domain.com
   - events@domain.com
   - sales@domain.com
   Look in contact sections, footer, header, and about pages. Prioritize finding contact/sales emails.

2. Event types they cater (weddings, corporate, etc)
3. Venue capacity (how many guests they can accommodate)
4. Catering options (buffet, family style, etc)
5. Amenities offered (outdoor space, parking, etc)
6. Pricing information (if available)
7. Additional contact info (phone numbers, address)

${!websiteContent ? 'Since I don\'t have website content, focus on what can be reasonably inferred from the business name and any other provided information. For missing data, indicate "Not found in provided information".' : ''}

Your response MUST be valid JSON in the following format:
{
  "website": "the website URL if found, or the original URL if provided",
  "description": "concise overview of the business (1-2 sentences max)",
  "contact_name": "main contact person name if found",
  "contact_phone": "main contact phone if found",
  "contact_email": "primary email for reaching the business - THIS IS CRITICAL",
  "event_types": ["list", "of", "event", "types"],
  "venue_capacity": "capacity details if found",
  "catering_options": ["list", "of", "options"],
  "amenities": ["list", "of", "amenities"],
  "pricing_info": "pricing information if found"
}

IMPORTANT INSTRUCTIONS:
1. ALWAYS include any contact emails you find in the "contact_email" field, as this is critical data.
2. If you can't find specific information, use "Not available" for that field.
3. Keep descriptions brief (1-2 sentences maximum).
4. Only include information you're confident about - don't make assumptions.
5. Your response must be valid JSON - no markdown or additional text.`;
  
  // Add website content if available
  if (websiteContent) {
    prompt = prompt + `\n\nWebsite Content (extracted from ${existingData.website}):\n${websiteContent}`;
    
    // Add specific instruction to search for emails in the content
    prompt = prompt + `
    
    IMPORTANT: Search the website content carefully for any email addresses.
    Common formats to look for:
    - events@venuename.com
    - sales@venuename.com
    - info@venuename.com
    - eventplanning@venuename.com
    - firstname.lastname@venuename.com
    - Any email addresses on contact pages
    `;
  } else {
    prompt = prompt + `\n\nNo website content was extracted. Please focus on the existing data provided.`;
  }
  
  // Add response format guidelines
  prompt = prompt + `
    
    Based on this information, provide enrichment data in the format specified in your instructions.
    Use the existing data as is, and only supplement with missing information.
    Focus on finding event details, capacity, amenities, contact emails, and calculating a lead score.
    
    If you find contact emails, be sure to include them in the eventManagerEmail field.
    Without contact information, particularly email, the lead is much less valuable.
    
    IMPORTANT: Make sure your response is valid JSON.
  `;
  
  return prompt;
}

/**
 * Parse the LLM response and extract the enrichment data
 */
function parseAgentResponse(responseText: string, existingData: any): any {
  try {
    // Try to extract JSON from code blocks
    const jsonMatch = responseText.match(/```(?:json)?\n([\s\S]*?)\n```/) || 
                    responseText.match(/```\n([\s\S]*?)\n```/) || 
                    [null, responseText];
    
    const jsonText = jsonMatch ? jsonMatch[1].trim() : responseText.trim();
    return JSON.parse(jsonText);
  } catch (firstError) {
    try {
      // Second attempt: Try to find JSON object directly in the text
      const jsonRegex = /\{[\s\S]*\}/;
      const jsonMatch = responseText.match(jsonRegex);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (secondError) {
      // Return minimal data object on failure
      return {
        venueName: existingData.name,
        website: existingData.website,
        eventManagerPhone: existingData.phone,
        eventManagerEmail: existingData.email,
        aiOverview: `${existingData.name} is a ${existingData.type.toLowerCase()} located at ${existingData.address || 'unknown location'}.`,
      };
    }
  }
}

/**
 * Create a fallback response for error cases
 */
function createFallbackResponse(error: any, existingData: any, leadId: string, websiteContent?: string) {
  let fallbackData: any = {
    venueName: existingData.name,
    website: existingData.website,
    eventManagerPhone: existingData.phone,
    eventManagerEmail: existingData.email,
    business_id: `web_${Date.now()}_${(leadId || '').substring(0, 5) || Math.random().toString(36).substring(2, 7)}`,
  };
  
  // Try to extract as much useful data as possible from the website content
  if (websiteContent && websiteContent.length > 200) {
    try {
      // Extract a description
      const extractedDescription = generateDescriptionFromContent(
        existingData.name,
        existingData.type,
        existingData.address,
        websiteContent
      );
      
      if (extractedDescription) {
        fallbackData.aiOverview = extractedDescription;
        fallbackData.description = extractedDescription;
      } else {
        fallbackData.aiOverview = `${existingData.name} is a ${existingData.type.toLowerCase()} located at ${existingData.address || 'unknown location'}.`;
      }
      
      // Extract event types
      const eventTypes = extractEventTypes(websiteContent);
      if (eventTypes.length > 0) {
        fallbackData.commonEventTypes = eventTypes;
      }
      
      // Extract capacity
      const capacity = extractCapacity(websiteContent);
      if (capacity > 0) {
        fallbackData.venueCapacity = capacity;
      }
      
      // Extract catering information
      const cateringInfo = extractCateringInfo(websiteContent);
      fallbackData.inHouseCatering = cateringInfo.inHouse;
      if (cateringInfo.preferredCaterers.length > 0) {
        fallbackData.preferredCaterers = cateringInfo.preferredCaterers;
      }
      
      // Extract amenities
      const amenities = extractAmenities(websiteContent);
      if (amenities.length > 0) {
        fallbackData.amenities = amenities;
      }
      
      // Extract emails if not already present
      if (!fallbackData.eventManagerEmail) {
        const emails = extractEmails(websiteContent);
        if (emails.length > 0) {
          fallbackData.eventManagerEmail = emails[0];
        }
      }
      
      // Include a sample of the content for verification
      fallbackData.websiteContent = truncateText(websiteContent, 2000);
    } catch (extractError) {
      console.error('Error extracting data from website content for fallback:', extractError);
      
      // Still provide a basic overview
      fallbackData.aiOverview = `${existingData.name} is a ${existingData.type.toLowerCase()} located at ${existingData.address || 'unknown location'}.`;
    }
  } else {
    // No website content, use a generic overview
    fallbackData.aiOverview = `${existingData.name} is a ${existingData.type.toLowerCase()} located at ${existingData.address || 'unknown location'}.`;
  }
  
  // Calculate a basic lead score
  const hasWebsite = Boolean(fallbackData.website);
  const hasEmail = Boolean(fallbackData.eventManagerEmail);
  const hasPhone = Boolean(fallbackData.eventManagerPhone);
  
  const score = Math.min(30 + (hasWebsite ? 10 : 0) + (hasEmail ? 30 : 0) + (hasPhone ? 15 : 0), 100);
  
  let potential = 'low';
  if (score >= 70) potential = 'high';
  else if (score >= 50) potential = 'medium';
  
  fallbackData.leadScore = {
    score: score,
    reasons: [
      "Partial enrichment due to error",
      hasWebsite ? "Has website" : "No website",
      hasEmail ? "Has email contact" : "No email contact",
      hasPhone ? "Has phone contact" : "No phone contact"
    ],
    potential: potential,
    lastCalculated: new Date().toISOString()
  };
  
  // Add timestamp
  fallbackData.lastUpdated = new Date().toISOString();
  
  return { 
    success: true, // Still return success to prevent workflow failure
    enrichmentData: fallbackData,
    leadId: leadId,
    partialEnrichment: true,
    error: error instanceof Error ? error.message : "Unknown error during enrichment"
  };
}

/**
 * Truncate text to a maximum length
 */
function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "... [Content truncated]";
}

/**
 * Extract additional data from website content and combine with enrichment data
 */
function extractDataFromContent(websiteContent: string | undefined, enrichmentData: any, existingData: any): EnrichmentData {
  // If no website content, return the enrichment data as is
  if (!websiteContent) return enrichmentData;
  
  const content = websiteContent.toLowerCase();
  const result = { ...enrichmentData };
  
  // Extract event types if not already present
  if (!result.commonEventTypes || result.commonEventTypes.length === 0) {
    const eventTypes = extractEventTypes(content);
    if (eventTypes.length > 0) {
      result.commonEventTypes = eventTypes;
    }
  }
  
  // Extract venue capacity if not already present
  if (!result.venueCapacity) {
    const capacity = extractCapacity(content);
    if (capacity > 0) {
      result.venueCapacity = capacity;
    }
  }
  
  // Extract catering information if not already present
  if (result.inHouseCatering === undefined) {
    const cateringInfo = extractCateringInfo(content);
    result.inHouseCatering = cateringInfo.inHouse;
    if (cateringInfo.preferredCaterers.length > 0 && !result.preferredCaterers) {
      result.preferredCaterers = cateringInfo.preferredCaterers;
    }
  }
  
  // Extract amenities if not already present
  if (!result.amenities || (Array.isArray(result.amenities) && result.amenities.length === 0)) {
    const amenities = extractAmenities(content);
    if (amenities.length > 0) {
      result.amenities = amenities;
    }
  }
  
  // Extract pricing information if not already present
  if (!result.pricingInformation) {
    const pricing = extractPricing(content);
    if (pricing) {
      result.pricingInformation = pricing;
    }
  }
  
  // Extract contact info if not already present
  if (!result.eventManagerEmail && !existingData.email) {
    const emails = extractEmails(websiteContent);
    if (emails.length > 0) {
      result.eventManagerEmail = emails[0];
    }
  }
  
  // Ensure existing data is preserved
  result.venueName = existingData.name;
  result.website = existingData.website || result.website;
  result.eventManagerPhone = existingData.phone || result.eventManagerPhone;
  result.eventManagerEmail = existingData.email || result.eventManagerEmail;
  
  return result;
}

/**
 * Extract event types from content
 */
function extractEventTypes(content: string): string[] {
  const eventTypeKeywords = [
    'wedding', 'weddings', 'corporate', 'meeting', 'meetings', 'social', 
    'party', 'parties', 'conference', 'celebration', 'ceremony', 'reception',
    'gala', 'retreat', 'seminar', 'workshop'
  ];
  
  return eventTypeKeywords
    .filter(keyword => content.includes(keyword))
    .map(type => type.charAt(0).toUpperCase() + type.slice(1));
}

/**
 * Extract venue capacity from content
 */
function extractCapacity(content: string): number {
  const capacityRegex = /(?:capacity|accommodate|up to|maximum)[^\d]*(\d+)[^\d]*(guest|people|person|attendee|seat)/i;
  const match = content.match(capacityRegex);
  
  if (match && match[1]) {
    const capacity = parseInt(match[1]);
    if (!isNaN(capacity) && capacity > 0) {
      return capacity;
    }
  }
  return 0;
}

/**
 * Extract catering information from content
 */
function extractCateringInfo(content: string): { inHouse: boolean | undefined, preferredCaterers: string[] } {
  const inHouseMatches = /(?:in[-\s]house|on[-\s]site|our own|provided by us|exclusive)\s+(?:catering|caterer|food|menu)/i.test(content);
  const externalMatches = /(?:outside|external|bring your own|your choice of|preferred)\s+(?:catering|caterer|food|vendor)/i.test(content);
  
  let inHouse: boolean | undefined = undefined;
  if (inHouseMatches && !externalMatches) {
    inHouse = true;
  } else if (externalMatches && !inHouseMatches) {
    inHouse = false;
  }
  
  let preferredCaterers: string[] = [];
  if (externalMatches) {
    const preferredCaterersRegex = /(?:preferred|approved|recommended)\s+caterers?(?:\s+include)?(?:\s*:)?\s*((?:[^.]*?,\s*)*[^.]*)/i;
    const preferredMatch = content.match(preferredCaterersRegex);
    
    if (preferredMatch && preferredMatch[1]) {
      preferredCaterers = preferredMatch[1]
        .split(/,|;|and/)
        .map(c => c.trim())
        .filter(c => c.length > 2);
    }
  }
  
  return { inHouse, preferredCaterers };
}

/**
 * Extract amenities from content
 */
function extractAmenities(content: string): string[] {
  const amenitiesRegex = /(?:amenities|features|facilities|services|included)(?:\s+include)?(?:\s*:)?\s*((?:[^.]*?,\s*)*[^.]*)/i;
  const amenitiesMatch = content.match(amenitiesRegex);
  
  if (amenitiesMatch && amenitiesMatch[1]) {
    return amenitiesMatch[1]
      .split(/,|;|and|\n/)
      .map(a => a.trim())
      .filter(a => a.length > 2 && a.length < 50);
  }
  return [];
}

/**
 * Extract pricing information from content
 */
function extractPricing(content: string): string | undefined {
  const pricingRegex = /(?:pricing|packages|rates|fees|cost)(?:\s+information)?(?:\s*:)?\s*([^.]{5,200})/i;
  const pricingMatch = content.match(pricingRegex);
  
  if (pricingMatch && pricingMatch[1]) {
    return pricingMatch[1].trim();
  }
  return undefined;
}

/**
 * Extract emails from content
 */
function extractEmails(content: string): string[] {
  if (!content) return [];
  
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const matches = content.match(emailPattern) || [];
  
  return [...new Set(matches)].filter(email => {
    // Skip common false positives
    if (email.includes('example.com') || 
        email.includes('yourdomain.com') || 
        email.includes('domain.com') || 
        email.includes('email@')) {
      return false;
    }
    return true;
  });
}

/**
 * Calculate lead score based on enrichment data
 */
export function calculateLeadScore(enrichmentData: any) {
  let score = 0;
  const reasons: string[] = [];
  
  // Contact information (up to 35 points)
  if (enrichmentData.eventManagerEmail) {
    score += 15;
    reasons.push('Has contact email');
  }
  
  if (enrichmentData.eventManagerPhone) {
    score += 10;
    reasons.push('Has contact phone');
  }
  
  if (enrichmentData.eventManagerName) {
    score += 10;
    reasons.push('Has contact name');
  }
  
  // Event hosting capabilities (up to 35 points)
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
  
  // Catering relationship (up to 40 points)
  if (enrichmentData.inHouseCatering === false) {
    // Venues without in-house catering are better leads
    score += 25;
    reasons.push('No in-house catering (potential for partnership)');
  } else if (enrichmentData.inHouseCatering === true) {
    // Venues with in-house catering may still need backup
    score += 5;
    reasons.push('Has in-house catering');
  }
  
  if (enrichmentData.preferredCaterers && 
      enrichmentData.preferredCaterers.length > 0 && 
      enrichmentData.preferredCaterers.length < 5) {
    // Venues with a short list of preferred caterers may be open to additions
    score += 15;
    reasons.push('Has a short list of preferred caterers');
  }
  
  // Website/data quality (up to 15 points)
  if (enrichmentData.website) {
    score += 5;
    reasons.push('Has functional website');
  }
  
  if (enrichmentData.aiOverview && enrichmentData.aiOverview.length > 100) {
    score += 5;
    reasons.push('Has detailed venue description');
  }
  
  if (enrichmentData.amenities && 
     ((Array.isArray(enrichmentData.amenities) && enrichmentData.amenities.length > 0) ||
      (typeof enrichmentData.amenities === 'string' && enrichmentData.amenities.length > 0))) {
    score += 5;
    reasons.push('Lists venue amenities');
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

/**
 * Batch enriches multiple leads with streaming updates
 */
export async function batchEnrichLeadsWithStreaming(leads: any[]) {
  if (!leads || leads.length === 0) {
    return { success: false, error: "No leads provided" };
  }
  
  console.log(`Batch enriching ${leads.length} leads`);
  
  // This is a placeholder for streaming - in a real implementation,
  // you would create a custom stream to provide progress updates
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`Starting enrichment of ${leads.length} leads...\n`));
        
        const results = [];
        for (let i = 0; i < leads.length; i++) {
          const lead = leads[i];
          controller.enqueue(encoder.encode(`Processing lead ${i+1}/${leads.length}: ${lead.name || lead.company}...\n`));
          
          const result = await enrichLeadData(lead);
          results.push(result);
          
          controller.enqueue(encoder.encode(`Completed lead ${i+1}/${leads.length} with ${result.success ? 'success' : 'failure'}\n`));
        }
        
        controller.enqueue(encoder.encode(`Enrichment complete. Successful: ${results.filter(r => r.success).length}, Failed: ${results.filter(r => !r.success).length}\n`));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    }
  });
  
  return {
    success: true,
    stream
  };
}

/**
 * Normalize enrichment data to ensure all fields are present
 */
function normalizeEnrichmentData(data: any, lead: any): any {
  const normalized = { ...data };

  // Ensure venueName exists
  normalized.venueName = normalized.venueName || lead.name || lead.company || 'Unnamed Venue';
  
  // Ensure website exists
  normalized.website = normalized.website || lead.website_url || lead.website || '';
  
  // Ensure address exists
  normalized.address = normalized.address || lead.address || '';
  
  // Ensure aiOverview exists - generate a basic one if missing
  if (!normalized.aiOverview || normalized.aiOverview.length < 50) {
    normalized.aiOverview = `${normalized.venueName} is a ${lead.type || 'venue'} located at ${normalized.address || 'an unknown address'}`;
    if (normalized.commonEventTypes && normalized.commonEventTypes.length > 0) {
      normalized.aiOverview += ` that specializes in hosting ${normalized.commonEventTypes.join(', ')} events`;
    }
    if (normalized.inHouseCatering !== undefined) {
      normalized.aiOverview += normalized.inHouseCatering ? 
        '. In-house catering services are available to simplify event planning.' : 
        '. Outside catering options are available.';
    }
    if (normalized.preferredCaterers && normalized.preferredCaterers.length > 0) {
      normalized.aiOverview += ` Preferred caterers include: ${normalized.preferredCaterers.join(', ')}.`;
    }
    if (normalized.amenities && normalized.amenities.length > 0) {
      normalized.aiOverview += ` Amenities include ${Array.isArray(normalized.amenities) ? normalized.amenities.join(', ') : normalized.amenities}.`;
    }
    if (normalized.eventManagerPhone || lead.contact_phone) {
      normalized.aiOverview += ` For more information, can be reached at ${normalized.eventManagerPhone || lead.contact_phone}.`;
    }
    normalized.aiOverview += ` Visit their website at ${normalized.website} for more details.`;
  }
  
  // Ensure description exists (separate from aiOverview)
  if (!normalized.description) {
    normalized.description = `${normalized.venueName} is a ${lead.type || 'venue'} in ${lead.city || 'the local area'}, offering spaces for ${normalized.commonEventTypes ? normalized.commonEventTypes.join(', ') : 'various events'}.`;
  }
  
  // Ensure additionalDetails exists
  normalized.additionalDetails = normalized.additionalDetails || '';
  
  // Ensure contact information exists
  normalized.eventManagerName = normalized.eventManagerName || lead.contact_name || '';
  normalized.eventManagerEmail = normalized.eventManagerEmail || lead.contact_email || '';
  normalized.eventManagerPhone = normalized.eventManagerPhone || lead.contact_phone || '';
  
  // Ensure arrays are arrays
  if (normalized.commonEventTypes && !Array.isArray(normalized.commonEventTypes)) {
    normalized.commonEventTypes = normalized.commonEventTypes.split(',').map((s: string) => s.trim());
  } else if (!normalized.commonEventTypes) {
    normalized.commonEventTypes = [];
  }
  
  if (normalized.amenities && !Array.isArray(normalized.amenities)) {
    normalized.amenities = normalized.amenities.split(',').map((s: string) => s.trim());
  } else if (!normalized.amenities) {
    normalized.amenities = [];
  }
  
  if (normalized.preferredCaterers && !Array.isArray(normalized.preferredCaterers)) {
    normalized.preferredCaterers = normalized.preferredCaterers.split(',').map((s: string) => s.trim());
  } else if (!normalized.preferredCaterers) {
    normalized.preferredCaterers = [];
  }
  
  // Create firecrawlExtracted if it doesn't exist
  if (!normalized.firecrawlExtracted) {
    normalized.firecrawlExtracted = {
      venueName: normalized.venueName,
      physicalAddress: normalized.address,
      eventTypes: normalized.commonEventTypes,
      inHouseCatering: normalized.inHouseCatering,
      venueCapacity: normalized.venueCapacity,
      amenities: normalized.amenities,
      preferredCaterers: normalized.preferredCaterers,
      contactInformation: {
        email: normalized.eventManagerEmail,
        phone: normalized.eventManagerPhone,
        contactPersonName: normalized.eventManagerName
      },
      managementContact: {
        managementContactName: normalized.eventManagerName,
        managementContactEmail: normalized.eventManagerEmail,
        managementContactPhone: normalized.eventManagerPhone
      },
      pricingInformation: normalized.pricingInformation || ''
    };
  }
  
  return normalized;
}

/**
 * Generate a better description from website content
 */
function generateDescriptionFromContent(name: string, type: string, address: string = '', content: string): string | null {
  if (!content || content.length < 200) return null;
  
  try {
    // Clean the content
    const cleanContent = content
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 3000);
    
    // Extract potential description sentences
    const sentences = cleanContent.split(/[.!?]+/);
    
    // Look for good description sentences
    const goodSentences = sentences
      .filter(s => s.length > 30 && s.length < 200)
      .filter(s => {
        const lower = s.toLowerCase();
        return (
          lower.includes('venue') ||
          lower.includes('event') ||
          lower.includes('wedding') ||
          lower.includes('host') ||
          lower.includes('celebrate') ||
          lower.includes('space') ||
          lower.includes('location') ||
          lower.includes('facility') ||
          lower.includes('accommodate') ||
          lower.includes('perfect') ||
          lower.includes('elegant') ||
          lower.includes('beautiful')
        );
      });
    
    // Sort by relevance
    goodSentences.sort((a, b) => {
      const aScore = calculateSentenceScore(a);
      const bScore = calculateSentenceScore(b);
      return bScore - aScore;
    });
    
    // Combine into description
    const selectedSentences = goodSentences.slice(0, 2);
    
    if (selectedSentences.length === 0) {
      // Fallback to first non-empty sentence if we didn't find any good ones
      const firstSentence = sentences.find(s => s.trim().length > 30) || '';
      if (firstSentence.length > 0) {
        selectedSentences.push(firstSentence);
      }
    }
    
    // Create venue type description
    const typeDesc = type.toLowerCase() === 'venue' ? 'venue' : `${type.toLowerCase()} venue`;
    
    // Create address description
    const addressDesc = address ? `located at ${address}` : '';
    
    // Look for event types in content
    const eventTypes = extractEventTypes(cleanContent);
    const eventTypeDesc = eventTypes.length > 0 
      ? `specializing in ${eventTypes.slice(0, 3).join(', ')} events` 
      : 'offering event spaces';
    
    // Create the final description
    const baseDesc = `${name} is a ${typeDesc} ${addressDesc} ${eventTypeDesc}.`;
    
    if (selectedSentences.length > 0) {
      return `${baseDesc} ${selectedSentences.map(s => s.trim()).join(' ')}`;
    }
    
    return baseDesc;
  } catch (error) {
    console.warn('Error generating description from content:', error);
    return null;
  }
}

/**
 * Calculate a relevance score for a sentence
 */
function calculateSentenceScore(sentence: string): number {
  const lower = sentence.toLowerCase();
  let score = 0;
  
  // Relevance keywords and their weights
  const keywords = {
    'venue': 5,
    'wedding': 4,
    'event': 4,
    'corporate': 3,
    'ceremony': 3,
    'reception': 3,
    'celebrate': 3,
    'host': 3,
    'space': 2,
    'beautiful': 2,
    'elegant': 2,
    'perfect': 2,
    'charming': 2,
    'historic': 2,
    'modern': 2,
    'luxury': 2,
    'amenities': 2,
    'features': 1,
    'located': 1,
    'setting': 1,
    'offers': 1
  };
  
  // Add score for each keyword
  Object.entries(keywords).forEach(([keyword, weight]) => {
    if (lower.includes(keyword)) {
      score += weight;
    }
  });
  
  // Adjust for sentence length
  if (sentence.length > 40 && sentence.length < 150) {
    score += 2; // Ideal length
  } else if (sentence.length > 150) {
    score -= 1; // Too long
  }
  
  return score;
} 