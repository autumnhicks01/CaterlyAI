import { Step } from '@mastra/core/workflows';
import { createClient } from '@/utils/supabase/client-compat';
import { enrichLeadData } from '@/agents/enrichmentAgent';
import { LeadData } from './schemas';

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
    // Access triggerData safely
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
    
    return { leads: data };
  }
});

/**
 * Step to extract website data for leads
 */
export const extractWebsiteDataStep = new Step({
  id: 'extract-website-data',
  description: 'Extract and enrich lead data',
  execute: async (context) => {
    // Get leads from previous step
    const { leads } = (context as any).getStepResult('fetch-leads') || { leads: [] };
    
    if (!leads || leads.length === 0) {
      throw new Error('No leads provided to extract-website-data step');
    }
    
    // Process leads in parallel with a reasonable batch size
    const batchSize = 5;
    const results = [];
    
    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);
      
      // Use Promise.all to process batch in parallel
      const batchResults = await Promise.all(
        batch.map(async (lead: LeadData) => {
          try {
            // Normalize website URL
            const websiteUrl = normalizeUrl(lead.website_url || lead.enrichment_data?.website);
            
            // Skip leads without website URLs
            if (!websiteUrl) {
              return {
                leadId: lead.id,
                success: false,
                error: 'No valid website URL',
                lead
              };
            }
            
            // Enrich lead data using the enrichment agent
            const enrichmentData = await enrichLeadData(lead, websiteUrl);
            
            // Extract lead score safely
            let leadScore = 0;
            if (enrichmentData && typeof enrichmentData === 'object') {
              // Try different possible property paths
              if ('leadScore' in enrichmentData && 
                  typeof enrichmentData.leadScore === 'object' && 
                  enrichmentData.leadScore !== null && 
                  'score' in enrichmentData.leadScore) {
                leadScore = Number(enrichmentData.leadScore.score) || 0;
              } else if ('lead_score' in enrichmentData) {
                leadScore = Number(enrichmentData.lead_score) || 0;
              }
            }
            
            // Update lead in database
            const supabase = await createClient();
            await supabase
              .from('saved_leads')
              .update({
                enrichment_data: enrichmentData,
                lead_score: leadScore,
                last_enriched_at: new Date().toISOString()
              })
              .eq('id', lead.id);
            
            // Return successful result
            return {
              leadId: lead.id,
              success: true,
              lead: {
                ...lead,
                enrichment_data: enrichmentData,
                lead_score: leadScore
              }
            };
          } catch (error) {
            console.error(`Error enriching lead ${lead.id}:`, error);
            
            return {
              leadId: lead.id,
              success: false,
              error: error instanceof Error ? error.message : String(error),
              lead
            };
          }
        })
      );
      
      results.push(...batchResults);
    }
    
    // Calculate success metrics
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`Enrichment completed: ${successful.length} successful, ${failed.length} failed`);
    
    return {
      enrichmentResults: results,
      successCount: successful.length,
      failureCount: failed.length,
      leads: results.map(r => r.lead)
    };
  }
});