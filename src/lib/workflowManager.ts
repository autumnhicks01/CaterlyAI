import { BusinessSearchInput } from '@/workflows/business-search/schemas';
import { executeBusinessSearch } from '@/workflows/business-search';
import { ProfileGenerationInput } from '@/workflows/profile-generation/schemas';
import { executeProfileGeneration } from '@/workflows/profile-generation';
import { ContextSetupFn } from '@/lib/workflows/core';

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
          
        case 'lead-enrichment':
          return this.executeLeadEnrichmentWorkflow(data, contextSetup);
          
        case 'profile-generation':
          return this.executeProfileGenerationWorkflow(data, contextSetup);
          
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
  
  /**
   * Execute the profile generation workflow
   */
  private async executeProfileGenerationWorkflow(data: any, contextSetup?: ContextSetupFn) {
    // Extract profile data and user ID
    const { userId, ...profileData } = data;
    
    if (!userId) {
      return {
        success: false,
        error: "User ID is required for profile generation"
      };
    }
    
    // Execute the profile generation workflow
    return executeProfileGeneration(profileData, userId);
  }
}

// Create and export a singleton instance
export const workflowManager = new WorkflowManager(); 