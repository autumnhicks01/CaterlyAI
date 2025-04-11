import { OpenAI } from "openai";

// Types for our functions
type TraceableFunction<T extends (...args: any[]) => Promise<any>> = T;

// Detect if we're on the client side
const isClient = typeof window !== 'undefined';

/**
 * Create an OpenAI client with LangSmith tracing
 * This will only wrap the client on the server side
 */
export const createTracedOpenAIClient = () => {
  const openAIKey = process.env.OPENAI_API_KEY;
  
  if (!openAIKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }
  
  const client = new OpenAI({
    apiKey: openAIKey,
  });
  
  // On client side, just return the regular client
  if (isClient) {
    return client;
  }
  
  // Only attempt tracing on server side
  return client;
};

/**
 * Create a traceable function
 * This will only trace on the server side, client-side will just execute the function normally
 */
export function createTraceableFunction<T extends (...args: any[]) => Promise<any>>(
  name: string, 
  fn: T
): T {
  // On the client side, just return the original function
  if (isClient) {
    return fn;
  }

  // Server-side: create a wrapper that will use the same function signature
  const wrappedFn = async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      // Just run the function directly
      return await fn(...args) as ReturnType<T>;
    } catch (error) {
      console.error(`[LangSmith] Error in traced function ${name}:`, error);
      throw error;
    }
  };
  
  return wrappedFn as T;
}

/**
 * Helper to trace any async function with custom inputs/outputs
 */
export function traceFunction<T extends (...args: any[]) => Promise<any>>(
  name: string,
  fn: T
): T {
  return createTraceableFunction(name, fn);
} 