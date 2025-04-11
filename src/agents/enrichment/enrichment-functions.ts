/**
 * Core enrichment functionality
 */

import { EnrichmentData, EnrichmentResult, EnrichmentResponse } from './types';
import { calculateLeadScore } from './scoring';
import { normalizeUrl } from './utils';
import { processLeadWithAI } from './api';

/**
 * Main function - enrich lead data
 */
export async function enrichLeadData(lead: any, extractedData: any = {}): Promise<EnrichmentResponse> {
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
    
    // Generate enrichment data
    let enrichmentData: EnrichmentData = await processLeadWithAI(leadInfo, websiteContent);
    
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

/**
 * Batch enrichment function that works with the workflow manager
 */
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

    // Process each lead
    const enrichedBusinesses = await Promise.all(
      leads.map(async (lead: any) => {
        try {
          results.processed++;
          
          // Get the website URL
          const websiteUrl = lead.company_website || lead.website_url;
          
          if (!websiteUrl) {
            results.skipped++;
            return { id: lead.id, status: 'skipped', reason: 'No website URL' };
          }
          
          // Extract website content
          let websiteContent = '';
          try {
            const { firecrawlTool } = await import('@/tools/firecrawl');
            
            const result = await firecrawlTool.extract({
              urls: [normalizeUrl(websiteUrl)],
              formats: ["markdown", "text"],
              timeout: 120000, // 2 minutes
              waitTime: 5000
            });
            
            if (result.success && result.data) {
              websiteContent = firecrawlTool.extractContent(result.data);
            }
          } catch (extractError) {
            console.error(`[EnrichmentAgent] Extraction failed:`, extractError);
          }
          
          // Enrich the lead
          const enrichmentResult = await enrichLeadData(lead, { 
            content: websiteContent,
            website: websiteUrl
          });
          
          if (!enrichmentResult.success || !enrichmentResult.enrichmentData) {
            results.failed++;
            results.errors.push(`Lead ${lead.id}: ${enrichmentResult.error}`);
            return { id: lead.id, status: 'failed', error: enrichmentResult.error };
          }
          
          // Update the lead via API
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
            results.failed++;
            const errorText = await updateResponse.text();
            results.errors.push(`Lead ${lead.id}: Failed to update`);
            return { id: lead.id, status: 'failed', error: `Update failed: ${errorText}` };
          }
          
          const updatedLead = await updateResponse.json();
          results.successful++;
          
          return updatedLead.lead || {
            ...lead,
            enrichment_data: enrichmentResult.enrichmentData,
            status: 'enriched',
            lead_score: enrichmentResult.enrichmentData?.leadScore?.score,
            lead_score_label: enrichmentResult.enrichmentData?.leadScore?.potential
          };
        } catch (error) {
          results.failed++;
          results.errors.push(`Lead ${lead.id}: ${error instanceof Error ? error.message : String(error)}`);
          return { id: lead.id, status: 'failed', error: error instanceof Error ? error.message : String(error) };
        }
      })
    );
    
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
      enrichedBusinesses: enrichedBusinesses.filter(business => business.status !== 'failed')
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