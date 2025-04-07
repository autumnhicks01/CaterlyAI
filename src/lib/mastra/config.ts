import { z } from 'zod';

/**
 * Environment variable validation for Mastra configuration
 */
export const mastraEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OpenAI API key is required"),
  // Make Google Places API key optional to avoid blocking workflow functionality
  GOOGLE_PLACES_API_KEY: z.string().optional(),
  // Make Database URL optional for development
  DATABASE_URL: z.string().optional(),
});

/**
 * Validates the environment variables required for Mastra
 * Returns true even if optional variables are missing
 */
export function validateMastraEnv() {
  try {
    // For development, be more lenient with environment variables
    const isDev = process.env.NODE_ENV === 'development';
    
    const result = mastraEnvSchema.safeParse({
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY,
      DATABASE_URL: process.env.DATABASE_URL,
    });

    if (!result.success) {
      const errorMessages = result.error.errors
        .filter(err => {
          // In development, only show errors for required fields
          if (isDev) {
            return err.path.includes('OPENAI_API_KEY');
          }
          return true;
        })
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join('\n');
      
      if (errorMessages) {
        console.warn(`Mastra environment warning:\n${errorMessages}`);
        
        // Only throw if OpenAI key is missing
        if (errorMessages.includes('OPENAI_API_KEY')) {
          throw new Error(`Mastra environment validation failed:\n${errorMessages}`);
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error("Environment validation error:", error);
    if (process.env.NODE_ENV === 'development') {
      console.warn("Continuing despite validation error in development mode");
      return true;
    }
    return false;
  }
}

/**
 * Model configuration for different tasks
 */
export const modelConfig = {
  businessSearch: {
    modelName: "gpt-4o-mini",
    temperature: 0.2,
    maxTokens: 1000,
  },
  leadEnrichment: {
    modelName: "gpt-4o",
    temperature: 0.3,
    maxTokens: 2000,
  },
  profileGeneration: {
    modelName: "gpt-4o",
    temperature: 0.7,
    maxTokens: 4000,
  }
}; 