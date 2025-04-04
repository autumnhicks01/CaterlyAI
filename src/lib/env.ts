/**
 * Validates that required environment variables are set
 */
export function validateEnv() {
  const requiredEnvVars = [
    'OPENAI_API_KEY',
  ];

  const missingEnvVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  );

  if (missingEnvVars.length > 0) {
    console.error(
      `Error: Missing required environment variables: ${missingEnvVars.join(', ')}`
    );
    console.error('Please set these variables in your .env.local file');
    return false;
  }

  return true;
}

/**
 * Gets the OpenAI API key from environment variables
 */
export function getOpenAIApiKey(): string {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }
  return process.env.OPENAI_API_KEY;
} 