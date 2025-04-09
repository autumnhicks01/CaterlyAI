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

// Helper function to get the Together API key (for Flux Schnell image model)
async function getTogetherApiKey() {
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

/**
 * Helper function to extract valid JSON from a string that may be wrapped in markdown code blocks
 */
function extractJsonFromResponse(text: string): any {
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

/**
 * Generate a marketing flyer for a catering business using a three-step AI process:
 * 1. AI Marketer: Creates a catchy flyer concept based on the business profile
 * 2. AI Copy Editor: Refines the concept for clarity and impact
 * 3. Flux LoRA: Generates the flyer image based on the refined concept
 * 
 * @param profileData - The business profile data including enhanced profile information
 * @param streaming - Whether to return a streaming response (default: false)
 * @returns Either a streaming response or a Promise resolving to a JSON string
 */
export async function generateFlyer(profileData: any, streaming = false) {
  // Ensure we have a business name for logging
  const businessName = profileData.businessName || 
                       profileData.business_name || 
                       "Catering Business";
  
  console.log(`Generating marketing flyer for: "${businessName}"`);
  
  // Create a safe copy of the profile data
  const safeProfileData = {
    ...profileData,
    businessName,
    // Ensure other critical fields are present
    tagline: profileData.tagline || `${businessName} - Professional Catering`,
    enhancedDescription: profileData.enhancedDescription || 
                         `${businessName} is a professional catering service offering quality food and exceptional service.`
  };
  
  // If streaming is requested, return a streaming response
  if (streaming) {
    return generateFlyerStream(safeProfileData);
  }
  
  // Otherwise, return a Promise resolving to a JSON string
  try {
  // Step 1: AI Marketer creates the flyer concept
    const marketingPrompt = getMarketingPrompt(safeProfileData);
    
    // Get the API key
    const apiKey = await getOpenAIApiKey();
    
    // Step 1: Get the marketing concept
    const marketingResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelConfig.flyerGeneration.modelName || modelConfig.profileGeneration.modelName,
        messages: [
          { 
            role: "system", 
            content: "You are an expert AI marketer specializing in the catering industry." 
          },
          { role: "user", content: marketingPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });
    
    if (!marketingResponse.ok) {
      const errorData = await marketingResponse.json().catch(() => ({}));
      throw new Error(`Marketing concept API error: ${marketingResponse.status} - ${JSON.stringify(errorData)}`);
    }
    
    const marketingData = await marketingResponse.json();
    const marketingConcept = marketingData.choices[0].message.content;
    
    // Step 2: Pass to AI Copy Editor for refinement
    const editorPrompt = getEditorPrompt(marketingConcept, safeProfileData);
    
    const editorResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelConfig.flyerGeneration.modelName || modelConfig.profileGeneration.modelName,
        messages: [
          { 
            role: "system", 
            content: "You are an expert AI copy editor specializing in marketing materials for catering businesses." 
          },
          { role: "user", content: editorPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });
    
    if (!editorResponse.ok) {
      const errorData = await editorResponse.json().catch(() => ({}));
      throw new Error(`Copy editor API error: ${editorResponse.status} - ${JSON.stringify(errorData)}`);
    }
    
    const editorData = await editorResponse.json();
    const refinedCopy = editorData.choices[0].message.content;
    
    // Extract important business info and flyer concept for the image prompt
    const flyrJson = extractJsonFromResponse(refinedCopy);
    
    // Step 3: Generate the image using Flux LoRA
    const imagePrompt = getImagePrompt(flyrJson, businessName);
    const imageUrl = await generateFlyerImage(imagePrompt);
    
    // Return the full result
    return JSON.stringify({
      marketingConcept,
      refinedCopy,
      imageUrl,
      metadata: {
        generatedAt: new Date().toISOString(),
        businessName: businessName
      }
    });
    
  } catch (error: any) {
    console.error("Error generating flyer:", error);
    
    // Return a fallback response
    return JSON.stringify({
      marketingConcept: `${businessName} - Professional Catering Services`,
      refinedCopy: `We were unable to generate a complete flyer due to a technical error. Please try again later.`,
      imageUrl: null,
      error: error.message || "Unknown error occurred",
      metadata: {
        generatedAt: new Date().toISOString(),
        error: true
      }
    });
  }
}

/**
 * Helper function for streaming flyer generation
 */
async function generateFlyerStream(safeProfileData: any) {
  const businessName = safeProfileData.businessName;
  const encoder = new TextEncoder();
  
  // Create a readable stream for the entire process with proper error handling
  return new ReadableStream({
    async start(controller) {
      try {
        // Add header to indicate the marketing concept portion
        controller.enqueue(encoder.encode("## MARKETING CONCEPT ##\n\n"));
        
        // Step 1: AI Marketer creates the concept
        let marketerResponse;
        try {
          marketerResponse = await profileAgent.stream([
            { role: "system", content: "You are an expert AI marketer specializing in the catering industry." },
            { role: "user", content: getMarketingPrompt(safeProfileData) }
          ]);
          
          // Process the marketer's response as it streams
          const marketingConcept = await streamToString(marketerResponse.textStream, 
            (chunk) => controller.enqueue(encoder.encode(chunk)));
          
          // Step 2: Pass to AI Copy Editor for refinement
          controller.enqueue(encoder.encode("\n\n## REFINED COPY ##\n\n"));
          
          const editorResponse = await profileAgent.stream([
            { role: "system", content: "You are an expert AI copy editor specializing in marketing materials for catering businesses." },
            { role: "user", content: getEditorPrompt(marketingConcept, safeProfileData) }
          ]);
          
          // Process the editor's response as it streams
          const refinedCopy = await streamToString(editorResponse.textStream, 
            (chunk) => controller.enqueue(encoder.encode(chunk)));
          
          // Step 3: Generate the flyer image
          controller.enqueue(encoder.encode("\n\n## GENERATING FLYER IMAGE ##\n\n"));
          controller.enqueue(encoder.encode("Generating catering flyer with Flux LoRA...\n"));
          
          // Extract important business info and flyer concept for the image prompt
          const flyrJson = extractJsonFromResponse(refinedCopy);
          
          // Create an optimized prompt for the image generation
          const imagePrompt = getImagePrompt(flyrJson, businessName);
          
          // Generate the image
          const imageUrl = await generateFlyerImage(imagePrompt);
          
          // Return the image URL
          controller.enqueue(encoder.encode("\n\n## FLYER IMAGE URL ##\n\n"));
          controller.enqueue(encoder.encode(imageUrl));
          
          // Add a JSON representation of the entire result for easier parsing
          controller.enqueue(encoder.encode("\n\n## FLYER_DATA_JSON ##\n\n"));
          const resultJson = JSON.stringify({
            marketingConcept,
            refinedCopy,
            imageUrl
          });
          controller.enqueue(encoder.encode(resultJson));
          
        } catch (error: any) {
          console.error("Error in AI Marketer or Copy Editor:", error);
          controller.enqueue(encoder.encode(`Error generating flyer content: ${error.message || "Unknown error"}`));
          throw error; // Rethrow to be caught by the outer try/catch
        }
      } catch (error: any) {
        console.error("Error generating flyer image:", error);
        controller.enqueue(encoder.encode(`Error generating image: ${error.message || "Unknown error"}`));
      } finally {
        // Always close the stream when done
        controller.close();
      }
    }
  });
}

/**
 * Helper function to generate the marketing prompt
 */
function getMarketingPrompt(profileData: any) {
  return `
    As an expert AI marketer specializing in the catering industry, you will create the ACTUAL CONTENT 
    for a real marketing flyer, not just a concept. This content will be used to create a REAL
    PRINT-READY flyer for the following catering business:
    
    ${JSON.stringify(profileData, null, 2)}
    
    Your task is to write the EXACT TEXT that will appear on the final printed flyer, including:
    1. A powerful headline that captures attention
    2. 2-3 compelling subheadings
    3. 3-5 key selling points that highlight unique advantages
    4. A clear call-to-action that prompts potential clients to make contact
    5. Business contact information formatted for the flyer
    
    IMPORTANT GUIDELINES:
    - This is NOT a concept or mockup - your text will be used verbatim on the final printed flyer
    - Write concise, impactful copy that will fit well on a single-page flyer
    - Include REAL business details from the profile (not placeholder text)
    - Focus on specific, unique aspects of this particular catering business
    - Use language appropriate for their target audience
    
    Return this FINAL FLYER CONTENT as a structured JSON object with these fields:
    {
      "headline": "Main attention-grabbing headline",
      "subheadings": ["2-3 compelling subheadings"],
      "keyPoints": ["3-5 key selling points to include"],
      "callToAction": "Clear call to action with contact method",
      "visualTheme": "Description of the visual style that complements the content",
      "colorScheme": "Suggested color palette that reinforces brand identity",
      "businessInfo": {
        "name": "${profileData.businessName}",
        "contact": "Actual contact information for the flyer",
        "specialties": "Key specialties or services offered"
      }
    }
  `;
}

/**
 * Helper function to generate the editor prompt
 */
function getEditorPrompt(marketingConcept: string, profileData: any) {
  return `
    As an expert AI copy editor with experience in print marketing materials for catering businesses,
    you will refine the following draft content for a REAL marketing flyer.
    
    DRAFT CONTENT:
    ${marketingConcept}
    
    BUSINESS INFORMATION:
    ${JSON.stringify(profileData, null, 2)}
    
    Your task is to EDIT and FINALIZE the EXACT TEXT that will appear on the printed flyer.
    
    CRITICAL REQUIREMENTS:
    1. This is NOT a concept or example - your edited text will be used VERBATIM on the actual printed flyer
    2. Include ONLY REAL business information (name, specialties, contact info) - no placeholders
    3. Ensure all text is concise enough to fit comfortably on a single-page flyer
    4. Maintain a professional tone appropriate for catering clients
    5. Verify accuracy of all business details against the provided information
    
    Make these specific improvements:
    - Tighten up any wordy or redundant text
    - Enhance the persuasive impact of the headline and subheadings
    - Ensure the key points clearly communicate unique advantages
    - Make the call-to-action specific and compelling
    - Verify and format all business information correctly
    
    Return the FINAL, PRINT-READY TEXT in the same JSON format, with all content ready 
    to be placed directly on the flyer without further editing.
    
    Also add a detailed image_prompt field with specific guidance for the flyer's visual design.
  `;
}

/**
 * Helper function to generate the image prompt
 */
function getImagePrompt(flyrJson: any, businessName: string) {
  // Extract contact info if available in businessInfo
  const contactInfo = flyrJson.businessInfo?.contact || "Contact us today";
  
  return `
    I need a SINGLE-SIDED, PRINT-READY marketing flyer for "${businessName}".
    
    DO NOT create a mockup, template, frame, example, or placeholder.
    DO NOT show the flyer on a device/screen/tablet.
    DO NOT create multiple versions, pages, or variations of the flyer.
    DO NOT create a bifold, trifold, or multi-page design.
    
    WHAT I NEED: A single, FLAT, one-sided flyer design with the following EXACT text:
    
    HEADLINE: ${flyrJson.headline}
    
    SUBHEADINGS:
    ${flyrJson.subheadings.join('\n')}
    
    KEY POINTS:
    ${flyrJson.keyPoints.join('\n')}
    
    CALL TO ACTION:
    ${flyrJson.callToAction}
    
    CONTACT INFO:
    ${businessName}
    ${contactInfo}
    
    DESIGN SPECIFICATIONS:
    - ONE-SIDED flyer design (NOT a brochure or multi-page design)
    - High-resolution, print-quality (300 DPI)
    - Full-bleed landscape format (4:3 ratio)
    - Professional food photography
    - Modern, clean typography
    - Visual style: ${flyrJson.visualTheme}
    - Color scheme: ${flyrJson.colorScheme}
    
    ABSOLUTELY CRITICAL:
    - Create ONE SINGLE-SIDED FLYER with all information on one side
    - Display as a flat, head-on view of the final print design
    - Do not show multiple pages or angles - just one perfect, printable design
    - All text must be perfectly legible and part of the design
    - Do not include device frames, shadows, perspective views, or fold lines
    - Create a flat, print-ready design as if looking directly at the printed page
    
    ${flyrJson.image_prompt || ""}
  `;
}

/**
 * Helper function to generate the flyer image
 */
async function generateFlyerImage(imagePrompt: string) {
  // Get the Together API key for image generation
  const togetherApiKey = await getTogetherApiKey();
  
  const imageResponse = await fetch('https://api.together.xyz/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${togetherApiKey}`
    },
    body: JSON.stringify({
      model: "black-forest-labs/FLUX.1-dev-lora",
      prompt: imagePrompt,
      negative_prompt: "mockup, device frame, multiple versions, multiple pages, bifold, trifold, brochure, folded paper, placeholder, template, 3D render, low quality, blurry text, illegible text, pixelated, watermark, signature, cut off, cropped, multiple designs, example image, demo image, dark text on dark background, perspective view, angled view, shadow, fold line, two-sided",
      n: 1,
      width: 1792, // Higher resolution for premium print quality
      height: 1344, // Maintained 4:3 aspect ratio
      steps: 40, // Maximum allowed steps (API limit)
      guidance_scale: 10.0, // Maximum guidance scale for strict prompt adherence
      response_format: "url",
      seed: 42, // Fixed seed for consistency
      image_loras: [
        {"path": "https://huggingface.co/XLabs-AI/flux-RealismLora", "scale": 1.0},
        {"path": "https://huggingface.co/Shakker-Labs/FLUX.1-dev-LoRA-add-details", "scale": 1.0}
      ]
    })
  });
  
  if (!imageResponse.ok) {
    const errorData = await imageResponse.json().catch(() => ({}));
    throw new Error(`Flux LoRA API error: ${imageResponse.status} - ${JSON.stringify(errorData)}`);
  }
  
  const imageData = await imageResponse.json();
  return imageData.data[0].url;
}

/**
 * Helper function to convert a ReadableStream to a string while also
 * forwarding chunks to a callback function
 */
async function streamToString(stream: any, onChunk?: (chunk: string) => void): Promise<string> {
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