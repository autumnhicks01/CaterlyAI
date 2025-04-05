import { Workflow, WorkflowResult, StepContext } from './core';

/**
 * Context setup function type
 */
export type ContextSetupFn = (context: StepContext) => void;

/**
 * Workflow manager to store and execute workflows
 */
export class WorkflowManager {
  private workflows: Map<string, Workflow> = new Map();
  
  /**
   * Register a workflow with the manager
   */
  registerWorkflow(workflow: Workflow): void {
    this.workflows.set(workflow.name, workflow);
  }
  
  /**
   * Get a workflow by name
   */
  getWorkflow(name: string): Workflow | undefined {
    return this.workflows.get(name);
  }
  
  /**
   * Execute a workflow by name
   * @param name The name of the workflow to execute
   * @param triggerData The data to trigger the workflow with
   * @param contextSetup Optional function to set up the context before execution
   */
  async executeWorkflow(
    name: string, 
    triggerData?: any, 
    contextSetup?: ContextSetupFn
  ): Promise<WorkflowResult> {
    const workflow = this.getWorkflow(name);
    
    if (!workflow) {
      throw new Error(`Workflow "${name}" not found`);
    }
    
    // Added support for context setup before execution
    if (contextSetup) {
      return workflow.execute(triggerData, contextSetup);
    }
    
    return workflow.execute(triggerData);
  }
  
  /**
   * Get all registered workflow names
   */
  getWorkflowNames(): string[] {
    return Array.from(this.workflows.keys());
  }
}

// Create and export a singleton instance
export const workflowManager = new WorkflowManager(); 