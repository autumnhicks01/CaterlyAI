import { enrichLead } from '../api-utils';

// Define interfaces for the batch processing
interface BatchEnrichmentResult {
  success: boolean;
  processed: number;
  succeeded: number;
  failed: number;
  emailsFound: number;
  errors: string[];
  enrichedLeads: any[];
}

/**
 * Process a batch of leads for enrichment
 * This is meant to be called from a serverless function or background worker
 */
export async function processBatchEnrichment(leads: any[]): Promise<BatchEnrichmentResult> {
  if (!leads || !Array.isArray(leads) || leads.length === 0) {
    return {
      success: false,
      processed: 0,
      succeeded: 0,
      failed: 0,
      emailsFound: 0,
      errors: ['No leads provided for batch processing'],
      enrichedLeads: []
    };
  }

  console.log(`[BATCH-ENRICH] Starting batch enrichment for ${leads.length} leads`);
  
  // Initialize result counters
  const result: BatchEnrichmentResult = {
    success: true,
    processed: 0,
    succeeded: 0,
    failed: 0,
    emailsFound: 0,
    errors: [],
    enrichedLeads: []
  };

  // Process each lead sequentially to avoid rate limits
  for (const lead of leads) {
    try {
      console.log(`[BATCH-ENRICH] Processing lead ${result.processed + 1}/${leads.length}: ${lead.name}`);
      
      const enrichResult = await enrichLead(lead);
      result.processed++;
      
      if (enrichResult.success) {
        result.succeeded++;
        result.enrichedLeads.push({
          id: lead.id,
          name: lead.name,
          enrichment_data: enrichResult.enrichmentData
        });
        
        // Check if email was found
        if (enrichResult.emailFound) {
          result.emailsFound++;
        }
      } else {
        result.failed++;
        const errorMsg = `Failed to enrich lead ${lead.name}: ${enrichResult.error || 'Unknown error'}`;
        result.errors.push(errorMsg);
        console.error(`[BATCH-ENRICH] ${errorMsg}`);
      }
    } catch (error) {
      result.processed++;
      result.failed++;
      const errorMsg = `Exception enriching lead ${lead.name}: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push(errorMsg);
      console.error(`[BATCH-ENRICH] ${errorMsg}`);
    }
    
    // Add a small delay between processing each lead to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Determine overall success
  result.success = result.failed === 0;
  
  console.log(`[BATCH-ENRICH] Batch processing complete. Processed: ${result.processed}, Succeeded: ${result.succeeded}, Failed: ${result.failed}, Emails found: ${result.emailsFound}`);
  
  return result;
} 