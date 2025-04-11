/**
 * Next.js instrumentation entry point
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

// This function is called by Next.js at startup
export async function register() {
  // Only run on server side
  if (typeof window === 'undefined') {
    // Only import instrumentation code in Node.js environment
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      try {
        // Using require instead of import for Node-specific code
        require('./instrumentation.node');
        console.log('[Instrumentation] Node.js instrumentation loaded');
      } catch (e) {
        console.error('[Instrumentation] Failed to load Node.js instrumentation:', e);
      }
    }
  }

  // Skip if we're in a browser environment
  if (typeof window !== 'undefined') {
    // Explicitly disable LangChain tracing in browser to prevent async_hooks errors
    if (typeof process !== 'undefined' && process.env) {
      process.env.LANGCHAIN_TRACING_V2 = 'false';
    }
    return;
  }

  // Check for LangSmith API key
  if (!process.env.LANGSMITH_API_KEY) {
    console.log('[LangSmith] No API key found, skipping tracing setup');
    return;
  }

  try {
    // Set up LangSmith configuration
    console.log('[LangSmith] Setting up tracing');
    
    // Enable LangChain tracing (server-side only)
    process.env.LANGCHAIN_TRACING_V2 = 'true';
    
    // Force disable import of async_hooks on client side
    process.env.NEXT_IGNORE_NODE_MODULES = '1';
    
    // Add this to prevent async_hooks from being imported on client
    process.env.LANGCHAIN_CALLBACKS_DISABLED = 'true';
    
    // Ensure project name is set
    if (!process.env.LANGSMITH_PROJECT) {
      process.env.LANGSMITH_PROJECT = 'caterly-ai';
    }
    
    console.log(`[LangSmith] Tracing enabled for project: ${process.env.LANGSMITH_PROJECT}`);
  } catch (error) {
    console.error('[LangSmith] Error setting up tracing:', error);
  }
} 