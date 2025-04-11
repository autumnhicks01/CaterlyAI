import { profileAgent } from './agent';
import { getOpenAIApiKey, extractJsonFromResponse, streamToString } from './api-helpers';
import { generateSocialMediaImage, getSocialMediaImagePrompt } from './image-generation';

/**
 * Generate a social media post for a catering business using a two-step AI process:
 * 1. GPT-4o: Creates an engaging social media caption directly
 * 2. Flux API: Generates the social media image based on the caption
 * 
 * @param profileData - The business profile data including enhanced profile information
 * @param streaming - Whether to return a streaming response (default: false)
 * @returns Either a streaming response or a Promise resolving to a JSON string
 */
export async function generateSocialMedia(profileData: any, streaming = false) {
  // Ensure we have a business name for logging
  const businessName = profileData.businessName || 
                       profileData.business_name || 
                       "Catering Business";
  
  console.log(`Generating social media post for: "${businessName}"`);
  
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
    return generateSocialMediaStream(safeProfileData);
  }
  
  // Otherwise, return a Promise resolving to a JSON string
  try {
    // Get the API key
    const apiKey = await getOpenAIApiKey();
    
    // Create social media caption directly with GPT-4o
    const captionPrompt = getSocialMediaCaptionPrompt("", safeProfileData);
    
    const captionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o", // Use GPT-4o directly for better and faster results
        messages: [
          { 
            role: "system", 
            content: "You are an expert social media copywriter who creates concise, engaging captions for catering businesses." 
          },
          { role: "user", content: captionPrompt }
        ],
        temperature: 0.7,
        max_tokens: 500 // Reduced since we want shorter output
      })
    });
    
    if (!captionResponse.ok) {
      const errorData = await captionResponse.json().catch(() => ({}));
      throw new Error(`Caption API error: ${captionResponse.status} - ${JSON.stringify(errorData)}`);
    }
    
    const captionData = await captionResponse.json();
    const socialMediaCaption = captionData.choices[0].message.content;
    
    // Extract important business info and caption for the image prompt
    const socialJson = extractJsonFromResponse(socialMediaCaption);
    
    // Step 2: Generate the image using Flux API
    const imagePrompt = getSocialMediaImagePrompt(socialJson, businessName);
    const imageUrl = await generateSocialMediaImage(imagePrompt);
    
    // Return the full result
    return JSON.stringify({
      socialMediaCaption,
      imageUrl,
      metadata: {
        generatedAt: new Date().toISOString(),
        businessName: businessName
      }
    });
    
  } catch (error: any) {
    console.error("Error generating social media post:", error);
    throw error;
  }
}

/**
 * Helper function for streaming social media post generation
 */
async function generateSocialMediaStream(safeProfileData: any) {
  const businessName = safeProfileData.businessName;
  const encoder = new TextEncoder();
  
  // Create a readable stream for the entire process with proper error handling
  return new ReadableStream({
    async start(controller) {
      try {
        // Go directly to caption writing, skipping the marketing concept step
        controller.enqueue(encoder.encode("## SOCIAL MEDIA CAPTION ##\n\n"));
        
        // Generate social media caption directly
        try {
          const captionResponse = await profileAgent.stream([
            { 
              role: "system", 
              content: "You are an expert social media copywriter who creates concise, engaging captions for catering businesses." 
            },
            { 
              role: "user", 
              content: getSocialMediaCaptionPrompt("", safeProfileData) 
            }
          ]);
          
          // Process the writer's response as it streams
          const socialMediaCaption = await streamToString(captionResponse.textStream, 
            (chunk) => controller.enqueue(encoder.encode(chunk)));
          
          // Step 2: Generate the social media image
          controller.enqueue(encoder.encode("\n\n## GENERATING SOCIAL MEDIA IMAGE ##\n\n"));
          controller.enqueue(encoder.encode("Creating your beautiful image...\n"));
          
          // Extract important business info for the image prompt
          const socialJson = extractJsonFromResponse(socialMediaCaption);
          
          // Generate the image prompt
          const imagePrompt = getSocialMediaImagePrompt(socialJson, businessName);
          
          try {
            // Generate the image
            const imageUrl = await generateSocialMediaImage(imagePrompt);
            
            // Send the image URL
            controller.enqueue(encoder.encode("\n\n## SOCIAL MEDIA IMAGE URL ##\n\n"));
            controller.enqueue(encoder.encode(imageUrl + "\n\n"));
            
            // Package everything as JSON at the end for easy parsing
            const resultJson = JSON.stringify({
              socialMediaCaption,
              imageUrl,
              metadata: {
                generatedAt: new Date().toISOString(),
                businessName
              }
            }, null, 2);
            
            // Send the final JSON
            controller.enqueue(encoder.encode("## SOCIAL_MEDIA_DATA_JSON ##\n\n"));
            controller.enqueue(encoder.encode(resultJson));
            
          } catch (error: any) {
            // Handle image generation error
            console.error("Error generating image:", error);
            controller.enqueue(encoder.encode(`\n\nError generating image: ${error.message}\n\n`));
            
            // Still try to send the text parts as JSON
            const resultJson = JSON.stringify({
              socialMediaCaption,
              error: error.message,
              metadata: {
                generatedAt: new Date().toISOString(),
                businessName
              }
            }, null, 2);
            
            controller.enqueue(encoder.encode("## SOCIAL_MEDIA_DATA_JSON ##\n\n"));
            controller.enqueue(encoder.encode(resultJson));
          }
          
        } catch (error: any) {
          // Handle streaming error
          console.error("Error in streaming process:", error);
          controller.enqueue(encoder.encode(`\n\nError: ${error.message}\n\n`));
        }
        
        // Close the stream
        controller.close();
        
      } catch (error: any) {
        // Handle any unhandled errors
        console.error("Unhandled error in social media stream:", error);
        controller.enqueue(encoder.encode(`\n\nUnhandled error: ${error.message}\n\n`));
        controller.close();
      }
    }
  });
}

/**
 * Helper function to create the social media caption prompt
 */
function getSocialMediaCaptionPrompt(marketingConcept: string, profileData: any) {
  // Get the business name from the profile data
  const businessName = profileData.businessName || profileData.business_name || "Your Catering Business";
  
  // Extract data from ai_profile_data if available
  const aiProfileData = profileData.ai_profile_data || {};
  
  // Try to extract fields from the generated profile in ai_profile_data
  const generatedProfile = aiProfileData.generatedProfile || aiProfileData;
  
  return `
    Write a very concise social media caption (under 50 words) to promote the catering business: ${businessName}.
    
    The caption should:
    1. Be conversational and natural (not sound AI-generated)
    2. Avoid marketing clichés and buzzwords
    3. Sound like something a real person would write
    4. Have no hashtags
    5. Stay under 50 words total
    6. Include a simple call to action
    
    Use ONLY the information provided in the business profile below. Do not invent or assume specific dishes 
    or services not mentioned in the profile data.
    
    Business profile data:
    ${JSON.stringify(generatedProfile, null, 2)}
    
    Please also create a simple JSON structure with information for image generation:
    
    {
      "businessName": "${businessName}",
      "cateringType": "The type of catering based strictly on profile data",
      "foodItems": "The specific food items mentioned in the profile, no inventions"
    }
    
    Provide this JSON after your caption, marking it with "IMAGE GENERATION DATA:" before the JSON.
  `;
} 