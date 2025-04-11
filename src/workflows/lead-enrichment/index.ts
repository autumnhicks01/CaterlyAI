/**
 * Lead Enrichment Workflow
 * 
 * This workflow enhances lead information by extracting and analyzing 
 * data from lead websites.
 */

import { Workflow } from '@mastra/core/workflows';
import { leadEnrichmentInputSchema } from './schemas';
import { fetchLeadsStep, extractWebsiteDataStep } from './steps';

// Create the Lead Enrichment workflow
const leadEnrichmentWorkflow = new Workflow({
  name: 'lead-enrichment',
  triggerSchema: leadEnrichmentInputSchema
});

// Set up the workflow steps
leadEnrichmentWorkflow
  .step(fetchLeadsStep)
  .then(extractWebsiteDataStep);

// Commit the workflow
leadEnrichmentWorkflow.commit();

// Export the workflow as the default export
export default leadEnrichmentWorkflow;

/**
 * Extract and enhance leads' website data
 * @param leadIds Array of lead IDs to enrich
 */
export async function enrichLeadsFromWorkflow(leadIds: string[]) {
  try {
    // Start the workflow execution
    const { runId, start } = leadEnrichmentWorkflow.createRun();
    
    // Execute the workflow
    const result = await start({
      triggerData: { leadIds }
    });
    
    // Get the results from the extract-website-data step
    const extractionResults = result.results?.['extract-website-data'];
    
    // Return the results
    return {
      success: true,
      enrichedBusinesses: extractionResults && 'leads' in extractionResults ? extractionResults.leads : [],
      runId
    };
  } catch (error) {
    console.error('Error in enrichLeadsFromWorkflow:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      enrichedBusinesses: []
    };
  }
}

/**
 * Update a lead with enriched data in Supabase
 * @param leadId Lead ID to update
 * @param enrichmentData Enrichment data to save
 */
export async function saveEnrichmentData(leadId: string, enrichmentData: any) {
  try {
    const supabase = await createClient();
    
    // Update the lead in the database
    const { error } = await supabase
      .from('saved_leads')
      .update({
        enrichment_data: enrichmentData,
        last_enriched_at: new Date().toISOString()
      })
      .eq('id', leadId);
    
    if (error) {
      throw new Error(`Failed to update lead: ${error.message}`);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error in saveEnrichmentData:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
} 