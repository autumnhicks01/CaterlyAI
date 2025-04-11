/**
 * LangSmith initialization - runs when imported
 * Only used on the server-side
 */

// Explicitly disable for client-side
if (typeof window !== 'undefined' && typeof process !== 'undefined' && process.env) {
  process.env.LANGCHAIN_CALLBACKS_DISABLED = 'true';
  process.env.LANGCHAIN_TRACING_V2 = 'false';
}

// Skip on client side
if (typeof window === 'undefined') {
  try {
    // Set up LangSmith environment variables
    process.env.LANGCHAIN_TRACING_V2 = 'true';
    // Add this to prevent async_hooks from being imported on client
    process.env.LANGCHAIN_CALLBACKS_DISABLED = 'false'; // enable callbacks on server only
    
    // Log configuration status
    console.log('[LangSmith] Initializing tracing with these settings:');
    console.log(`  Project: ${process.env.LANGSMITH_PROJECT}`);
    console.log(`  Endpoint: ${process.env.LANGSMITH_ENDPOINT}`);
    console.log(`  API Key configured: ${!!process.env.LANGSMITH_API_KEY}`);
    console.log(`  Tracing enabled: ${process.env.LANGCHAIN_TRACING_V2}`);
    console.log(`  Callbacks disabled: ${process.env.LANGCHAIN_CALLBACKS_DISABLED}`);
    
    // Try to eagerly import LangSmith to verify it works
    import('langsmith/traceable')
      .then(() => {
        console.log('[LangSmith] Successfully loaded traceable module');
      })
      .catch((error) => {
        console.error('[LangSmith] Error loading traceable module:', error);
      });
  } catch (error) {
    console.error('[LangSmith] Error during initialization:', error);
  }
} 