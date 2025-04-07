import { BusinessSearchInput } from '@/workflows/business-search/schemas';
import { executeBusinessSearch, businessSearchStreamingWorkflow } from '@/workflows/business-search';
import { ContextSetupFn } from '@/lib/workflows/core';
import { EventEmitter } from 'events';

/**
 * WorkflowManager provides a unified interface for executing workflows
 * This abstraction allows for easier usage across the application
 */
export class WorkflowManager {
  /**
   * Execute a workflow by name
   * @param workflowName - Name of the workflow to execute
   * @param data - Input data for the workflow
   * @param contextSetup - Optional function to set up the context
   * @returns Result of the workflow execution
   */
  async executeWorkflow(
    workflowName: string, 
    data: any, 
    contextSetup?: ContextSetupFn
  ): Promise<{
    success: boolean;
    data?: any;
    error?: string;
    runId?: string;
  }> {
    try {
      console.log(`Executing workflow: ${workflowName}`);
      
      switch (workflowName) {
        case 'business-search':
          return this.executeBusinessSearchWorkflow(data);
          
        case 'business-search-streaming':
          return this.executeBusinessSearchStreamingWorkflow(data);
          
        case 'lead-enrichment':
          return this.executeLeadEnrichmentWorkflow(data, contextSetup);
          
        default:
          return {
            success: false,
            error: `Unknown workflow: ${workflowName}`
          };
      }
    } catch (error) {
      console.error(`Error executing workflow ${workflowName}:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
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
  
  /**
   * Execute the lead enrichment workflow
   * Note: This will be implemented when the lead enrichment workflow is created
   */
  private async executeLeadEnrichmentWorkflow(data: any, contextSetup?: ContextSetupFn) {
    // This will be implemented when the workflow is created
    return {
      success: false,
      error: "Lead enrichment workflow not yet implemented"
    };
  }
}

// Create and export a singleton instance
export const workflowManager = new WorkflowManager(); 