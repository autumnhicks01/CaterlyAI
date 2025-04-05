import { z } from 'zod';

/**
 * Workflow step status
 */
export enum StepStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

/**
 * Step result containing output data and status
 */
export interface StepResult<T = any> {
  id: string;
  status: StepStatus;
  data?: T;
  error?: Error;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

/**
 * Context setup function type
 */
export type ContextSetupFn = (context: StepContext) => void;

/**
 * Step context for passing data between steps
 */
export class StepContext {
  private results: Map<string, StepResult> = new Map();
  
  constructor(
    private triggerData?: any,
    private metadata: Record<string, any> = {}
  ) {}
  
  /**
   * Get the trigger data that started the workflow
   */
  getTriggerData<T = any>(): T | undefined {
    return this.triggerData as T;
  }
  
  /**
   * Set the result of a step
   */
  setStepResult(stepId: string, result: StepResult): void {
    this.results.set(stepId, result);
  }
  
  /**
   * Get the result of a previous step
   */
  getStepResult<T = any>(stepId: string): T | undefined {
    const result = this.results.get(stepId);
    return result?.data as T;
  }
  
  /**
   * Check if a step has been completed
   */
  hasStepCompleted(stepId: string): boolean {
    const result = this.results.get(stepId);
    return result?.status === StepStatus.COMPLETED;
  }
  
  /**
   * Get metadata
   */
  getMetadata<T = any>(key: string): T | undefined {
    return this.metadata[key] as T;
  }
  
  /**
   * Set metadata
   */
  setMetadata(key: string, value: any): void {
    this.metadata[key] = value;
  }
  
  /**
   * Get all step results
   */
  getAllResults(): Map<string, StepResult> {
    return new Map(this.results);
  }
}

/**
 * Step options
 */
export interface StepOptions<TInput = any, TOutput = any> {
  id: string;
  description?: string;
  inputSchema?: z.ZodType<TInput>;
  execute: (params: {
    context: StepContext;
    input?: TInput;
  }) => Promise<TOutput>;
  onError?: (error: Error, context: StepContext) => Promise<void>;
  retry?: {
    maxAttempts: number;
    backoffFactor?: number;
  };
}

/**
 * Workflow step definition
 */
export class Step<TInput = any, TOutput = any> {
  constructor(private options: StepOptions<TInput, TOutput>) {}
  
  get id(): string {
    return this.options.id;
  }
  
  get description(): string {
    return this.options.description || this.options.id;
  }
  
  /**
   * Execute this step
   */
  async execute(context: StepContext): Promise<StepResult<TOutput>> {
    const startTime = new Date();
    const result: StepResult<TOutput> = {
      id: this.options.id,
      status: StepStatus.RUNNING,
      startTime
    };
    
    try {
      // Validate input if schema is provided
      let input: TInput | undefined;
      
      if (this.options.inputSchema) {
        const triggerData = context.getTriggerData();
        
        // Try to validate the trigger data directly
        try {
          input = this.options.inputSchema.parse(triggerData);
        } catch (error) {
          // If validation fails, try to get input from a previous step with the same name
          const previousStepResult = context.getStepResult<TInput>(this.options.id);
          
          if (previousStepResult) {
            input = previousStepResult;
          } else {
            throw error;
          }
        }
      }
      
      // Execute the step
      const data = await this.options.execute({ 
        context, 
        input
      });
      
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      // Update result with success data
      result.status = StepStatus.COMPLETED;
      result.data = data;
      result.endTime = endTime;
      result.duration = duration;
      
      // Store the result in the context
      context.setStepResult(this.options.id, result);
      
      return result;
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      // Update result with error data
      result.status = StepStatus.FAILED;
      result.error = error instanceof Error ? error : new Error(String(error));
      result.endTime = endTime;
      result.duration = duration;
      
      // Call error handler if provided
      if (this.options.onError) {
        await this.options.onError(result.error, context);
      }
      
      // Store the result in the context
      context.setStepResult(this.options.id, result);
      
      throw result.error;
    }
  }
}

/**
 * Workflow definition
 */
export interface WorkflowOptions<TTrigger = any> {
  name: string;
  description?: string;
  triggerSchema?: z.ZodType<TTrigger>;
  steps?: Step[];
}

/**
 * Workflow result
 */
export interface WorkflowResult {
  workflowId: string;
  success: boolean;
  stepResults: Map<string, StepResult>;
  error?: Error;
  startTime: Date;
  endTime: Date;
  duration: number;
}

/**
 * Workflow definition
 */
export class Workflow<TTrigger = any> {
  private steps: Step[] = [];
  private dependencies: Map<string, string[]> = new Map();
  
  constructor(private options: WorkflowOptions<TTrigger>) {
    if (options.steps) {
      this.steps = [...options.steps];
    }
  }
  
  get name(): string {
    return this.options.name;
  }
  
  get description(): string {
    return this.options.description || this.options.name;
  }
  
  /**
   * Add a step to the workflow
   */
  step<TInput, TOutput>(step: Step<TInput, TOutput>): Workflow<TTrigger> {
    this.steps.push(step);
    return this;
  }
  
  /**
   * Add a step that depends on another step
   */
  after<TInput, TOutput>(stepId: string, step: Step<TInput, TOutput>): Workflow<TTrigger> {
    this.steps.push(step);
    
    // Add dependency
    const deps = this.dependencies.get(step.id) || [];
    deps.push(stepId);
    this.dependencies.set(step.id, deps);
    
    return this;
  }
  
  /**
   * Add a step that runs after the previous step
   */
  then<TInput, TOutput>(step: Step<TInput, TOutput>): Workflow<TTrigger> {
    if (this.steps.length === 0) {
      return this.step(step);
    }
    
    const previousStep = this.steps[this.steps.length - 1];
    return this.after(previousStep.id, step);
  }
  
  /**
   * Execute the workflow
   * @param triggerData The data to trigger the workflow with
   * @param contextSetup Optional function to set up the context before execution
   */
  async execute(
    triggerData?: TTrigger,
    contextSetup?: ContextSetupFn
  ): Promise<WorkflowResult> {
    // Validate trigger data if schema is provided
    if (this.options.triggerSchema && triggerData) {
      triggerData = this.options.triggerSchema.parse(triggerData);
    }
    
    const context = new StepContext(triggerData);
    
    // Apply context setup if provided
    if (contextSetup) {
      contextSetup(context);
    }
    
    const startTime = new Date();
    
    // Track which steps have been executed
    const executed = new Set<string>();
    
    // Keep trying to execute steps until all are done
    const maxIterations = this.steps.length * 2; // Prevent infinite loops
    let iteration = 0;
    
    try {
      while (executed.size < this.steps.length && iteration < maxIterations) {
        iteration++;
        
        // Find steps that can be executed (all dependencies satisfied)
        for (const step of this.steps) {
          // Skip already executed steps
          if (executed.has(step.id)) {
            continue;
          }
          
          // Check if all dependencies are satisfied
          const dependencies = this.dependencies.get(step.id) || [];
          const dependenciesSatisfied = dependencies.every(depId => 
            executed.has(depId) && context.hasStepCompleted(depId)
          );
          
          if (dependenciesSatisfied) {
            // Execute the step
            await step.execute(context);
            executed.add(step.id);
          }
        }
      }
      
      // If not all steps were executed, there might be a cycle
      if (executed.size < this.steps.length) {
        throw new Error(`Workflow execution stuck, possible cycle in dependencies. Executed ${executed.size}/${this.steps.length} steps.`);
      }
      
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      return {
        workflowId: this.options.name,
        success: true,
        stepResults: context.getAllResults(),
        startTime,
        endTime,
        duration
      };
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      return {
        workflowId: this.options.name,
        success: false,
        stepResults: context.getAllResults(),
        error: error instanceof Error ? error : new Error(String(error)),
        startTime,
        endTime,
        duration
      };
    }
  }
} 