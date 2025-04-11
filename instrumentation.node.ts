/**
 * Node.js specific instrumentation
 * This file is only imported in Node.js environment
 */

// Import OpenTelemetry packages - using require instead of import for better compatibility
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

// Enable LangSmith tracing
process.env.LANGCHAIN_TRACING_V2 = 'true';

// Set project name if not already set
if (!process.env.LANGSMITH_PROJECT) {
  process.env.LANGSMITH_PROJECT = 'caterly-ai';
}

// Log configuration
console.log('[LangSmith] Initializing tracing with OpenTelemetry...');
console.log(`  Project: ${process.env.LANGSMITH_PROJECT}`);
console.log(`  API Key configured: ${!!process.env.LANGSMITH_API_KEY}`);
console.log(`  Endpoint: ${process.env.LANGSMITH_ENDPOINT || 'default'}`);

try {
  // Create SDK with minimal configuration
  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'caterly-ai',
    }),
  });

  // Start the SDK
  sdk.start();
  console.log('[OpenTelemetry] SDK started successfully');
} catch (error) {
  console.error('[OpenTelemetry] Failed to start SDK:', error);
} 