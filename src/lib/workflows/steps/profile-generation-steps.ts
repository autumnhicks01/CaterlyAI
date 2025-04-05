import { z } from 'zod';
import { Step } from '../core';
import { ProfileData, StructuredProfile, profileDataSchema } from '../schemas/common';
import { validateEnv } from '@/lib/env';
import { AI_PROFILE_ROUTER_PROMPT } from '@/lib/ai/prompts/router';

/**
 * Step to validate profile input data
 */
export const validateProfileDataStep = new Step({
  id: 'validate-profile-data',
  description: 'Validate the profile data input',
  inputSchema: profileDataSchema,
  execute: async ({ input }) => {
    if (!input) {
      throw new Error('No profile data provided');
    }
    
    console.log(`Validating profile data for business: ${input.businessName}`);
    
    // Perform additional validation beyond the schema
    const validationErrors = [];
    
    if (!input.businessName.trim()) {
      validationErrors.push('Business name is required');
    }
    
    if (!input.location.trim()) {
      validationErrors.push('Location is required');
    }
    
    if (!input.contactInformation.phone && !input.contactInformation.email) {
      validationErrors.push('At least one contact method (phone or email) is required');
    }
    
    if (validationErrors.length > 0) {
      throw new Error(`Profile data validation failed: ${validationErrors.join(', ')}`);
    }
    
    // Return the validated data
    return input;
  }
});

/**
 * Step to generate a catering business profile using OpenAI
 */
export const generateProfileStep = new Step({
  id: 'generate-profile',
  description: 'Generate a catering business profile using OpenAI',
  execute: async ({ context }) => {
    // Get the profile data from previous step
    const profileData = context.getStepResult<ProfileData>('validate-profile-data');
    
    if (!profileData) {
      throw new Error('No validated profile data available');
    }
    
    console.log(`Generating profile for business: ${profileData.businessName}`);
    
    const startTime = Date.now();
    
    try {
      // Validate environment
      validateEnv();
      
      // Import OpenAI dynamically to avoid circular dependencies
      const { OpenAI } = await import('openai');
      
      // Initialize OpenAI client
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      
      // Format contact information
      const contactInfo = `
        Phone: ${profileData.contactInformation.phone}
        Email: ${profileData.contactInformation.email}
        Website: ${profileData.contactInformation.website}
        Social Media: ${profileData.contactInformation.socialMedia.join(', ')}
      `;
      
      // Fill in the prompt template
      const filledPrompt = AI_PROFILE_ROUTER_PROMPT
        .replace('[BUSINESS_NAME]', profileData.businessName)
        .replace('[LOCATION]', profileData.location)
        .replace('[SERVICE_RADIUS]', profileData.serviceRadius)
        .replace('[YEARS_IN_OPERATION]', profileData.yearsInOperation)
        .replace('[IDEAL_CLIENTS]', profileData.idealClients)
        .replace('[SIGNATURE_DISHES_OR_CUISINES]', profileData.signatureDishesOrCuisines)
        .replace('[WHAT_MAKES_THE_BUSINESS_STAND_OUT]', profileData.uniqueSellingPoints)
        .replace('[DESIRED_TONE_OR_PERSONALITY]', profileData.brandVoiceAndStyle)
        .replace('[CUSTOMER_REVIEWS_OR_ACCOLADES]', profileData.testimonialsOrAwards)
        .replace('[PHONE_NUMBER, EMAIL, WEBSITE, SOCIAL_MEDIA]', contactInfo);
      
      // Generate the structured profile
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: filledPrompt },
          { 
            role: 'user', 
            content: `Create a structured profile for our catering business that fits a UI with sections for Business Name, Location, Contact Person, Most Requested Dishes, Overview, Why Choose Us, Ideal Clients, and Testimonials & Awards.

Please ensure ALL fields are filled out with appropriate values based on the provided information. Don't return empty strings or arrays - use the information provided to generate reasonable content for all fields.

IMPORTANT: 
- The businessName field should contain our business name (${profileData.businessName})
- Location should be a string, not an object
- All arrays (mostRequestedDishes, whyChooseUs, etc.) should have at least 2-3 items
- Ensure contact person has both name and title fields filled
- Generate a consistent profile that reflects our brand voice (${profileData.brandVoiceAndStyle})

Return the response as a complete JSON object with no empty fields.`
          }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });
      
      // Parse the structured profile from the response
      const structuredProfileString = response.choices[0].message.content || '{}';
      let structuredProfile: StructuredProfile;
      
      try {
        structuredProfile = JSON.parse(structuredProfileString) as StructuredProfile;
        
        // Fill in any missing fields with reasonable defaults
        structuredProfile.businessName = structuredProfile.businessName || profileData.businessName;
        structuredProfile.location = typeof structuredProfile.location === 'object' 
          ? profileData.location 
          : structuredProfile.location || profileData.location;
        structuredProfile.serviceArea = structuredProfile.serviceArea ||
          (profileData.serviceRadius ? `Serving within ${profileData.serviceRadius}` : 'Local area');
        
        // Ensure arrays have values
        if (!structuredProfile.mostRequestedDishes || structuredProfile.mostRequestedDishes.length === 0) {
          structuredProfile.mostRequestedDishes = profileData.signatureDishesOrCuisines
            ? profileData.signatureDishesOrCuisines.split(',').map(dish => dish.trim())
            : ["Signature dishes based on client preferences", "Seasonal specialties", "Custom menu options"];
        }
        
        if (!structuredProfile.whyChooseUs || structuredProfile.whyChooseUs.length === 0) {
          structuredProfile.whyChooseUs = profileData.uniqueSellingPoints
            ? profileData.uniqueSellingPoints.split(',').map(point => point.trim())
            : ["Quality ingredients and exceptional taste", "Customizable menus", "Professional service"];
        }
        
        // Ensure contact person has name and title
        if (!structuredProfile.contactPerson.name) {
          structuredProfile.contactPerson.name = "Contact Manager";
        }
        
        if (!structuredProfile.contactPerson.title) {
          structuredProfile.contactPerson.title = "Owner";
        }
        
        // Ensure ideal clients field is populated
        if (!structuredProfile.idealClients) {
          structuredProfile.idealClients = profileData.idealClients ||
            "We cater to a variety of events including weddings, corporate functions, and special celebrations";
        }
      } catch (error) {
        console.error("Error parsing AI response:", error);
        // Create a fallback profile
        structuredProfile = createFallbackProfile(profileData);
      }
      
      const endTime = Date.now();
      const generationTime = (endTime - startTime) / 1000; // in seconds
      
      console.log(`Profile generation successful in ${generationTime.toFixed(2)} seconds`);
      
      return {
        structuredProfile,
        metadata: {
          generationTime,
          modelUsed: 'gpt-4o',
          characterCount: JSON.stringify(structuredProfile).length
        }
      };
    } catch (error) {
      const endTime = Date.now();
      const generationTime = (endTime - startTime) / 1000;
      
      console.error('Error generating catering profile:', error);
      console.error(`Generation failed after ${generationTime.toFixed(2)} seconds`);
      
      // If generation fails completely, provide a fallback profile
      return {
        structuredProfile: createFallbackProfile(profileData),
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          generationTime,
          modelUsed: 'fallback',
          error: true
        }
      };
    }
  }
});

/**
 * Create a fallback profile with basic information from the provided data
 */
function createFallbackProfile(profileData: ProfileData): StructuredProfile {
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
      profileData.signatureDishesOrCuisines.split(',').map(dish => dish.trim()).slice(0, 3) :
      ["Signature Dishes", "Custom Menus", "Seasonal Specialties"],
    overview: `${profileData.businessName} is a premier catering service based in ${profileData.location}${
      profileData.serviceRadius ? ` serving clients within a ${profileData.serviceRadius} mile radius` : ''
    }. ${
      profileData.uniqueSellingPoints ? 'We specialize in ' + profileData.uniqueSellingPoints : 'We pride ourselves on exceptional food quality and service'
    }. ${
      profileData.brandVoiceAndStyle || 'Our dedicated team is committed to making your event memorable with delicious cuisine and professional service.'
    }`,
    whyChooseUs: profileData.uniqueSellingPoints ?
      profileData.uniqueSellingPoints.split(',').map(point => point.trim()).slice(0, 5) :
      ["Quality ingredients", "Experienced staff", "Customizable menus", "Reliable service", "Attention to detail"],
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
 * Step to save the generated profile to the database
 */
export const saveProfileStep = new Step({
  id: 'save-profile',
  description: 'Save the generated profile to the database',
  execute: async ({ context }) => {
    const result = context.getStepResult<{
      structuredProfile: StructuredProfile;
      metadata?: {
        generationTime: number;
        modelUsed: string;
        characterCount?: number;
      };
      error?: string;
    }>('generate-profile');
    
    if (!result || !result.structuredProfile) {
      throw new Error('No generated profile available to save');
    }
    
    const { structuredProfile, metadata } = result;
    
    console.log(`Saving profile for business: ${structuredProfile.businessName}`);
    
    try {
      // Import the Supabase client
      const { createClient } = await import('@/lib/supabase/server');
      const supabase = createClient();
      
      // Get user ID from context metadata
      const userId = context.getMetadata<string>('userId');
      
      if (!userId) {
        throw new Error('User ID not provided');
      }
      
      // Prepare the profile data for saving
      const profileRecord = {
        user_id: userId,
        business_name: structuredProfile.businessName,
        location: structuredProfile.location,
        service_area: structuredProfile.serviceArea,
        years_experience: structuredProfile.yearsExperience,
        overview: structuredProfile.overview,
        ideal_clients: structuredProfile.idealClients,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        profile_data: structuredProfile,
        metadata: metadata
      };
      
      // Save the profile to the database
      const { data, error } = await supabase
        .from('business_profiles')
        .insert(profileRecord)
        .select()
        .single();
      
      if (error) {
        throw new Error(`Error saving profile: ${error.message}`);
      }
      
      console.log(`Successfully saved profile with ID: ${data.id}`);
      
      return {
        success: true,
        profileId: data.id,
        structuredProfile
      };
    } catch (error) {
      console.error('Error saving profile:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        structuredProfile
      };
    }
  }
}); 