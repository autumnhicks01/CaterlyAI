import OpenAI from 'openai';

// Set a global flag to avoid async_hooks import issues
if (typeof window !== 'undefined' && typeof process !== 'undefined' && process.env) {
  process.env.LANGCHAIN_CALLBACKS_DISABLED = 'true';
  process.env.LANGCHAIN_TRACING_V2 = 'false';
}

/**
 * Creates a traced OpenAI client for production with LangSmith
 */
export async function createTracedOpenAIClient() {
  // Create base OpenAI client
  const openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  // Only use LangSmith on server-side
  if (typeof window !== 'undefined') {
    return openaiClient;
  }
  
  try {
    // Dynamically import LangSmith wrappers
    // Use dynamic import with error handling for server-side only modules
    const wrapperModule = await import('langsmith/wrappers').catch(err => {
      console.error('Failed to load langsmith/wrappers:', err);
      return { wrapOpenAI: null };
    });
    
    // Return wrapped client for tracing if the import succeeded
    if (wrapperModule.wrapOpenAI) {
      return wrapperModule.wrapOpenAI(openaiClient);
    }
    
    return openaiClient;
  } catch (error) {
    console.error('Error creating traced OpenAI client:', error);
    return openaiClient;
  }
}

/**
 * Creates a traced function that will be tracked in LangSmith
 */
export async function createTraceableFunction<T extends (...args: any[]) => Promise<any>>(
  name: string,
  fn: T
): Promise<T> {
  // Only use LangSmith on server-side
  if (typeof window !== 'undefined') {
    return fn;
  }
  
  try {
    // Dynamically import from the traceable module
    // Use dynamic import with error handling for server-side only modules
    const traceableModule = await import('langsmith/traceable').catch(err => {
      console.error('Failed to load langsmith/traceable:', err);
      return { traceable: null };
    });
    
    // Create traced function if the import succeeded
    if (traceableModule.traceable) {
      // @ts-ignore - Type definitions don't correctly capture options
      return traceableModule.traceable({ name })(fn);
    }
    
    return fn;
  } catch (error) {
    console.error(`Error creating traced function ${name}:`, error);
    return fn;
  }
} 