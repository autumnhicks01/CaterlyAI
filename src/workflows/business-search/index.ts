import { Workflow } from '@mastra/core/workflows';
import { 
  searchBusinessesStep, 
  enhanceBusinessesStep, 
  validateBusinessesStep,
  enhanceBusinessesStreamingStep
} from './steps';
import { businessSearchInputSchema, businessSearchResultSchema, enhancedBusinessResultSchema } from './schemas';
import { EventEmitter } from 'events';
import { ContextSetupFn } from '@/lib/workflows/core';

/**
 * Business Search Workflow
 * 
 * This workflow handles the process of searching for businesses that might need catering services,
 * enhancing the data with AI assistance, and validating their relevance for catering opportunities.
 * 
 * The workflow follows these steps:
 * 1. Search for businesses using Google Places API
 * 2. Enhance business information with AI for catering relevance
 * 3. Validate and filter businesses for final results
 */
export const businessSearchWorkflow = new Workflow({
  name: 'business-search',
  triggerSchema: businessSearchInputSchema,
});

// Define standard workflow structure
businessSearchWorkflow
  // Step 1: Search for businesses using Google Places
  .step(searchBusinessesStep)
  // Step 2: Enhance business information with AI
  .then(enhanceBusinessesStep)
  // Step 3: Validate businesses for catering relevance
  .then(validateBusinessesStep);

// Commit the workflow structure
businessSearchWorkflow.commit();

/**
 * Streaming version of the Business Search Workflow
 * This version uses the streaming enhancement step for faster results
 */
export const businessSearchStreamingWorkflow = new Workflow({
  name: 'business-search-streaming',
  triggerSchema: businessSearchInputSchema,
});

// Define streaming workflow structure
businessSearchStreamingWorkflow
  // Step 1: Search for businesses using Google Places 
  .step(searchBusinessesStep)
  // Step 2: Enhance business information with AI using streaming
  .then(enhanceBusinessesStreamingStep)
  // Step 3: Validate businesses for catering relevance
  .then(validateBusinessesStep);

// Commit the streaming workflow structure
businessSearchStreamingWorkflow.commit();

/**
 * Execute the Business Search workflow
 * 
 * @param query - Search query for businesses
 * @param location - Location to search in
 * @param radius - Optional search radius in kilometers (default: 25)
 * @param progressCallback - Optional callback for progress updates
 * @param streamCallback - Optional callback for streaming text chunks
 * @param useStreaming - Whether to use streaming enhancement (default: false)
 * @returns Results of the business search workflow
 */
export async function executeBusinessSearch(
  query: string, 
  location: string, 
  radius: number = 25,
  progressCallback?: (event: { step: string; status: string; message?: string }) => void,
  streamCallback?: (chunk: string) => void,
  useStreaming: boolean = false
) {
  // Choose the appropriate workflow based on the streaming parameter
  const workflow = useStreaming ? businessSearchStreamingWorkflow : businessSearchWorkflow;
  const { runId, start } = workflow.createRun();
  
  console.log(`Starting business search workflow (${runId}) for "${query}" in ${location}`);
  
  // Create a progress emitter if callbacks are provided
  const hasCallbacks = !!progressCallback || !!streamCallback;
  const progressEmitter = hasCallbacks ? new EventEmitter() : undefined;
  
  if (progressEmitter && progressCallback) {
    progressEmitter.on('progress', progressCallback);
    progressEmitter.on('error', ({ step, error }) => {
      progressCallback({
        step,
        status: 'failed',
        message: `Error: ${error}`
      });
    });
  }
  
  if (progressEmitter && streamCallback) {
    progressEmitter.on('stream', ({ chunk }) => {
      streamCallback(chunk);
    });
  }
  
  try {
    // Add the progress emitter to the context data
    const contextData: Record<string, any> = {};
    if (progressEmitter) {
      contextData.progressEmitter = progressEmitter;
    }
    
    // Run the workflow with the trigger data and optional context data
    const results = await start({
      triggerData: { query, location, radius },
      contextData
    });
    
    // Get the final results from the validate-businesses step
    const finalResults = results.results?.['validate-businesses'] || {};
    
    return {
      success: true,
      data: finalResults,
      runId
    };
  } catch (error) {
    console.error(`Error executing business search workflow:`, error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      runId
    };
  } finally {
    // Clean up event listeners
    if (progressEmitter) {
      progressEmitter.removeAllListeners();
    }
  }
} 