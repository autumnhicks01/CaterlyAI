/**
 * Helper functions for API access and stream utilities
 */

/**
 * Helper function to get the OpenAI API key
 */
export async function getOpenAIApiKey() {
  // In browser environments, we need to fetch the API key from a secure endpoint
  if (typeof window !== 'undefined') {
    try {
      // Fetch the API key from a server endpoint that can securely access environment variables
      const response = await fetch('/api/get-openai-key');
      if (!response.ok) {
        throw new Error(`Failed to get API key: ${response.status}`);
      }
      const data = await response.json();
      if (!data.apiKey) {
        throw new Error('No API key returned from server');
      }
      return data.apiKey;
    } catch (error) {
      console.error('Error fetching OpenAI API key:', error);
      throw new Error('Could not access OpenAI API key. Please try again later.');
    }
  } else {
    // Server-side, we can directly access environment variables
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("No OpenAI API key found in environment variables");
      throw new Error("Missing OpenAI API key");
    }
    return apiKey;
  }
}

/**
 * Helper function to get the Together API key (for Flux Schnell image model)
 */
export async function getTogetherApiKey() {
  // In browser environments, we need to fetch the API key from a secure endpoint
  if (typeof window !== 'undefined') {
    try {
      // Fetch the API key from a server endpoint that can securely access environment variables
      const response = await fetch('/api/get-together-key');
      if (!response.ok) {
        throw new Error(`Failed to get Together API key: ${response.status}`);
      }
      const data = await response.json();
      if (!data.apiKey) {
        throw new Error('No Together API key returned from server');
      }
      return data.apiKey;
    } catch (error) {
      console.error('Error fetching Together API key:', error);
      throw new Error('Could not access Together API key. Please try again later.');
    }
  } else {
    // Server-side, we can directly access environment variables
    const apiKey = process.env.TOGETHER_API_KEY;
    if (!apiKey) {
      console.error("No Together API key found in environment variables");
      throw new Error("Missing Together API key");
    }
    return apiKey;
  }
}

/**
 * Helper function to convert a ReadableStream to a string while also
 * forwarding chunks to a callback function
 */
export async function streamToString(stream: any, onChunk?: (chunk: string) => void): Promise<string> {
  const reader = stream.getReader();
  let result = '';
  
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      // Handle different types of chunk data
      let chunk: string;
      if (value instanceof Uint8Array) {
        // If it's already a Uint8Array, decode it
        chunk = new TextDecoder().decode(value);
      } else if (typeof value === 'string') {
        // If it's already a string, use it directly
        chunk = value;
      } else if (value && typeof value === 'object') {
        // For other object types, try to stringify
        try {
          chunk = JSON.stringify(value);
        } catch (e) {
          console.warn('Could not stringify stream value:', e);
          chunk = String(value);
        }
      } else {
        // For any other type, convert to string
        chunk = String(value || '');
      }
      
      result += chunk;
      
      if (onChunk) {
        onChunk(chunk);
      }
    }
    return result;
  } finally {
    reader.releaseLock();
  }
}

/**
 * Helper function to extract valid JSON from a string that may be wrapped in markdown code blocks
 */
export function extractJsonFromResponse(text: string): any {
  // Try direct parsing first
  try {
    return JSON.parse(text);
  } catch (e) {
    // If direct parsing fails, try to extract JSON from markdown
    try {
      // Look for JSON wrapped in code blocks
      const jsonPattern = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/;
      const match = text.match(jsonPattern);
      
      if (match && match[1]) {
        return JSON.parse(match[1]);
      }
      
      // If no code blocks, try to find JSON object directly
      const objectPattern = /(\{[\s\S]*\})/;
      const objectMatch = text.match(objectPattern);
      
      if (objectMatch && objectMatch[1]) {
        return JSON.parse(objectMatch[1]);
      }
      
      // If still not found, throw the original error
      throw e;
    } catch (nestedError) {
      console.error("Error extracting JSON from response:", text.substring(0, 200) + "...");
      throw new Error("Failed to parse AI response as JSON. Response format error.");
    }
  }
} 