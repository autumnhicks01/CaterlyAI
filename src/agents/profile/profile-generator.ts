import { profileAgent } from './agent';
import { getOpenAIApiKey, streamToString } from './api-helpers';
import { modelConfig } from '@/lib/mastra/config';

/**
 * Generate an enhanced profile with streaming support
 */
export async function generateProfileWithStreaming(profileData: any) {
  console.log(`Generating enhanced profile for: "${profileData.businessName}"`);
  
  const prompt = createProfilePrompt(profileData);
  
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
  
  const prompt = createProfilePrompt(profileData);
  
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
 * Creates a profile generation prompt
 */
function createProfilePrompt(profileData: any): string {
  return `
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
      phone: profileData.contactInformation?.phone || '',
      email: profileData.contactInformation?.email || '',
      socialMedia: profileData.contactInformation?.socialMedia?.length > 0 ?
        profileData.contactInformation.socialMedia :
        [(profileData.contactInformation?.website ? "Website: " + profileData.contactInformation.website : "")]
    }
  };
} 