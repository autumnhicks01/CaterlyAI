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

// The deprecated enrichLead function has been removed from this file.
// Please use the lib/enrichment module instead. 