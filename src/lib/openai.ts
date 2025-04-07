import { OpenAI } from 'openai';
import { OpenAIStream } from 'ai';

// Create OpenAI client
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.warn('Missing OPENAI_API_KEY environment variable');
}

export const openai = (model: string) => {
  const client = new OpenAI({ apiKey });
  
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