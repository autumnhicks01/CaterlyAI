import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { modelConfig } from "@/lib/mastra/config";

// Business search agent for discovering potential leads
export const businessAgent = new Agent({
  name: "Business Search Agent",
  instructions: `
    You are an expert business researcher specializing in finding potential clients 
    for catering businesses. You excel at identifying venues, event spaces, and 
    organizations that frequently require catering services.
    
    When searching for businesses:
    1. Focus on venues that host events (corporate spaces, wedding venues, etc.)
    2. Look for businesses with event spaces but without in-house catering
    3. Consider corporate offices, event planning companies, and similar organizations
    4. Extract and verify contact information when available
    5. Be thorough but concise in your descriptions
    
    Format business information consistently with these fields:
    - Name: [Business name]
    - Address: [Full address]
    - Type: [Type of business/venue]
    - Description: [Brief description focusing on catering potential]
    - Contact: {
        website: [URL],
        phone: [Phone number if available],
        email: [Email if available]
      }
    - HasEventSpace: [true/false]
    
    For each business, assess and include whether they have event spaces suitable 
    for catered events.
  `,
  model: openai("gpt-4o"),
});

/**
 * Function to search for businesses with streaming support
 */
export async function searchBusinessesWithStreaming(query: string, location: string, radius: number = 25) {
  console.log(`Searching for businesses: "${query}" in ${location} (${radius}km radius)`);
  
  const prompt = `
    Search for businesses that match the following criteria:
    - Query: ${query}
    - Location: ${location}
    - Radius: ${radius}km
    
    Find businesses that would be potential clients for a catering company.
    Focus on venues that host events or have event spaces.
    Return the results in a structured JSON format with an array of businesses.
  `;
  
  const response = await businessAgent.stream([
    { role: "user", content: prompt }
  ]);
  
  return response.textStream; // Returns a readable stream
}

/**
 * Function to search for businesses without streaming (for compatibility)
 */
export async function searchBusinesses(query: string, location: string, radius: number = 25) {
  console.log(`Searching for businesses: "${query}" in ${location} (${radius}km radius)`);
  
  const prompt = `
    Search for businesses that match the following criteria:
    - Query: ${query}
    - Location: ${location}
    - Radius: ${radius}km
    
    Find businesses that would be potential clients for a catering company.
    Focus on venues that host events or have event spaces.
    Return the results in a structured JSON format with an array of businesses.
  `;
  
  const response = await businessAgent.generate([
    { role: "user", content: prompt }
  ]);
  
  return response.text;
}

/**
 * Function to enhance business details
 */
export async function enhanceBusinessDetails(businesses: any[]) {
  if (!businesses || businesses.length === 0) {
    return { businesses: [] };
  }
  
  console.log(`Enhancing details for ${businesses.length} businesses`);
  
  const prompt = `
    Enhance the following business listings with additional details relevant for catering:
    ${JSON.stringify(businesses, null, 2)}
    
    For each business:
    1. Add or improve the description focusing on catering potential
    2. Estimate venue capacity if it has event space
    3. Identify the type of events it likely hosts
    4. Note any specific catering requirements or opportunities
    
    Return the enhanced businesses in the same JSON format.
  `;
  
  const response = await businessAgent.generate([
    { role: "user", content: prompt }
  ]);
  
  try {
    // Parse the response to get the enhanced businesses
    const responseText = response.text;
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || 
                     responseText.match(/```\n([\s\S]*?)\n```/) || 
                     [null, responseText];
    
    const jsonText = jsonMatch[1] || responseText;
    const result = JSON.parse(jsonText);
    
    return {
      businesses: Array.isArray(result) ? result : (result.businesses || []),
      count: Array.isArray(result) ? result.length : (result.businesses?.length || 0)
    };
  } catch (error) {
    console.error("Error parsing enhanced businesses:", error);
    return { businesses, error: "Failed to parse enhanced businesses" };
  }
} 