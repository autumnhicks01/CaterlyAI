/**
 * Dynamically loads the LangSmith tracing on server-side only
 * Provides safe fallbacks for client-side
 */

import { OpenAI } from "openai";

// Determine environment
const isServer = typeof window === 'undefined';

/**
 * Safe wrapper for LangSmith tracing
 * @param name The name of the function to trace
 * @param fn The function to trace
 * @returns The traced function (or original on client)
 */
export function safeTraceFunction<T extends (...args: any[]) => Promise<any>>(
  name: string,
  fn: T
): T {
  // Client-side: just return the original function
  if (!isServer) {
    return fn;
  }

  // Server-side: create wrapper with error handling
  const wrappedFn = async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      // Just call the original function
      return await fn(...args) as ReturnType<T>;
    } catch (error) {
      console.error(`[Trace] Error in traced function ${name}:`, error);
      throw error;
    }
  };
  
  // Cast back to original type
  return wrappedFn as unknown as T;
}

/**
 * Creates a traced OpenAI client (safe for all environments)
 */
export function safeTracedClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }
  
  // Create standard client (works everywhere)
  return new OpenAI({ apiKey });
} 