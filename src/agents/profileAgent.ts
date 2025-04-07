import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { modelConfig } from "@/lib/mastra/config";

// Helper function to get the OpenAI API key
async function getOpenAIApiKey() {
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
 * Profile Agent
 * 
 * Specialized agent for generating enhanced business profiles
 * with marketing-focused content and identifying ideal client types.
 */
export const profileAgent = new Agent({
  name: "Profile Agent",
  instructions: `
    You are an expert business profiler and marketing strategist specializing in the catering industry.
    
    Your task is to analyze business information and create comprehensive, compelling profiles
    that highlight the unique selling points and competitive advantages of catering businesses.
    
    For each business profile:
    1. Create a catchy, memorable tagline that encapsulates the business's unique value proposition
    2. Write an enhanced business description that highlights what makes them special
    3. Identify key selling points that would appeal to potential clients
    4. Define target audience segments with demographic and psychographic details
    5. Provide actionable marketing recommendations tailored to the business
    6. Articulate their competitive advantages in the local market
    7. Create detailed ideal client profiles with specific approach strategies
    
    Your output must be structured as a clean JSON object with the exact fields requested.
    Do not include any explanation text or comments outside the JSON structure.
    
    Focus on being specific, practical, and tailored to the catering business context.
    Avoid generic marketing language and instead highlight unique aspects of each business.
    When information is missing, make reasonable assumptions based on the industry and available details.
  `,
  model: openai(modelConfig.profileGeneration.modelName),
});

/**
 * Generate an enhanced profile with streaming support
 */
export async function generateProfileWithStreaming(profileData: any) {
  console.log(`Generating enhanced profile for: "${profileData.businessName}"`);
  
  const prompt = `
    Create a compelling business profile for a catering company based on the following information:
    ${JSON.stringify(profileData, null, 2)}
    
    Please generate the following:
    1. A catchy business tagline
    2. An enhanced business description that highlights unique aspects
    3. Key selling points (at least 5)
    4. Target audience segments (at least 3)
    5. Marketing recommendations (at least 3)
    6. Competitive advantages (at least 3)
    7. Ideal client profiles (at least 3 different types with description and approach)
    
    Return the enhanced profile in a structured JSON format with these exact fields:
    {
      "tagline": "string",
      "enhancedDescription": "string",
      "sellingPoints": ["string", "string", ...],
      "targetAudience": ["string", "string", ...],
      "marketingRecommendations": ["string", "string", ...],
      "competitiveAdvantages": ["string", "string", ...],
      "idealClients": [
        {
          "type": "string",
          "description": "string",
          "approach": "string"
        },
        ...
      ]
    }
  `;
  
  const response = await profileAgent.stream([
    { role: "user", content: prompt }
  ]);
  
  return response.textStream; // Returns a readable stream
}

/**
 * Generate an enhanced profile (without streaming)
 * Direct implementation that bypasses Mastra's agent.generate to avoid the crypto.randomUUID issue
 */
export async function generateProfile(profileData: any) {
  console.log(`Generating enhanced profile for: "${profileData.businessName}"`);
  
  const prompt = `
    Create a compelling business profile for a catering company based on the following information:
    ${JSON.stringify(profileData, null, 2)}
    
    Please generate the following:
    1. A catchy business tagline
    2. An enhanced business description that highlights unique aspects
    3. Key selling points (at least 5)
    4. Target audience segments (at least 3)
    5. Marketing recommendations (at least 3)
    6. Competitive advantages (at least 3)
    7. Ideal client profiles (at least 3 different types with description and approach)
    
    Your response MUST be a valid JSON object with these exact fields:
    {
      "tagline": "string",
      "enhancedDescription": "string", 
      "sellingPoints": ["string", "string", ...],
      "targetAudience": ["string", "string", ...],
      "marketingRecommendations": ["string", "string", ...],
      "competitiveAdvantages": ["string", "string", ...],
      "idealClients": [
        {
          "type": "string",
          "description": "string",
          "approach": "string"
        },
        ...
      ]
    }
    
    Return ONLY the JSON object without any additional text, comments, or explanations.
  `;
  
  try {
    // Create fallback data in case of API errors
    const fallbackProfile = createFallbackProfile(profileData);
    
    // Get the API key or throw error
    const apiKey = await getOpenAIApiKey();
    
    // Use direct fetch to avoid any crypto.randomUUID dependencies
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelConfig.profileGeneration.modelName,
        messages: [
          { role: "system", content: profileAgent.instructions },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: "json_object" } // Explicitly request JSON response
      })
    });
    
    if (!response.ok) {
      console.error("OpenAI API error:", response.status, response.statusText);
      const errorData = await response.json().catch(() => ({}));
      console.error("Error details:", errorData);
      
      // Return the fallback profile instead of throwing
      console.log("Using fallback profile data");
      return JSON.stringify(fallbackProfile);
    }
    
    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Clean the response to ensure it's valid JSON
    let cleanedContent = content;
    
    // Remove markdown code fences if present (```json and ```)
    if (content.includes('```')) {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch && jsonMatch[1]) {
        cleanedContent = jsonMatch[1].trim();
      }
    }
    
    // Try to parse to validate it's proper JSON
    try {
      JSON.parse(cleanedContent);
      return cleanedContent;  // Return the clean JSON string
    } catch (parseError) {
      console.error("Error parsing content as JSON:", parseError);
      console.log("Raw content:", content);
      console.log("Cleaned content:", cleanedContent);
      
      // Try to extract JSON if surrounded by other text
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const extractedJson = content.substring(jsonStart, jsonEnd + 1);
        try {
          // Validate the extracted JSON
          JSON.parse(extractedJson);
          return extractedJson;
        } catch (e) {
          // If extraction failed, return fallback
          return JSON.stringify(fallbackProfile);
        }
      }
      
      // Return fallback as last resort
      return JSON.stringify(fallbackProfile);
    }
  } catch (error) {
    console.error("Error generating profile with OpenAI:", error);
    
    // Return the fallback profile instead of throwing
    const fallbackProfile = createFallbackProfile(profileData);
    console.log("Using fallback profile data due to error:", error);
    return JSON.stringify(fallbackProfile);
  }
}

/**
 * Creates a fallback profile when AI generation fails
 */
export function createFallbackProfile(profileData: any) {
  return {
    businessName: profileData.businessName,
    location: profileData.location,
    serviceArea: profileData.serviceRadius || "Local area",
    yearsExperience: profileData.yearsInOperation || "Established catering service",
    contactPerson: {
      name: "Contact Manager",
      title: "Business Owner"
    },
    mostRequestedDishes: profileData.signatureDishesOrCuisines ?
      profileData.signatureDishesOrCuisines.split(',').map((dish: string) => dish.trim()).slice(0, 3) :
      ["Signature Dishes", "Custom Menus", "Seasonal Specialties"],
    overview: `${profileData.businessName} is a premier catering service based in ${profileData.location}. ${
      profileData.uniqueSellingPoints ? 'We specialize in ' + profileData.uniqueSellingPoints : 'We pride ourselves on exceptional food quality and service'
    }.`,
    whyChooseUs: profileData.uniqueSellingPoints ?
      profileData.uniqueSellingPoints.split(',').map((point: string) => point.trim()).slice(0, 5) :
      ["Quality ingredients", "Experienced staff", "Customizable menus", "Reliable service"],
    idealClients: profileData.idealClients || "We cater to all types of events including weddings, corporate functions, and private celebrations.",
    testimonialsAndAwards: {
      testimonials: [
        {
          quote: profileData.testimonialsOrAwards || "The food was exceptional and the service impeccable!",
          source: "Satisfied Customer"
        }
      ],
      awards: ["Local Favorite Caterer"]
    },
    contactInformation: {
      phone: profileData.contactInformation.phone,
      email: profileData.contactInformation.email,
      socialMedia: profileData.contactInformation.socialMedia.length > 0 ?
        profileData.contactInformation.socialMedia :
        ["Website: " + profileData.contactInformation.website]
    }
  };
} 