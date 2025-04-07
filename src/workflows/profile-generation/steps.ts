import { Step } from '@mastra/core/workflows';
import { profileInputSchema, enhancedProfileSchema, profileOutputSchema } from './schemas';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

/**
 * Validates and normalizes profile input data
 */
export const validateProfileData: Step = {
  name: 'validateProfileData',
  description: 'Validates the input profile data and normalizes it for processing',
  input: profileInputSchema,
  output: profileInputSchema,
  handler: async (input, { logger }) => {
    logger.info('Validating profile data');
    
    const { businessProfileData } = input;
    
    // Normalize the data - trim strings, ensure arrays exist, etc.
    const normalizedData = {
      businessProfileData: {
        ...businessProfileData,
        businessName: businessProfileData.businessName.trim(),
        location: businessProfileData.location?.trim() || 'Not specified',
        serviceRadius: businessProfileData.serviceRadius?.trim() || 'Not specified',
        yearsInOperation: businessProfileData.yearsInOperation?.trim() || 'Not specified',
        idealClients: businessProfileData.idealClients?.trim() || 'Not specified',
        signatureDishesOrCuisines: businessProfileData.signatureDishesOrCuisines?.trim() || 'Not specified',
        uniqueSellingPoints: businessProfileData.uniqueSellingPoints?.trim() || '',
        brandVoiceAndStyle: businessProfileData.brandVoiceAndStyle?.trim() || 'Professional and approachable',
        testimonialsOrAwards: businessProfileData.testimonialsOrAwards?.trim() || '',
        contactInformation: businessProfileData.contactInformation || {
          phone: '',
          email: '',
          website: '',
          socialMedia: []
        }
      }
    };
    
    logger.info('Profile data validated successfully');
    return normalizedData;
  }
};

/**
 * Generates an AI-enhanced profile using OpenAI
 */
export const generateAIProfile: Step = {
  name: 'generateAIProfile',
  description: 'Generates an AI-enhanced business profile using OpenAI',
  input: profileInputSchema,
  output: z.object({
    input: profileInputSchema,
    enhancedProfile: enhancedProfileSchema
  }),
  handler: async (input, { logger }) => {
    logger.info('Generating AI profile');
    const startTime = Date.now();
    
    const { businessProfileData } = input;
    
    // Get OpenAI API key from environment variable
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      logger.error('OpenAI API key is missing');
      throw new Error('OpenAI API key is missing');
    }
    
    // Construct the prompt for OpenAI
    const promptContent = `
    You are an expert business profile generator for catering businesses. Generate a compelling, professional profile based on the following information.
    
    First, analyze the information to identify specifically what type of catering business this is:
    - Is it a restaurant that also offers catering?
    - Is it a dedicated catering service?
    - Is it a bakery, food truck, or specialty food business that offers catering?
    - Is it quick service, full service, or boutique catering?
    - What cuisine or food category specialties are evident?
    
    Business Information:
    Business Name: ${businessProfileData.businessName}
    Location: ${businessProfileData.location || 'Not specified'}
    Service Area: ${businessProfileData.serviceRadius || 'Not specified'}
    Years in Operation: ${businessProfileData.yearsInOperation || 'Not specified'}
    Ideal Clients: ${businessProfileData.idealClients || 'Not specified'}
    Signature Dishes/Cuisines: ${businessProfileData.signatureDishesOrCuisines || 'Not specified'}
    Unique Selling Points: ${businessProfileData.uniqueSellingPoints || 'Not specified'}
    Brand Voice/Style: ${businessProfileData.brandVoiceAndStyle || 'Professional and approachable'}

    Create a comprehensive profile with the following structure:
    {
      "businessName": "The business name",
      "location": "City, State or specific geographic location",
      "serviceArea": "A description of the area they serve (e.g., '50-mile radius of Atlanta')",
      "yearsExperience": "Experience presented in a marketing-friendly way (e.g., '15 years of culinary excellence')",
      "contactPerson": {
        "name": "Owner or manager name (use generic if not provided)",
        "title": "Their role (e.g., 'Owner & Executive Chef')"
      },
      "mostRequestedDishes": [
        "3-5 signature dishes or menu items based on their specialties",
        "Each dish should sound appetizing and reflect their cuisine style"
      ],
      "overview": "A compelling 2-3 paragraph description that captures their brand voice, describes their services in detail, mentions their experience, service area, and ideal clients. This should be a polished marketing description that a catering business would be proud to display.",
      "whyChooseUs": [
        "5-6 specific, compelling reasons to choose this catering business",
        "Each point should highlight a competitive advantage or unique offering",
        "Focus on what makes them special in their specific catering niche"
      ],
      "idealClients": "A descriptive sentence about the types of clients and events they best serve, including what these clients value",
      "contactInformation": {
        "phone": "${businessProfileData.contactInformation?.phone || 'Not provided'}",
        "email": "${businessProfileData.contactInformation?.email || 'Not provided'}",
        "socialMedia": ${JSON.stringify(businessProfileData.contactInformation?.socialMedia || [])}
      }
    }

    Important: The output profile should be tailored to their specific catering niche and food specialties. Make it sound professional yet warm, and ensure it effectively markets their specific type of catering business. Generate accurate dish suggestions based on their cuisine type. Do not include testimonials or awards unless explicitly mentioned in their information.
    
    Return ONLY the structured JSON object with no additional text or explanation.
    `;
    
    try {
      // Call OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are an expert business profile generator that outputs only valid JSON for catering businesses. Your profiles are industry-specific, professional, and tailored to the specific type of catering business described.'
            },
            {
              role: 'user',
              content: promptContent
            }
          ],
          temperature: 0.7,
          max_tokens: 1500
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        logger.error('OpenAI API error', errorData);
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const content = data.choices[0].message.content;
      
      // Extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.error('Failed to parse JSON from OpenAI response');
        throw new Error('Failed to parse JSON from OpenAI response');
      }
      
      const enhancedProfileData = JSON.parse(jsonMatch[0]);
      
      const generationTime = Date.now() - startTime;
      logger.info(`AI profile generated successfully in ${generationTime}ms`);
      
      return {
        input,
        enhancedProfile: enhancedProfileData
      };
    } catch (error) {
      logger.error('Error generating AI profile', error);
      throw new Error(`Failed to generate AI profile: ${error.message}`);
    }
  }
};

/**
 * Saves the generated profile to the database
 */
export const saveGeneratedProfile: Step = {
  name: 'saveGeneratedProfile',
  description: 'Saves the generated profile to the database',
  input: z.object({
    input: profileInputSchema,
    enhancedProfile: enhancedProfileSchema
  }),
  output: profileOutputSchema,
  handler: async (input, { logger }) => {
    logger.info('Saving generated profile');
    const { input: profileInput, enhancedProfile } = input;
    const { businessProfileData } = profileInput;
    
    // Use the enhancedProfile directly as it now matches our desired format
    const completeProfile = {
      structuredProfile: {
        businessName: enhancedProfile.businessName,
        location: enhancedProfile.location,
        serviceArea: enhancedProfile.serviceArea,
        yearsExperience: enhancedProfile.yearsExperience,
        contactPerson: enhancedProfile.contactPerson,
        mostRequestedDishes: enhancedProfile.mostRequestedDishes,
        overview: enhancedProfile.overview,
        whyChooseUs: enhancedProfile.whyChooseUs,
        idealClients: enhancedProfile.idealClients,
        contactInformation: enhancedProfile.contactInformation
      },
      enhancedProfile,
      metadata: {
        generatedAt: new Date().toISOString(),
        generationTime: 0, // Will be calculated below
        modelUsed: 'gpt-4-turbo',
        characterCount: enhancedProfile.overview.length
      },
      saved: false,
      error: undefined
    };
    
    try {
      // Initialize Supabase client
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        logger.warn('Supabase credentials missing, skipping database save');
        return {
          ...completeProfile,
          saved: false,
          error: 'Database credentials missing'
        };
      }
      
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Save to database
      const { data: savedProfile, error } = await supabase
        .from('profiles')
        .upsert({
          id: businessProfileData.id || crypto.randomUUID?.() || Date.now().toString(),
          business_name: businessProfileData.businessName,
          location: businessProfileData.location,
          enhanced_data: enhancedProfile,
          structured_data: completeProfile.structuredProfile,
          metadata: completeProfile.metadata,
          updated_at: new Date().toISOString()
        })
        .select();
      
      if (error) {
        logger.error('Error saving profile to database', error);
        return {
          ...completeProfile,
          saved: false,
          error: error.message
        };
      }
      
      logger.info('Profile saved successfully to database');
      return {
        ...completeProfile,
        savedProfile: savedProfile?.[0] || null,
        saved: true
      };
    } catch (error) {
      logger.error('Error in profile save step', error);
      return {
        ...completeProfile,
        saved: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}; 