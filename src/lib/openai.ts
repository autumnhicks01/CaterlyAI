import OpenAI from 'openai';
import { OpenAIStream } from 'ai';

/**
 * Creates a traced OpenAI client for use in production
 * Uses dynamic imports to avoid client-side issues
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
    const { wrapOpenAI } = await import('langsmith/wrappers');
    
    // Return wrapped client for tracing
    return wrapOpenAI(openaiClient);
  } catch (error) {
    console.error('Error creating traced OpenAI client:', error);
    return openaiClient;
  }
}

export const openai = (model: string) => {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  return async (messages: any[]) => {
    const response = await client.chat.completions.create({
      model,
      messages,
      temperature: 0.7,
      stream: true,
    });
    
    const stream = OpenAIStream(response);
    return stream;
  };
}; 