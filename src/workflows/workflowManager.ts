import { BusinessSearchInput } from '@/workflows/business-search/schemas';
import { executeBusinessSearch, businessSearchStreamingWorkflow } from '@/workflows/business-search';
import { enrichLeads, LeadEnrichmentInput } from '@/workflows/index';
import EventEmitter from 'events';
import { WorkflowOptions } from '@mastra/core/workflows';
import { extractContentFromFirecrawlData } from '@/tools/firecrawl';

type ContextSetupFn = (context: any) => void;

/**
 * WorkflowManager provides a unified interface for executing workflows
 * This abstraction allows for easier usage across the application
 */
export class WorkflowManager {
  /**
   * Execute a workflow by name
   * @param workflowName - Name of the workflow to execute
   * @param data - Input data for the workflow
   * @param options - Options for the workflow run
   * @returns Result of the workflow execution
   */
  async executeWorkflow(workflowName: string, data: any, options?: WorkflowOptions): Promise<any> {
    console.log(`Executing workflow: ${workflowName}`);
    console.log(`Workflow input data:`, JSON.stringify(data).substring(0, 500));

    try {
      switch (workflowName) {
        case 'business-search':
          console.log("Executing business-search workflow");
          return this.executeBusinessSearchWorkflow(data);
        
        case 'business-search-streaming':
          console.log("Executing business-search-streaming workflow");
          return this.executeBusinessSearchStreamingWorkflow(data);
        
        case 'lead-enrichment':
        case 'lead-enrichment-direct': // Handle both workflow names for backward compatibility
          console.log("Executing lead-enrichment workflow with input:", JSON.stringify(data).substring(0, 200));
          
          // Ensure we have leadIds for the enrichLeads function
          if (workflowName === 'lead-enrichment-direct' && data.leads && Array.isArray(data.leads)) {
            // Convert leads to leadIds for the standard enrichment process
            const leadIds = data.leads.map((lead: any) => lead.id).filter(Boolean);
            
            if (leadIds.length === 0) {
              console.warn("No valid lead IDs found in provided leads");
              return {
                success: false,
                enrichedBusinesses: [],
                result: {
                  totalProcessed: 0,
                  successCount: 0,
                  failureCount: 0,
                  details: [],
                  highValueLeads: 0
                },
                error: "No valid lead IDs provided for enrichment"
              };
            }
            
            console.log(`Converting ${leadIds.length} leads to standard enrichment format`);
            try {
              const result = await enrichLeads(leadIds);
              console.log(`Enrichment result:`, JSON.stringify(result).substring(0, 500));
              return result;
            } catch (error) {
              console.error("Error in lead-enrichment-direct workflow:", error);
              return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                details: "Error occurred in enrichLeads function"
              };
            }
          }
          
          // Original lead-enrichment workflow format
          console.log(`Calling enrichLeads with ${data.leadIds?.length || 0} lead IDs`);
          try {
            const startTime = Date.now();
            const result = await enrichLeads(data.leadIds);
            const endTime = Date.now();
            console.log(`Enrichment completed in ${(endTime-startTime)/1000} seconds`);
            console.log(`Enrichment result structure:`, Object.keys(result));
            
            if (result.success) {
              console.log(`Enrichment success with data keys:`, Object.keys(result.data || {}));
              
              // Ensure the enrichedBusinesses array is properly returned
              if (!result.enrichedBusinesses || !Array.isArray(result.enrichedBusinesses)) {
                console.warn('No enrichedBusinesses array found in result, creating empty array');
                result.enrichedBusinesses = [];
              }
              
              // Log the enrichment results summary
              console.log(`Enrichment summary: ${result.enrichedBusinesses.length} businesses enriched out of ${data.leadIds?.length || 0} requested`);
              if (result.enrichedBusinesses.length > 0) {
                console.log(`Sample enriched business:`, {
                  id: result.enrichedBusinesses[0].id,
                  name: result.enrichedBusinesses[0].name,
                  hasEnrichmentData: !!result.enrichedBusinesses[0].enrichment_data,
                  leadScore: result.enrichedBusinesses[0].lead_score
                });
              }
            } else {
              console.error(`Enrichment failed with error:`, result.error);
            }
            
            return result;
          } catch (error) {
            console.error("Error in lead-enrichment workflow:", error);
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : "No stack trace available",
              details: "Exception thrown from enrichLeads function"
            };
          }
          
        default:
          throw new Error(`Workflow ${workflowName} not found`);
      }
    } catch (error) {
      console.error(`Error executing workflow ${workflowName}:`, error);
      
      if (error instanceof Error) {
        return {
          success: false,
          error: error.message,
          stack: error.stack,
        };
      }
      
      return {
        success: false,
        error: String(error),
      };
    }
  }
  
  /**
   * Execute the business search workflow
   */
  private async executeBusinessSearchWorkflow(data: BusinessSearchInput) {
    const { query, location, radius } = data;
    return executeBusinessSearch(query, location, radius);
  }
  
  /**
   * Execute the business search workflow with streaming
   */
  private async executeBusinessSearchStreamingWorkflow(data: BusinessSearchInput) {
    const { query, location, radius } = data;
    
    console.log(`Executing streaming business search workflow for "${query}" in ${location}`);
    
    try {
      // Create progress emitter that the workflow can use
      const progressEmitter = new EventEmitter();
      
      // Create a new workflow run with the streaming workflow
      const { runId, start } = businessSearchStreamingWorkflow.createRun();
      
      // Trigger data for the workflow
      const triggerData = { query, location, radius };
      
      // Run the workflow with the progressEmitter
      const result = await start({
        triggerData
      });
      
      console.log("Streaming workflow execution completed");
      
      // Get the final results from the validate-businesses step
      const validationResults = result.results?.['validate-businesses'];
      
      return {
        success: true,
        data: {
          status: 'success',
          output: validationResults
        },
        runId
      };
    } catch (error) {
      console.error("Error executing streaming business search workflow:", error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

// Create and export a singleton instance
export const workflowManager = new WorkflowManager();

export default WorkflowManager; 