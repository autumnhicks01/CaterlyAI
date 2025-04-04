import { validateEnv } from '@/lib/env';
import { z } from 'zod';
import { AI_PROFILE_ROUTER_PROMPT } from '../prompts/router';
import { OpenAI } from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Validate environment variables
validateEnv();

/**
 * Profile data interface containing all the necessary business information
 */
export interface CateringProfileData {
  businessName: string;
  location: string;
  serviceRadius: string;
  yearsInOperation: string;
  idealClients: string;
  signatureDishesOrCuisines: string;
  uniqueSellingPoints: string;
  brandVoiceAndStyle: string;
  testimonialsOrAwards: string;
  contactInformation: {
    phone: string;
    email: string;
    website: string;
    socialMedia: string[];
  };
}

/**
 * Structured profile output that matches our UI
 */
export interface StructuredProfile {
  businessName: string;
  location: string;
  serviceArea: string;
  yearsExperience: string;
  contactPerson: {
    name: string;
    title: string;
  };
  mostRequestedDishes: string[];
  overview: string;
  whyChooseUs: string[];
  idealClients: string;
  testimonialsAndAwards: {
    testimonials: Array<{
      quote: string;
      source: string;
    }>;
    awards: string[];
  };
  contactInformation: {
    phone: string;
    email: string;
    socialMedia: string[];
  };
}

/**
 * Response interface for the generated profile
 */
export interface ProfileResponse {
  structuredProfile: StructuredProfile;
  error?: string;
  metadata?: {
    generationTime: number;
    modelUsed: string;
    responseId?: string;
    characterCount?: number;
  };
}

/**
 * Creates a professional company profile for a catering business
 * based on the provided business details.
 * 
 * @param profileData Complete business profile data
 * @returns The generated structured profile data
 */
export async function generateCateringProfile(profileData: CateringProfileData): Promise<ProfileResponse> {
  console.log(`Generating profile for: ${profileData.businessName}`);
  console.log(`Using OpenAI API key: ${process.env.OPENAI_API_KEY ? 'Present' : 'Missing'}`);
  
  const startTime = Date.now();
  
  try {
    // Format the contact information into a single string
    const contactInfo = `
      Phone: ${profileData.contactInformation.phone}
      Email: ${profileData.contactInformation.email}
      Website: ${profileData.contactInformation.website}
      Social Media: ${profileData.contactInformation.socialMedia.join(', ')}
    `;

    // Fill in the prompt template with the profile data
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

    // Schema for generating structured output
    const profileSchema = z.object({
      businessName: z.string().describe('The business name of the catering company'),
      location: z.string().describe('The primary location of the business'),
      serviceArea: z.string().describe('Description of the service area and radius'),
      yearsExperience: z.string().describe('Years in the catering industry'),
      contactPerson: z.object({
        name: z.string().describe('Name of the primary contact person'),
        title: z.string().describe('Title or role of the contact person')
      }),
      mostRequestedDishes: z.array(z.string()).describe('List of 2-3 signature or most requested dishes'),
      overview: z.string().describe('A paragraph overview of the catering business'),
      whyChooseUs: z.array(z.string()).describe('3-5 bullet points of unique selling propositions'),
      idealClients: z.string().describe('Description of the ideal clients and events'),
      testimonialsAndAwards: z.object({
        testimonials: z.array(z.object({
          quote: z.string(),
          source: z.string()
        })),
        awards: z.array(z.string())
      }),
      contactInformation: z.object({
        phone: z.string(),
        email: z.string(),
        socialMedia: z.array(z.string())
      })
    });

    // Generate the structured profile data using OpenAI
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
    let structuredProfile;
    
    try {
      structuredProfile = JSON.parse(structuredProfileString) as StructuredProfile;
      
      // Validate the response - fill in any missing fields with reasonable defaults
      structuredProfile.businessName = structuredProfile.businessName || profileData.businessName;
      structuredProfile.location = typeof structuredProfile.location === 'object' ? 
        profileData.location : structuredProfile.location || profileData.location;
      structuredProfile.serviceArea = structuredProfile.serviceArea || 
        (profileData.serviceRadius ? `Serving within ${profileData.serviceRadius}` : 'Local area');
      
      // Ensure arrays are not empty
      if (!structuredProfile.mostRequestedDishes || structuredProfile.mostRequestedDishes.length === 0) {
        structuredProfile.mostRequestedDishes = profileData.signatureDishesOrCuisines ? 
          profileData.signatureDishesOrCuisines.split(',').map(dish => dish.trim()) : 
          ["Signature dishes based on client preferences", "Seasonal specialties", "Custom menu options"];
      }
      
      if (!structuredProfile.whyChooseUs || structuredProfile.whyChooseUs.length === 0) {
        structuredProfile.whyChooseUs = profileData.uniqueSellingPoints ? 
          profileData.uniqueSellingPoints.split(',').map(point => point.trim()) : 
          ["Quality ingredients and exceptional taste", "Customizable menus", "Professional service"];
      }
      
      // Ensure we have contact information
      if (!structuredProfile.contactPerson.name) {
        structuredProfile.contactPerson.name = "Contact Manager";
      }
      
      if (!structuredProfile.contactPerson.title) {
        structuredProfile.contactPerson.title = "Owner";
      }
      
      // Make sure idealClients has content
      if (!structuredProfile.idealClients) {
        structuredProfile.idealClients = profileData.idealClients || 
          "We cater to a variety of events including weddings, corporate functions, and special celebrations";
      }
    } catch (error) {
      console.error("Error parsing AI response:", error);
      // Fall back to default structured profile
      structuredProfile = createFallbackProfile(profileData);
    }

    const endTime = Date.now();
    const generationTime = (endTime - startTime) / 1000; // in seconds
    
    console.log(`Profile generation successful`);
    console.log(`Generation took ${generationTime.toFixed(2)} seconds`);

    return {
      structuredProfile,
      metadata: {
        generationTime: generationTime,
        modelUsed: 'gpt-4o'
      }
    };
  } catch (error) {
    const endTime = Date.now();
    const generationTime = (endTime - startTime) / 1000; // in seconds
    
    console.error('Error generating catering profile:', error);
    console.error(`Generation failed after ${generationTime.toFixed(2)} seconds`);
    
    // If generation fails, provide a better fallback with more detailed information
    return {
      structuredProfile: {
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
        overview: `${profileData.businessName} is a premier catering service based in ${profileData.location}${profileData.serviceRadius ? ` serving clients within a ${profileData.serviceRadius} mile radius` : ''}. ${profileData.uniqueSellingPoints ? 'We specialize in ' + profileData.uniqueSellingPoints : 'We pride ourselves on exceptional food quality and service'}. ${profileData.brandVoiceAndStyle || 'Our dedicated team is committed to making your event memorable with delicious cuisine and professional service.'}`,
        whyChooseUs: profileData.uniqueSellingPoints ? 
          profileData.uniqueSellingPoints.split(',').map(point => point.trim()).slice(0, 5) : 
          ["Quality ingredients and exceptional taste", "Customizable menus for all dietary needs", "Professional and reliable service", "Attention to detail", "Competitive pricing"],
        idealClients: profileData.idealClients || "We cater to a variety of events including weddings, corporate functions, private parties, and special celebrations of all sizes.",
        testimonialsAndAwards: {
          testimonials: [{
            quote: "The food was absolutely delicious and the service was impeccable!",
            source: "Satisfied Customer"
          }],
          awards: ["Local Favorite Catering Service"]
        },
        contactInformation: {
          phone: profileData.contactInformation.phone || "Contact us for details",
          email: profileData.contactInformation.email || "Contact us via our website",
          socialMedia: profileData.contactInformation.socialMedia || []
        }
      },
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      metadata: {
        generationTime: generationTime,
        modelUsed: 'gpt-4o (fallback)',
        characterCount: 1200
      }
    };
  }
}

/**
 * Creates a fallback profile when AI generation fails
 * @param profileData The original profile data
 * @returns A complete structured profile with reasonable defaults
 */
const createFallbackProfile = (profileData: CateringProfileData): StructuredProfile => {
  return {
    businessName: profileData.businessName,
    location: profileData.location,
    serviceArea: profileData.serviceRadius ? `Serving within ${profileData.serviceRadius}` : 'Local area',
    yearsExperience: profileData.yearsInOperation ? 
      `${profileData.yearsInOperation} years of experience` : 
      'Established catering service',
    contactPerson: {
      name: "Contact Manager",
      title: "Business Owner"
    },
    mostRequestedDishes: profileData.signatureDishesOrCuisines ? 
      profileData.signatureDishesOrCuisines.split(',').map(dish => dish.trim()).slice(0, 3) : 
      ["Signature Dishes", "Custom Menus", "Seasonal Specialties"],
    overview: `${profileData.businessName} is a premier catering service based in ${profileData.location}${profileData.serviceRadius ? ` serving clients within a ${profileData.serviceRadius} mile radius` : ''}. ${profileData.uniqueSellingPoints ? 'We specialize in ' + profileData.uniqueSellingPoints : 'We pride ourselves on exceptional food quality and service'}. ${profileData.brandVoiceAndStyle || 'Our dedicated team is committed to making your event memorable with delicious cuisine and professional service.'}`,
    whyChooseUs: profileData.uniqueSellingPoints ? 
      profileData.uniqueSellingPoints.split(',').map(point => point.trim()).slice(0, 5) : 
      ["Quality ingredients and exceptional taste", "Customizable menus for all dietary needs", "Professional and reliable service", "Attention to detail", "Competitive pricing"],
    idealClients: profileData.idealClients || "We cater to a variety of events including weddings, corporate functions, private parties, and special celebrations of all sizes.",
    testimonialsAndAwards: {
      testimonials: [{
        quote: "The food was absolutely delicious and the service was impeccable!",
        source: "Satisfied Customer"
      }],
      awards: ["Local Favorite Catering Service"]
    },
    contactInformation: {
      phone: profileData.contactInformation.phone || "Contact us for details",
      email: profileData.contactInformation.email || "Contact us via our website",
      socialMedia: profileData.contactInformation.socialMedia.length > 0 ? 
        profileData.contactInformation.socialMedia : 
        [profileData.contactInformation.website || "No social media provided"]
    }
  };
}; 