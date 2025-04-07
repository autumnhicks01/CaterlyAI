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
 * Enriches lead data with additional information
 */
export async function enrichLeadData(lead: any, websiteContent?: string) {
  if (!lead) {
    return { success: false, error: "No lead data provided" };
  }
  
  console.log(`Enriching lead: ${lead.name || lead.company}`);
  
  let prompt = `
    Enrich the following business lead with additional information relevant for catering services:
    
    Business Name: ${lead.name || lead.company}
    Address: ${lead.address || 'Not provided'}
    Website: ${lead.website || lead.contact?.website || 'Not provided'}
    Type: ${lead.type || lead.category || 'Business'}
  `;
  
  // Add website content if available
  if (websiteContent) {
    prompt += `\n\nWebsite Content (extracted from ${lead.website || lead.contact?.website}):\n${websiteContent}`;
  }
  
  prompt += `
    
    Based on this information, provide enrichment data in the format specified in your instructions.
    If certain information is not available, make reasonable estimates based on similar businesses.
    Be sure to calculate a lead score indicating the potential value as a catering client.
  `;
  
  const response = await enrichmentAgent.generate([
    { role: "user", content: prompt }
  ]);
  
  try {
    // Parse the response to get the enrichment data
    const responseText = response.text;
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || 
                     responseText.match(/```\n([\s\S]*?)\n```/) || 
                     [null, responseText];
    
    const jsonText = jsonMatch[1] || responseText;
    const enrichmentData = JSON.parse(jsonText);
    
    return {
      success: true,
      enrichmentData,
      leadId: lead.id
    };
  } catch (error) {
    console.error("Error parsing enrichment data:", error);
    return { 
      success: false, 
      error: "Failed to parse enrichment data",
      leadId: lead.id
    };
  }
}

/**
 * Calculates a lead score based on enrichment data
 */
export function calculateLeadScore(enrichmentData: any) {
  let score = 0;
  const reasons: string[] = [];
  
  // Contact information (up to 30 points)
  if (enrichmentData.eventManagerEmail) {
    score += 15;
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