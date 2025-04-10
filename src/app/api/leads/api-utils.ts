import { createClient } from '@/utils/supabase/server';
import { extractWebsiteData } from '@/tools/firecrawl';
import { enrichLeadData } from '@/agents/enrichmentAgent';

/**
 * Normalize URL function
 */
export function normalizeUrl(url: string): string {
  try {
    // Make sure URL starts with http:// or https://
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    // Parse the URL to get just the origin (protocol + hostname)
    const parsedUrl = new URL(url);
    return parsedUrl.origin;
  } catch (error) {
    console.error(`[API-UTILS] Error normalizing URL ${url}:`, error);
    return url; // Return original if parsing fails
  }
}

/**
 * Extract website content using Firecrawl
 */
export async function extractWebContent(websiteUrl: string): Promise<string> {
  if (!websiteUrl) {
    console.warn(`[API-UTILS] No website URL provided for extraction`);
    return '';
  }

  try {
    console.log(`[API-UTILS] Extracting content from ${websiteUrl}`);
    
    const extractionResult = await extractWebsiteData({
      urls: [normalizeUrl(websiteUrl)],
      enableWebSearch: true,
      prompt: "Extract all information about this venue, especially contact information, event types, and venue details."
    });
    
    if (extractionResult.success && extractionResult.data) {
      const content = extractionResult.data.text || 
        extractionResult.data.content || 
        (extractionResult.data.formats?.text) || 
        (extractionResult.data.formats?.markdown) ||
        '';
      
      console.log(`[API-UTILS] Extracted ${content.length} chars of content from ${websiteUrl}`);
      return content;
    } else {
      console.warn(`[API-UTILS] Failed to extract content from ${websiteUrl}: ${extractionResult.error}`);
      return '';
    }
  } catch (extractError) {
    console.error(`[API-UTILS] Error extracting website content for ${websiteUrl}:`, extractError);
    return '';
  }
}

/**
 * Fetch leads by IDs from the database
 */
export async function fetchLeadsById(leadIds: string[]) {
  if (!leadIds || leadIds.length === 0) {
    return { data: null, error: new Error('No lead IDs provided') };
  }
  
  console.log(`[API-UTILS] Fetching ${leadIds.length} leads from database`);
  
  try {
    const supabase = await createClient();
    return await supabase
      .from('saved_leads')
      .select('*')
      .in('id', leadIds);
  } catch (error) {
    console.error(`[API-UTILS] Error fetching leads:`, error);
    return { data: null, error };
  }
}

/**
 * Process enrichment data to make it safe for database storage
 */
export function safeEnrichmentData(enrichmentData: any) {
  if (!enrichmentData) return {};
  
  // Create a copy to avoid modifying the original
  let safeData = { ...enrichmentData };
  
  // Remove lastUpdated from enrichment_data to avoid database error
  if (safeData.lastUpdated) {
    delete safeData.lastUpdated;
  }
  
  // Handle any complex objects in the enrichment data
  for (const key in safeData) {
    if (typeof safeData[key] === 'object' && safeData[key] !== null) {
      // If it's an array of strings, keep it as is
      if (Array.isArray(safeData[key]) && 
          safeData[key].every((item: any) => typeof item === 'string')) {
        continue;
      }
      
      // Otherwise, stringify it for safe storage
      safeData[key] = JSON.stringify(safeData[key]);
    }
  }
  
  return safeData;
}

/**
 * Update a lead with enrichment data
 */
export async function updateLeadWithEnrichment(leadId: string, enrichmentData: any, lead: any) {
  if (!leadId) {
    return { success: false, error: 'No lead ID provided' };
  }
  
  try {
    // Process enrichment data for safe storage
    const safeData = safeEnrichmentData(enrichmentData);
    
    // Prepare update data
    const updateData = {
      status: 'enriched',
      enrichment_data: safeData,
      lead_score: lead.lead_score || enrichmentData.leadScore?.score || null,
      lead_score_label: lead.lead_score_label || enrichmentData.leadScore?.potential || null,
      contact_email: enrichmentData.eventManagerEmail || lead.contact_email || null,
      contact_name: enrichmentData.eventManagerName || lead.contact_name || null,
      contact_phone: enrichmentData.eventManagerPhone || lead.contact_phone || null,
      website_url: lead.website_url || lead.website || enrichmentData.website || null,
      updated_at: new Date().toISOString()
    };
    
    // Update the lead in the database
    console.log(`[API-UTILS] Updating lead ${leadId} with enrichment data`);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('saved_leads')
      .update(updateData)
      .eq('id', leadId)
      .select();
      
    if (error) {
      console.error(`[API-UTILS] Error updating lead ${leadId}:`, error);
      
      // Try a simplified update if the full update fails
      console.log(`[API-UTILS] Trying minimal fallback update for lead ${leadId}`);
      const minimalUpdate = {
        status: 'enriched',
        updated_at: new Date().toISOString()
      };
      
      const { error: fallbackError } = await supabase
        .from('saved_leads')
        .update(minimalUpdate)
        .eq('id', leadId);
        
      if (fallbackError) {
        return { 
          success: false, 
          error: fallbackError.message
        };
      }
      
      return { 
        success: true, 
        data,
        minimal: true
      };
    }
    
    return { 
      success: true, 
      data
    };
  } catch (error) {
    console.error(`[API-UTILS] Exception updating lead ${leadId}:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Enrich a single lead
 * @deprecated Use the new lib/enrichment module instead for a more streamlined approach
 */
export async function enrichLead(lead: any) {
  console.warn('[API-UTILS] The enrichLead function is deprecated. Please use the lib/enrichment module instead.');
  if (!lead) {
    return { success: false, error: 'No lead provided' };
  }

  try {
    if (!lead.website_url) {
      return { success: false, error: 'Lead has no website URL' };
    }

    console.log(`[API-UTILS] Enriching lead ${lead.id}: ${lead.name} (${lead.website_url})`);
    
    // Make sure we have a valid absolute URL for the API call
    let baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    // If running in dev/local environment and baseUrl is not set, use a default localhost URL
    if (!baseUrl) {
      const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
      const host = process.env.VERCEL_URL || 'localhost:3000';
      baseUrl = `${protocol}://${host}`;
    }
    
    // Ensure baseUrl doesn't end with a slash to avoid double slashes
    baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    
    const enrichmentUrl = `${baseUrl}/api/tests/enrich-url`;
    console.log(`[API-UTILS] Calling enrichment endpoint: ${enrichmentUrl}`);
    
    const enrichmentResponse = await fetch(enrichmentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: lead.website_url }),
    });

    if (!enrichmentResponse.ok) {
      const errorText = await enrichmentResponse.text();
      throw new Error(`Enrichment failed: ${enrichmentResponse.status} - ${errorText}`);
    }

    // Get the job ID from the response
    const jobData = await enrichmentResponse.json();
    const jobId = jobData.jobId;

    if (!jobId) {
      throw new Error('No job ID returned from enrichment service');
    }

    console.log(`[API-UTILS] Enrichment job started with ID: ${jobId}`);

    // Poll for job completion (with 5-minute timeout)
    let enrichmentComplete = false;
    let enrichmentData = null;
    const maxAttempts = 30; // 30 attempts, 10 seconds apart = 5 minutes total
    let attempts = 0;

    while (!enrichmentComplete && attempts < maxAttempts) {
      // Wait 10 seconds between each check
      await new Promise(resolve => setTimeout(resolve, 10000));
      attempts++;

      try {
        // Check job status using the correct URL format
        const statusUrl = `${baseUrl}/api/tests/enrich-status/${jobId}`;
        console.log(`[API-UTILS] Checking status for job ${jobId} (attempt ${attempts}/${maxAttempts}): ${statusUrl}`);
        
        const statusResponse = await fetch(statusUrl);
        
        if (!statusResponse.ok) {
          console.warn(`[API-UTILS] Job status check failed (attempt ${attempts}): ${statusResponse.status}`);
          continue;
        }

        const jobStatus = await statusResponse.json();
        console.log(`[API-UTILS] Job status: ${jobStatus.status}`);
        
        if (jobStatus.status === 'complete') {
          enrichmentComplete = true;
          enrichmentData = jobStatus.result;
          console.log(`[API-UTILS] Enrichment complete for lead ${lead.id}`);
        } else if (jobStatus.status === 'error') {
          throw new Error(`Enrichment failed: ${jobStatus.message}`);
        } else {
          console.log(`[API-UTILS] Job still processing (${jobStatus.status}), will check again...`);
        }
      } catch (pollError) {
        console.error(`[API-UTILS] Error checking job status:`, pollError);
        // Continue polling despite errors
      }
    }

    if (!enrichmentComplete) {
      throw new Error(`Enrichment timed out after ${maxAttempts} attempts`);
    }

    if (!enrichmentData) {
      throw new Error('No enrichment data returned');
    }

    // Format the enrichment data for our schema
    const formattedEnrichmentData = {
      venueName: enrichmentData.venue_name,
      aiOverview: enrichmentData.aiOverview || enrichmentData.venue_description,
      eventManagerName: enrichmentData.management_contact?.name || enrichmentData.contact_information?.contact_person || '',
      eventManagerEmail: enrichmentData.management_contact?.email || enrichmentData.contact_information?.email || '',
      eventManagerPhone: enrichmentData.management_contact?.phone || enrichmentData.contact_information?.phone || '',
      commonEventTypes: enrichmentData.event_types_hosted || [],
      venueCapacity: enrichmentData.venue_capacity || null,
      inHouseCatering: enrichmentData.in_house_catering_availability || false,
      amenities: enrichmentData.amenities_offered || [],
      pricingInformation: enrichmentData.pricing_information || '',
      preferredCaterers: enrichmentData.preferred_caterers || [],
      website: enrichmentData.website || lead.website_url,
      leadScore: {
        score: enrichmentData.lead_score || 50,
        reasons: enrichmentData.lead_score_reasoning ? [enrichmentData.lead_score_reasoning] : [],
        potential: enrichmentData.lead_score >= 70 ? 'high' : (enrichmentData.lead_score >= 40 ? 'medium' : 'low'),
        lastCalculated: new Date().toISOString()
      },
      lastUpdated: new Date().toISOString()
    };

    // Update the lead with enrichment data
    const updateResult = await updateLeadWithEnrichment(
      lead.id,
      formattedEnrichmentData,
      lead
    );

    return {
      success: updateResult.success,
      data: updateResult.data,
      error: updateResult.error,
      minimal: updateResult.minimal,
      enrichmentData: formattedEnrichmentData,
      emailFound: !!formattedEnrichmentData.eventManagerEmail
    };
  } catch (error) {
    console.error(`[API-UTILS] Error enriching lead ${lead?.name}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
} 