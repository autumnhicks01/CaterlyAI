import { getTogetherApiKey } from './api-helpers';

/**
 * Helper function to generate a social media image
 */
export async function generateSocialMediaImage(imagePrompt: string) {
  // Get the Together API key for image generation
  const togetherApiKey = await getTogetherApiKey();
  
  const imageResponse = await fetch('https://api.together.xyz/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${togetherApiKey}`
    },
    body: JSON.stringify({
      model: "black-forest-labs/FLUX.1-schnell-Free",
      prompt: imagePrompt,
      negative_prompt: "mockup, device frame, multiple versions, template, 3D render, low quality, blurry text, text overlay, watermark, signature, cut off, cropped, multiple designs, example image, demo image, collage, multi-image layout, phone screen, screenshot",
      n: 1,
      width: 1024,  // Square format for social media
      height: 1024, // Square format for social media
      steps: 4,    // Maximum allowed steps for free version (1-4)
      guidance_scale: 7.5, // Adjusted for free model
      response_format: "url",
      seed: Math.floor(Math.random() * 10000), // Random seed for variety
      // Removed LoRA models as they might not be compatible with the free version
    })
  });
  
  if (!imageResponse.ok) {
    const errorData = await imageResponse.json().catch(() => ({}));
    throw new Error(`Flux API error: ${imageResponse.status} - ${JSON.stringify(errorData)}`);
  }
  
  const imageData = await imageResponse.json();
  return imageData.data[0].url;
}

/**
 * Helper function to generate the image prompt for social media
 */
export function getSocialMediaImagePrompt(socialJson: any, businessName: string) {
  // Extract specific data from the socialJson
  const cateringType = socialJson.cateringType || "professional catering";
  const foodItems = socialJson.foodItems || "gourmet food";
  
  // Create a more generic food focus based on the business type
  let foodFocus = "beautifully presented food items";
  
  // Check for specific specialty items without hardcoding particular food
  if (foodItems.toLowerCase().includes("dessert") || foodItems.toLowerCase().includes("pastry") || foodItems.toLowerCase().includes("sweet")) {
    foodFocus = "artfully displayed desserts and pastries";
  } else if (foodItems.toLowerCase().includes("cake")) {
    foodFocus = "beautifully decorated cakes";
  } else if (foodItems.toLowerCase().includes("appetizer") || foodItems.toLowerCase().includes("starter")) {
    foodFocus = "meticulously plated appetizers";
  } else if (foodItems.toLowerCase().includes("seafood") || foodItems.toLowerCase().includes("fish")) {
    foodFocus = "fresh seafood dishes with garnishes";
  } else if (foodItems.toLowerCase().includes("bbq") || foodItems.toLowerCase().includes("grill")) {
    foodFocus = "perfectly grilled dishes";
  } else if (foodItems.toLowerCase().includes("vegan") || foodItems.toLowerCase().includes("vegetarian")) {
    foodFocus = "colorful plant-based dishes";
  } else {
    // Use the actual food items from the profile
    foodFocus = `beautifully presented ${foodItems}`;
  }
  
  return `
    A professional food photography image focusing on ${foodFocus} for ${cateringType} service.
    
    The main focus must be a detailed, close-up view of the food on an elegantly arranged catering table.
    The food should be the star of the image - make it appear delicious, fresh, and expertly prepared.
    Include beautiful tableware, garnishes, and presentation elements that highlight the food quality.
    
    Add a small, elegant card or signage that reads 'Catering by ${businessName}'.
    Use bright, natural lighting to showcase the food's colors, textures, and details.
    
    DESIGN SPECIFICATIONS:
    - Instagram/Facebook post format (square 1:1 ratio)
    - High-resolution, professional quality
    - Close-up, detailed food photography with shallow depth of field
    - Professional lighting with good contrast
    - NO text overlay (except for the small catering signage mentioned)
    - NO watermarks or logos
    
    ABSOLUTELY CRITICAL:
    - Create ONE SINGLE IMAGE that focuses primarily on the food described
    - The image should look like a professional food photograph from a culinary magazine
    - Food must be the main subject, taking up at least 70% of the frame
    - No borders, frames, or device mockups
    - No text on the image itself beyond what's specified
    - The image should appear realistic and premium quality
  `;
} 