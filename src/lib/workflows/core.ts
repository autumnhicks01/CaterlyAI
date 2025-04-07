import { z } from 'zod';
import { EventEmitter } from 'events';

/**
 * Function to set up the execution context before workflow starts
 */
export type ContextSetupFn = (context: StepContext) => void;

/**
 * Progress event types for workflow execution
 */
export interface ProgressEvent {
  step: string;
  status: 'started' | 'completed' | 'failed';
  count?: number;
  message?: string;
}

/**
 * Stream event for real-time text streaming
 */
export interface StreamEvent {
  step: string;
  chunk: string;
}

/**
 * Error event for workflow execution
 */
export interface ErrorEvent {
  step: string;
  error: string;
}

/**
 * Status of a step's execution
 */
export enum StepStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped'
}

/**
 * Result of a step's execution
 */
export interface StepResult {
  status: StepStatus;
  data?: any;
  error?: string;
  startTime?: Date;
  endTime?: Date;
}

/**
 * Context for workflow execution
 */
export interface WorkflowContext {
  triggerData?: any;
  steps: Step[];
  variables: Record<string, any>;
  progressEmitter?: EventEmitter;
  results: Record<string, StepResult>;
}

/**
 * Context for step execution
 */
export interface StepContext {
  getStepResult: <T = any>(stepId: string) => T | undefined;
  triggerData?: any;
  variables: Record<string, any>;
  progressEmitter?: EventEmitter;
}

/**
 * Workflow step definition
 */
export class Step {
  id: string;
  description?: string;
  execute: (options: { context: StepContext }) => Promise<any>;

  constructor(options: {
    id: string;
    description?: string;
    execute: (options: { context: StepContext }) => Promise<any>;
  }) {
    this.id = options.id;
    this.description = options.description;
    this.execute = options.execute;
  }
}

/**
 * Workflow definition
 */
export class Workflow {
  name: string;
  steps: Step[] = [];
  triggerSchema: any;

  constructor(options: {
    name: string;
    triggerSchema: any;
  }) {
    this.name = options.name;
    this.triggerSchema = options.triggerSchema;
  }

  /**
   * Add a step to the workflow
   */
  step(step: Step) {
    this.steps.push(step);
    return this;
  }

  /**
   * Add a step to execute after the previous step
   */
  then(step: Step) {
    this.steps.push(step);
    return this;
  }

  /**
   * Commit the workflow definition
   */
  commit() {
    // Validation and finalization of workflow structure
    console.log(`Workflow ${this.name} committed with ${this.steps.length} steps`);
    return this;
  }

  /**
   * Create a new run of the workflow
   */
  createRun() {
    const runId = generateRunId();
    
    return {
      runId,
      start: async (options: { 
        triggerData: any;
        contextSetup?: ContextSetupFn;
        enableProgressEvents?: boolean;
      }) => {
        return this.execute(runId, options);
      }
    };
  }

  /**
   * Execute the workflow
   */
  async execute(runId: string, options: { 
    triggerData: any;
    contextSetup?: ContextSetupFn;
    enableProgressEvents?: boolean;
  }): Promise<any> {
    console.log(`Executing workflow ${this.name} (${runId})`);
    
    // Validate trigger data against schema
    if (this.triggerSchema) {
      try {
        options.triggerData = this.triggerSchema.parse(options.triggerData);
      } catch (error) {
        throw new Error(`Invalid trigger data: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // Set up progress emitter if enabled
    const progressEmitter = options.enableProgressEvents ? new EventEmitter() : undefined;
    
    // Store results for each step
    const results: Record<string, StepResult> = {
      trigger: {
        status: StepStatus.COMPLETED,
        data: options.triggerData,
        startTime: new Date(),
        endTime: new Date()
      }
    };
    
    // Create workflow context
    const context: WorkflowContext = {
      triggerData: options.triggerData,
      steps: this.steps,
      variables: {},
      progressEmitter,
      results
    };
    
    // Create step context
    const stepContext: StepContext = {
      getStepResult: (stepId) => results[stepId]?.data,
      triggerData: options.triggerData,
      variables: context.variables,
      progressEmitter
    };
    
    // Run context setup if provided
    if (options.contextSetup) {
      options.contextSetup(stepContext);
    }
    
    // Execute steps sequentially
    for (const step of this.steps) {
      try {
        console.log(`Executing step ${step.id}`);
        
        // Mark step as running
        results[step.id] = {
          status: StepStatus.RUNNING,
          startTime: new Date()
        };
        
        if (progressEmitter) {
          progressEmitter.emit('progress', {
            step: step.id,
            status: 'started',
            message: `Starting step: ${step.description || step.id}`
          });
        }
        
        // Execute the step
        const result = await step.execute({ context: stepContext });
        
        // Store result as completed
        results[step.id] = {
          status: StepStatus.COMPLETED,
          data: result,
          startTime: results[step.id].startTime,
          endTime: new Date()
        };
        
        if (progressEmitter) {
          progressEmitter.emit('progress', {
            step: step.id,
            status: 'completed',
            message: `Completed step: ${step.description || step.id}`
          });
        }
      } catch (error) {
        console.error(`Error executing step ${step.id}:`, error);
        
        // Store result as failed
        results[step.id] = {
          status: StepStatus.FAILED,
          error: error instanceof Error ? error.message : String(error),
          startTime: results[step.id]?.startTime,
          endTime: new Date()
        };
        
        if (progressEmitter) {
          progressEmitter.emit('error', {
            step: step.id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
        
        throw new Error(`Error in step ${step.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    return {
      runId,
      results: Object.fromEntries(
        Object.entries(results).map(([stepId, result]) => [stepId, result.data])
      )
    };
  }
}

/**
 * Generate a unique run ID
 */
function generateRunId() {
  return `run_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
} 