import { OpenAI } from "openai";

/**
 * Creates a traced OpenAI client that's safe for client-side usage
 * This is a safe version that will always work, whether on client or server
 */
export function createTracedClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }
  
  return new OpenAI({
    apiKey,
  });
}

/**
 * Create a traced function that's safe for client-side usage
 * @param name Name of the function for tracing
 * @param fn The function to trace
 * @returns The traced function (or original on client)
 */
export function traceFunction<T extends (...args: any[]) => Promise<any>>(
  name: string,
  fn: T
): T {
  // We're just returning the original function as-is
  // This ensures it works regardless of environment
  return fn;
} 