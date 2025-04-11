import '@/lib/langsmith-init';
import { BusinessSearchInput } from '@/workflows/business-search/schemas';
import { executeBusinessSearch, businessSearchStreamingWorkflow } from '@/workflows/business-search';
import { LeadEnrichmentInput, OutreachCampaignInput } from '@/workflows/index';
import { enrichLeads } from '@/agents/enrichmentAgent';
import { executeOutreachCampaign } from '@/workflows/outreach-campaign';
import EventEmitter from 'events';
import { WorkflowOptions } from '@mastra/core/workflows';
import { createTraceableFunction } from '@/lib/langsmith-client';

type ContextSetupFn = (context: any) => void;

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

/**
 * WorkflowManager provides a unified interface for executing workflows
 * This abstraction allows for easier usage across the application
 */
export class WorkflowManager {
  private workflowName: string;

  /**
   * Create a new workflow manager
   * @param workflowName Default workflow name for this manager
   */
  constructor(workflowName: string = 'default') {
    this.workflowName = workflowName;
  }

  /**
   * Start a workflow by name
   * @param workflowName - Name of the workflow to execute
   * @param data - Input data for the workflow
   * @param options - Options for the workflow run
   * @returns Result of the workflow execution
   */
  async startWorkflow(workflowName: string, data: any, options?: WorkflowOptions): Promise<any> {
    return this.executeWorkflow(workflowName, data, options);
  }

  /**
   * Execute a workflow by name
   * @param workflowName - Name of the workflow to execute
   * @param data - Input data for the workflow
   * @param options - Options for the workflow run
   * @returns Result of the workflow execution
   */
  async executeWorkflow(workflowName: string, data: any, options?: WorkflowOptions): Promise<any> {
    console.log(`Executing workflow: ${workflowName}`);
    
    try {
      switch (workflowName) {
        case 'business-search':
          return this.executeBusinessSearchWorkflow(data);
        
        case 'lead-enrichment':
        case 'lead-enrichment-direct':
          return this.executeLeadEnrichmentWorkflow(data);
          
        case 'outreach-campaign':
          return this.executeOutreachCampaignWorkflow(data);
          
        default:
          throw new Error(`Workflow ${workflowName} not found`);
      }
    } catch (error) {
      console.error(`Error executing workflow ${workflowName}:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
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
   */
  private async executeLeadEnrichmentWorkflow(data: any) {
    // For direct enrichment with lead objects
    if (data.leads && Array.isArray(data.leads)) {
      const leadIds = data.leads.map((lead: any) => lead.id).filter(Boolean);
      
      if (leadIds.length === 0) {
        return {
          success: false,
          enrichedBusinesses: [],
          error: "No valid lead IDs provided for enrichment"
        };
      }
      
      return enrichLeads(leadIds);
    }
    
    // Standard enrichment with leadIds
    return enrichLeads(data.leadIds || []);
  }

  /**
   * Execute the outreach campaign workflow
   */
  private async executeOutreachCampaignWorkflow(data: OutreachCampaignInput) {
    const { categories, userEmail } = data;
    
    // Create a progress callback function if needed
    const progressCallback = data.progressEmitter ? 
      (event: { step: string; status: string; message?: string }) => {
        data.progressEmitter?.emit('progress', event);
      } : undefined;
    
    return executeOutreachCampaign(categories || [], userEmail, progressCallback);
  }
}

// Create and export a singleton instance
export const workflowManager = new WorkflowManager();

export default WorkflowManager; 