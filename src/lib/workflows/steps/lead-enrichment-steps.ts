import { z } from 'zod';
import { Step } from '../core';
import { createClient } from '@/lib/supabase/server';
import { Lead, EnrichmentData, leadSchema } from '../schemas/common';

/**
 * Input schema for the fetch leads step
 */
const fetchLeadsInputSchema = z.object({
  leadIds: z.array(z.string())
});

/**
 * Step to fetch leads from the database
 */
export const fetchLeadsStep = new Step({
  id: 'fetch-leads',
  description: 'Fetch leads from the database',
  inputSchema: fetchLeadsInputSchema,
  execute: async ({ input }) => {
    if (!input?.leadIds || input.leadIds.length === 0) {
      throw new Error('No lead IDs provided');
    }
    
    console.log(`Fetching ${input.leadIds.length} leads from the database`);
    
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('saved_leads')
        .select('*')
        .in('id', input.leadIds);
      
      if (error) {
        throw new Error(`Error fetching leads: ${error.message}`);
      }
      
      if (!data || data.length === 0) {
        throw new Error('No leads found with the provided IDs');
      }
      
      // Validate the lead data against our schema
      const leads = data.map(lead => leadSchema.parse(lead));
      
      console.log(`Successfully fetched ${leads.length} leads`);
      return { leads };
    } catch (error) {
      console.error('Error in fetchLeadsStep:', error);
      throw error;
    }
  }
});

/**
 * Step to extract website data for leads
 */
export const extractWebsiteDataStep = new Step({
  id: 'extract-website-data',
  description: 'Extract data from lead websites',
  execute: async ({ context }) => {
    const { leads } = context.getStepResult<{ leads: Lead[] }>('fetch-leads') || { leads: [] };
    
    if (!leads || leads.length === 0) {
      throw new Error('No leads available for website extraction');
    }
    
    console.log(`Extracting website data for ${leads.length} leads`);
    
    // Import the firecrawl tool dynamically to avoid circular dependencies
    const { firecrawlTool } = await import('@/lib/ai/tools/FirecrawlTool');
    
    // Extract data from each lead's website
    const enrichmentResults = await Promise.all(
      leads.map(async (lead) => {
        if (!lead.website_url) {
          console.log(`No website URL for lead ${lead.id}, skipping extraction`);
          return {
            leadId: lead.id,
            success: false,
            error: 'No website URL available',
            lead
          };
        }
        
        console.log(`Extracting data from ${lead.website_url} for lead ${lead.id}`);
        
        try {
          const extractionResult = await firecrawlTool.extract({
            url: lead.website_url,
            timeout: 30000,
            waitTime: 5000,
            enableWebSearch: true
          });
          
          if (!extractionResult.success) {
            console.error(`Extraction failed for ${lead.website_url}: ${extractionResult.error}`);
            return {
              leadId: lead.id,
              success: false,
              error: extractionResult.error,
              lead
            };
          }
          
          return {
            leadId: lead.id,
            websiteData: extractionResult.data,
            success: true,
            lead
          };
        } catch (error) {
          console.error(`Error extracting from ${lead.website_url}:`, error);
          return {
            leadId: lead.id,
            success: false,
            error: error instanceof Error ? error.message : String(error),
            lead
          };
        }
      })
    );
    
    const successful = enrichmentResults.filter(r => r.success).length;
    const failed = enrichmentResults.filter(r => !r.success).length;
    
    console.log(`Website extraction complete: ${successful} successful, ${failed} failed`);
    
    return { enrichmentResults };
  }
});

/**
 * Process the extracted data to create enrichment data
 */
function processExtractedData(data: any, leadName: string): { 
  enrichmentData: EnrichmentData;
  address?: string;
} {
  console.log(`Processing extracted data for ${leadName}`);
  
  const enrichmentData: EnrichmentData = {};
  let extractedAddress: string | undefined;
  
  try {
    // Extract address if available
    if (data.address) {
      extractedAddress = data.address;
    }
    
    const dataObj = data;
    
    // Extract venue name
    if (dataObj.venue_name) {
      enrichmentData.venueName = dataObj.venue_name;
    }
    
    // Extract description for overview
    if (dataObj.description) {
      enrichmentData.aiOverview = dataObj.description;
    }
    
    // Extract contact information
    if (dataObj.contact_name) {
      enrichmentData.eventManagerName = dataObj.contact_name;
    }
    
    if (dataObj.contact_email) {
      enrichmentData.eventManagerEmail = dataObj.contact_email;
    }
    
    if (dataObj.contact_phone) {
      enrichmentData.eventManagerPhone = dataObj.contact_phone;
    }

    // Extract event types
    if (Array.isArray(dataObj.event_types) && dataObj.event_types.length > 0) {
      enrichmentData.commonEventTypes = dataObj.event_types;
    }

    // Extract in-house catering
    if (typeof dataObj.in_house_catering !== 'undefined') {
      enrichmentData.inHouseCatering = !!dataObj.in_house_catering;
    }

    // Extract capacity
    if (dataObj.capacity) {
      const capacityStr = String(dataObj.capacity);
      const capacityMatch = capacityStr.match(/\d+/);
      if (capacityMatch) {
        enrichmentData.venueCapacity = parseInt(capacityMatch[0]);
      }
    }

    // Extract amenities if available
    if (Array.isArray(dataObj.amenities) && dataObj.amenities.length > 0) {
      enrichmentData.amenities = dataObj.amenities;
    }
    
    // Extract pricing information
    if (dataObj.pricing_information) {
      enrichmentData.pricingInformation = dataObj.pricing_information;
    }
    
    // Extract website
    if (dataObj.website) {
      enrichmentData.website = dataObj.website;
    }
    
    // Add timestamp
    enrichmentData.lastUpdated = new Date().toISOString();
    
    // Calculate lead score based on available data
    enrichmentData.leadScore = calculateLeadScore(enrichmentData);
  } catch (error) {
    console.error(`Error processing extracted data for ${leadName}:`, error);
  }
  
  return { enrichmentData, address: extractedAddress };
}

/**
 * Calculate a lead score based on extracted data
 */
function calculateLeadScore(enrichmentData: EnrichmentData): EnrichmentData['leadScore'] {
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
 * Step to process the extracted data
 */
export const processDataStep = new Step({
  id: 'process-data',
  description: 'Process extracted website data',
  execute: async ({ context }) => {
    const { enrichmentResults } = context.getStepResult<{
      enrichmentResults: Array<{
        leadId: string;
        websiteData?: any;
        success: boolean;
        lead: Lead;
        error?: string;
      }>;
    }>('extract-website-data') || { enrichmentResults: [] };
    
    if (!enrichmentResults || enrichmentResults.length === 0) {
      throw new Error('No enrichment results to process');
    }
    
    console.log(`Processing data for ${enrichmentResults.length} leads`);
    
    // Process each result to generate enrichment data
    const processedResults = enrichmentResults.map(result => {
      if (!result.success || !result.websiteData) {
        return {
          leadId: result.leadId,
          success: false,
          error: result.error || 'No website data available',
          lead: result.lead
        };
      }
      
      try {
        const { enrichmentData, address } = processExtractedData(
          result.websiteData,
          result.lead.name
        );
        
        return {
          leadId: result.leadId,
          success: true,
          enrichmentData,
          extractedAddress: address,
          lead: result.lead
        };
      } catch (error) {
        console.error(`Error processing data for lead ${result.leadId}:`, error);
        return {
          leadId: result.leadId,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          lead: result.lead
        };
      }
    });
    
    const successful = processedResults.filter(r => r.success).length;
    const failed = processedResults.filter(r => !r.success).length;
    
    console.log(`Data processing complete: ${successful} successful, ${failed} failed`);
    
    return { processedResults };
  }
});

/**
 * Step to update leads in the database
 */
export const updateLeadsStep = new Step({
  id: 'update-leads',
  description: 'Update leads with enriched data',
  execute: async ({ context }) => {
    const { processedResults } = context.getStepResult<{
      processedResults: Array<{
        leadId: string;
        success: boolean;
        enrichmentData?: EnrichmentData;
        extractedAddress?: string;
        lead: Lead;
        error?: string;
      }>;
    }>('process-data') || { processedResults: [] };
    
    if (!processedResults || processedResults.length === 0) {
      throw new Error('No processed results to update');
    }
    
    console.log(`Updating ${processedResults.length} leads in the database`);
    
    const supabase = createClient();
    const updateResults = [];
    
    // Update each lead in the database
    for (const result of processedResults) {
      if (!result.success || !result.enrichmentData) {
        updateResults.push({
          leadId: result.leadId,
          success: false,
          error: result.error || 'No enrichment data available'
        });
        continue;
      }
      
      try {
        // Prepare the update data
        const updateData: any = {
          enrichment_data: result.enrichmentData,
          status: 'enriched',
          updated_at: new Date().toISOString()
        };
        
        // Add top-level contact fields if extracted
        if (result.enrichmentData.eventManagerEmail) {
          updateData.contact_email = result.enrichmentData.eventManagerEmail;
        }
        
        if (result.enrichmentData.eventManagerPhone) {
          updateData.contact_phone = result.enrichmentData.eventManagerPhone;
        }
        
        if (result.enrichmentData.eventManagerName) {
          updateData.contact_name = result.enrichmentData.eventManagerName;
        }
        
        // If we extracted an address and the lead doesn't have one, add it
        if (result.extractedAddress && (!result.lead.address || result.lead.address.trim() === '')) {
          updateData.address = result.extractedAddress;
        }
        
        // Add lead score if available
        if (result.enrichmentData.leadScore) {
          updateData.lead_score = result.enrichmentData.leadScore.score;
          updateData.lead_score_label = result.enrichmentData.leadScore.potential;
        }
        
        // Update the lead in the database
        const { error } = await supabase
          .from('saved_leads')
          .update(updateData)
          .eq('id', result.leadId);
        
        if (error) {
          throw new Error(`Database update error: ${error.message}`);
        }
        
        updateResults.push({
          leadId: result.leadId,
          success: true
        });
      } catch (error) {
        console.error(`Error updating lead ${result.leadId}:`, error);
        updateResults.push({
          leadId: result.leadId,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    const successful = updateResults.filter(r => r.success).length;
    const failed = updateResults.filter(r => !r.success).length;
    
    console.log(`Database updates complete: ${successful} successful, ${failed} failed`);
    
    return {
      updateResults,
      successful,
      failed,
      total: updateResults.length
    };
  }
}); 