// EnrichmentAgent.ts

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { firecrawlTool } from '../tools/FirecrawlTool';

/** ----------------- */
/**   Type Definitions
/** ----------------- */

// Define the lead type
interface Lead {
  id: string;
  name: string;
  company_website?: string;
  website_url?: string;
  address?: string;
  enrichment_data?: EnrichmentData;
  [key: string]: any;
}

interface EnrichmentData {
  venueCapacity?: number;
  inHouseCatering?: boolean;
  eventManagerName?: string;
  eventManagerEmail?: string;
  eventManagerPhone?: string;
  lastPublishedEvent?: string;
  eventFrequency?: string;
  commonEventTypes?: string[];
  aiOverview?: string;
  firecrawlExtracted?: any;
  lastUpdated?: string;
  website?: string;
  additionalDetails?: string;
  eventTypes?: string[];
  venueName?: string;
  websiteContent?: string;
  pricingInformation?: string;
  amenities?: string[] | string;
  eventsInformation?: string;
  address?: string;
  preferredCaterers?: string[];
  managementContactName?: string;
  managementContactEmail?: string;
  managementContactPhone?: string;
  managementContactTitle?: string;
  leadScore?: {
    score: number;
    reasons: string[];
    potential: 'high' | 'medium' | 'low';
    lastCalculated: string;
  };
  [key: string]: any;
}

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
}

/** -------------------------- */
/**   The Agent Implementation
/** -------------------------- */

/**
 * A minimal agent that:
 *  1. Fetches leads
 *  2. For each lead's website, extracts data using FirecrawlTool
 *  3. Processes data
 *  4. Updates Supabase
 */
export const enrichmentAgent = {
  name: 'enrichmentAgent',

  steps: {
    /**
     * Enriches leads with additional data from their websites
     * @param leadIds Array of lead IDs to enrich
     * @returns EnrichmentResult with success/failure info
     */
    enrichLeads: async (input: { leadIds: string[] }): Promise<EnrichmentResult> => {
      const { leadIds } = input;
      
      if (!leadIds || leadIds.length === 0) {
        return { success: false, message: 'No valid leadIds provided.' };
      }

      console.log(`Processing ${leadIds.length} leads for enrichment`);

      // Prepare Supabase
      let supabase;
      try {
        supabase = createClient();
      } catch (err: any) {
        return {
          success: false,
          message: 'Failed to initialize database connection',
          error: err.message
        };
      }

      // Fetch leads
      let leads: Lead[] = [];
      try {
        const { data, error } = await supabase
          .from('saved_leads')
          .select('*')
          .in('id', leadIds);

        if (error) {
          return {
            success: false,
            message: 'Error fetching leads from database',
            error: error.message
          };
        }
        leads = data || [];
      } catch (err: any) {
        return {
          success: false,
          message: 'Exception fetching leads from database',
          error: err.message
        };
      }

      if (!leads.length) {
        return { success: false, message: 'No leads found with the provided IDs' };
      }

      // Track results
      const results = {
        processed: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        errors: [] as string[]
      };

      // Process each lead
      const tasks = leads.map(async (lead) => {
        console.log(`Processing lead: ${lead.id} (${lead.name})`);
        
        // Get the website URL directly from the lead record
        let websiteUrl = lead.website_url;
        
        if (!websiteUrl || websiteUrl.trim() === '') {
          console.log(`No website URL found for lead ${lead.id}, skipping enrichment`);
          results.processed++;
          results.skipped++;
          results.errors.push(`Lead ${lead.id}: No website URL available`);
          return;
        }
        
        console.log(`Using website URL for lead ${lead.id}: ${websiteUrl}`);

        // Extract data from the website
        let extractionResult;
        try {
          extractionResult = await firecrawlTool.extract({ 
            url: websiteUrl,
            timeout: 30000,  // 30 seconds
            waitTime: 5000,  // 5 seconds wait time
            enableWebSearch: true  // Enable web search for better context
          });

          if (!extractionResult.success) {
            console.error(`Extraction failed for ${websiteUrl}: ${extractionResult.error}`);
            results.processed++;
            results.failed++;
            results.errors.push(`Lead ${lead.id}: Extraction failed => ${extractionResult.error}`);
            return;
          }
        } catch (err: any) {
          console.error(`Error extracting from ${websiteUrl}:`, err);
          results.processed++;
          results.failed++;
          results.errors.push(`Lead ${lead.id}: Extraction error => ${err.message}`);
          return;
        }

        // Process the extracted data
        const { enrichmentData, address } = processExtractedData(extractionResult.data, lead.name);

        // Merge with existing
        const newEnrichment: EnrichmentData = {
          ...(lead.enrichment_data || {}),
          ...enrichmentData,
          lastUpdated: new Date().toISOString()
        };

        // Prepare update
        const updateData: any = {
          enrichment_data: newEnrichment,
          status: "enriched"
        };
        
        // Add top-level contact fields if extracted
        if (enrichmentData.eventManagerEmail) {
          updateData.contact_email = enrichmentData.eventManagerEmail;
        }
        
        if (enrichmentData.eventManagerPhone) {
          updateData.contact_phone = enrichmentData.eventManagerPhone;
        }
        
        if (enrichmentData.eventManagerName) {
          updateData.contact_name = enrichmentData.eventManagerName;
        }
        
        // If we got an address and no existing address, store it
        if (address && (!lead.address || !lead.address.trim())) {
          updateData.address = address;
        }

        // Update in DB
        try {
          const { error } = await supabase
            .from('saved_leads')
            .update(updateData)
            .eq('id', lead.id);

          results.processed++;
          if (error) {
            results.failed++;
            results.errors.push(`Lead ${lead.id}: Update error => ${error.message}`);
          } else {
            results.successful++;
          }
        } catch (updateErr: any) {
          results.processed++;
          results.failed++;
          results.errors.push(`Lead ${lead.id}: Update exception => ${updateErr.message}`);
        }
      });

      await Promise.all(tasks);

      return {
        success: true,
        message: 'Enrichment completed.',
        results: {
          processed: results.processed,
          total: results.processed,
          succeeded: results.successful,
          successful: results.successful,
          failed: results.failed,
          skipped: results.skipped,
          errors: results.errors.length ? results.errors : undefined
        }
      };
    }
  }
};

/** 
 * Process extracted data into enrichment structure
 */
function processExtractedData(
  rawData: any,
  leadName: string
): { enrichmentData: EnrichmentData; address?: string } {
  console.log(`Processing extracted data for lead: ${leadName}`);
  
  const enrichmentData: EnrichmentData = {
    venueCapacity: undefined,
    inHouseCatering: undefined,
    eventManagerName: undefined,
    eventManagerEmail: undefined,
    eventManagerPhone: undefined,
    commonEventTypes: [],
    aiOverview: '',
    lastUpdated: new Date().toISOString()
  };
  
  let extractedAddress: string | undefined;

  try {
    // Access the data object - could be nested in different ways
    const dataObj = rawData?.data || rawData;
    
    // Extract address if available
    if (typeof dataObj.address === 'string' && dataObj.address.trim().length > 0) {
      extractedAddress = dataObj.address;
      console.log(`Extracted address: ${extractedAddress}`);
    }
    
    // Extract venue name
    if (typeof dataObj.venue_name === 'string') {
      enrichmentData.venueName = dataObj.venue_name;
      console.log(`Extracted venue name: ${enrichmentData.venueName}`);
    }
    
    // Extract contact information
    if (dataObj.contact_name) {
      enrichmentData.eventManagerName = dataObj.contact_name;
      console.log(`Extracted contact name: ${enrichmentData.eventManagerName}`);
    }
    
    if (dataObj.contact_email) {
      enrichmentData.eventManagerEmail = dataObj.contact_email;
      console.log(`Extracted contact email: ${enrichmentData.eventManagerEmail}`);
    }
    
    if (dataObj.contact_phone) {
      enrichmentData.eventManagerPhone = dataObj.contact_phone;
      console.log(`Extracted contact phone: ${enrichmentData.eventManagerPhone}`);
    }

    // Extract event types
    if (Array.isArray(dataObj.event_types) && dataObj.event_types.length > 0) {
      enrichmentData.commonEventTypes = dataObj.event_types;
      console.log(`Extracted event types: ${enrichmentData.commonEventTypes?.join(', ') || 'none'}`);
    }

    // Extract in-house catering
    if (typeof dataObj.in_house_catering !== 'undefined') {
      enrichmentData.inHouseCatering = !!dataObj.in_house_catering;
      console.log(`Extracted in-house catering: ${enrichmentData.inHouseCatering}`);
    }

    // Extract capacity
    if (dataObj.capacity) {
      const capacityStr = String(dataObj.capacity);
      const capacityMatch = capacityStr.match(/\d+/);
      if (capacityMatch) {
        enrichmentData.venueCapacity = parseInt(capacityMatch[0]);
        console.log(`Extracted venue capacity: ${enrichmentData.venueCapacity}`);
      }
    }

    // Extract amenities if available
    if (Array.isArray(dataObj.amenities) && dataObj.amenities.length > 0) {
      enrichmentData.amenities = dataObj.amenities;
      if (Array.isArray(enrichmentData.amenities)) {
        console.log(`Extracted amenities: ${enrichmentData.amenities.join(', ')}`);
      }
    }
    
    // Extract pricing information
    if (dataObj.pricing_information) {
      enrichmentData.pricingInformation = dataObj.pricing_information;
      console.log(`Extracted pricing information: ${enrichmentData.pricingInformation}`);
    }

    // Extract description for overview
    if (dataObj.description) {
      enrichmentData.aiOverview = dataObj.description;
      console.log(`Extracted description for overview, length: ${enrichmentData.aiOverview?.length || 0}`);
    }
    
    // Extract website
    if (dataObj.website) {
      enrichmentData.website = dataObj.website;
      console.log(`Extracted website: ${enrichmentData.website}`);
    }

    // Generate enhanced AI overview
    enrichmentData.aiOverview = generateAIOverview(enrichmentData, extractedAddress);
    console.log(`Generated AI overview, length: ${enrichmentData.aiOverview?.length || 0}`);

    // Calculate lead score
    enrichmentData.leadScore = calculateLeadScore(enrichmentData);
    if (enrichmentData.leadScore) {
      console.log(`Calculated lead score: ${enrichmentData.leadScore.score}`);
    }
    
  } catch (err) {
    console.error(`[processExtractedData] Error handling data for ${leadName}:`, err);
  }

  return { enrichmentData, address: extractedAddress };
}

/**
 * Generate an AI overview from structured data
 */
function generateAIOverview(enrichmentData: EnrichmentData, extractedAddress?: string): string {
  try {
    // Start with venue name
    const venueName = enrichmentData.venueName || 'This venue';
    
    // Build comprehensive overview
    let overviewParts: string[] = [];
    
    // Start with venue description
    if (enrichmentData.aiOverview && enrichmentData.aiOverview.length > 100) {
      // Use existing overview if it's substantial
      overviewParts.push(enrichmentData.aiOverview);
    } else {
      // Create basic description
      overviewParts.push(`${venueName} is an event venue`);
      
      // Add location if available
      if (extractedAddress) {
        overviewParts[0] += ` located at ${extractedAddress}`;
      }
      
      // Add event types if available
      if (enrichmentData.commonEventTypes && enrichmentData.commonEventTypes.length > 0) {
        overviewParts[0] += ` that specializes in hosting ${enrichmentData.commonEventTypes.join(', ')} events`;
      }
      overviewParts[0] += '.';
    }
    
    // Add capacity information
    if (enrichmentData.venueCapacity) {
      overviewParts.push(`The venue can accommodate up to ${enrichmentData.venueCapacity} guests.`);
    }
    
    // Add catering information
    if (enrichmentData.inHouseCatering !== undefined) {
      overviewParts.push(enrichmentData.inHouseCatering 
        ? 'In-house catering services are available to simplify event planning.'
        : 'The venue works with outside caterers for food service.');
    }
    
    // Add amenities if available
    if (enrichmentData.amenities) {
      const amenitiesList = Array.isArray(enrichmentData.amenities) 
        ? enrichmentData.amenities.join(', ') 
        : enrichmentData.amenities;
      
      if (amenitiesList && amenitiesList.length > 0) {
        overviewParts.push(`Amenities include ${amenitiesList}.`);
      }
    }
    
    // Add pricing information if available
    if (enrichmentData.pricingInformation) {
      overviewParts.push(`Pricing information: ${enrichmentData.pricingInformation}`);
    }
    
    // Add contact information
    const contactParts = [];
    if (enrichmentData.eventManagerName) {
      contactParts.push(`${enrichmentData.eventManagerName}`);
    }
    
    if (enrichmentData.eventManagerEmail || enrichmentData.eventManagerPhone) {
      contactParts.push('can be reached at');
      
      if (enrichmentData.eventManagerEmail) {
        contactParts.push(enrichmentData.eventManagerEmail);
      }
      
      if (enrichmentData.eventManagerEmail && enrichmentData.eventManagerPhone) {
        contactParts.push('or');
      }
      
      if (enrichmentData.eventManagerPhone) {
        contactParts.push(enrichmentData.eventManagerPhone);
      }
    }
    
    if (contactParts.length > 0) {
      overviewParts.push(`For more information, ${contactParts.join(' ')}.`);
    }
    
    // Add website if available
    if (enrichmentData.website) {
      overviewParts.push(`Visit their website at ${enrichmentData.website} for more details.`);
    }
    
    // Combine all parts into a cohesive overview
    return overviewParts.join(' ');
  } catch (error) {
    console.error('Error generating AI overview:', error);
    return enrichmentData.aiOverview || 
      `${enrichmentData.venueName || 'This venue'} offers event hosting services.`;
  }
}

/**
 * Calculate a lead score based on extracted venue information
 */
function calculateLeadScore(enrichmentData: EnrichmentData): EnrichmentData['leadScore'] {
  let score = 0;
  const reasons: string[] = [];
  
  try {
    // Contact information - critical for follow-up (35 points)
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
      reasons.push('Has contact person name');
    }
    
    // Event capability factors (35 points)
    if (enrichmentData.venueCapacity && enrichmentData.venueCapacity >= 100) {
      score += 15;
      reasons.push('Venue can host 100+ guests');
    }
    
    if (enrichmentData.commonEventTypes && 
        Array.isArray(enrichmentData.commonEventTypes) && 
        enrichmentData.commonEventTypes.length > 0) {
      score += 10;
      reasons.push('Hosts multiple types of events');
    }
    
    if (enrichmentData.inHouseCatering === false) {
      score += 10;
      reasons.push('Needs external catering services');
    }
    
    // Website/data quality factors (20 points)
    if (enrichmentData.website) {
      score += 10;
      reasons.push('Has functional website');
    }
    
    if (enrichmentData.aiOverview && enrichmentData.aiOverview.length > 100) {
      score += 5;
      reasons.push('Has detailed venue description');
    }
    
    if (enrichmentData.pricingInformation) {
      score += 5;
      reasons.push('Provides pricing information');
    }
    
    // Additional factors (10 points)
    if (enrichmentData.amenities) {
      score += 5;
      reasons.push('Lists venue amenities');
    }
    
    if (enrichmentData.preferredCaterers && 
        Array.isArray(enrichmentData.preferredCaterers) && 
        enrichmentData.preferredCaterers.length > 0) {
      score += 5;
      reasons.push('Lists preferred caterers');
    }
    
    // Cap score at 100
    score = Math.min(score, 100);
    
    // Determine potential classification
    let potential: 'high' | 'medium' | 'low';
    if (score >= 70) {
      potential = 'high';
    } else if (score >= 40) {
      potential = 'medium';
    } else {
      potential = 'low';
    }
    
    return {
      score,
      reasons,
      potential,
      lastCalculated: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error calculating lead score:', error);
    return {
      score: 30,
      reasons: ['Basic venue information available'],
      potential: 'medium',
      lastCalculated: new Date().toISOString()
    };
  }
}
