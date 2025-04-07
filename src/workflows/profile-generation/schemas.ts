import { z } from 'zod';

/**
 * Input Schema for Profile Generation Workflow
 * 
 * Defines the structure of data required to trigger the workflow
 */
export const profileInputSchema = z.object({
  businessProfileData: z.object({
    id: z.string().optional().describe('Profile ID for database updates'),
    businessName: z.string().min(1).describe('Name of the catering business'),
    location: z.string().optional().describe('Business location or service area'),
    serviceRadius: z.string().optional().describe('Area the business serves'),
    yearsInOperation: z.string().optional().describe('Years in business'),
    idealClients: z.string().optional().describe('Description of ideal client types'),
    signatureDishesOrCuisines: z.string().optional().describe('Signature dishes or cuisine types'),
    uniqueSellingPoints: z.string().optional().describe('Unique selling points or differentiators'),
    brandVoiceAndStyle: z.string().optional().describe('Brand voice and style'),
    contactInformation: z.object({
      phone: z.string().optional(),
      email: z.string().optional(),
      website: z.string().optional(),
      socialMedia: z.array(z.string()).optional()
    }).optional()
  }).describe('Business profile data to enhance with AI')
});

/**
 * Schema for the AI-generated profile
 */
export const enhancedProfileSchema = z.object({
  businessName: z.string(),
  location: z.string(),
  serviceArea: z.string(),
  yearsExperience: z.string(),
  contactPerson: z.object({
    name: z.string(),
    title: z.string()
  }),
  mostRequestedDishes: z.array(z.string()),
  overview: z.string(),
  whyChooseUs: z.array(z.string()),
  idealClients: z.string(),
  contactInformation: z.object({
    phone: z.string(),
    email: z.string(),
    socialMedia: z.array(z.string())
  }),
  // Optional legacy fields for backward compatibility
  tagline: z.string().optional(),
  enhancedDescription: z.string().optional(),
  sellingPoints: z.array(z.string()).optional(),
  targetAudience: z.array(z.string()).optional(),
  marketingRecommendations: z.array(z.string()).optional(),
  competitiveAdvantages: z.array(z.string()).optional()
});

/**
 * Schema for the structured profile output
 */
export const structuredProfileSchema = z.object({
  businessName: z.string(),
  location: z.string(),
  serviceArea: z.string(),
  yearsExperience: z.string(),
  contactPerson: z.object({
    name: z.string(),
    title: z.string()
  }),
  mostRequestedDishes: z.array(z.string()),
  overview: z.string(),
  whyChooseUs: z.array(z.string()),
  idealClients: z.string(),
  contactInformation: z.object({
    phone: z.string(),
    email: z.string(),
    socialMedia: z.array(z.string())
  })
});

/**
 * Metadata schema for generation info
 */
export const metadataSchema = z.object({
  generatedAt: z.string(),
  generationTime: z.number(),
  modelUsed: z.string(),
  characterCount: z.number()
});

/**
 * Complete output schema for the workflow
 */
export const profileOutputSchema = z.object({
  structuredProfile: structuredProfileSchema,
  enhancedProfile: enhancedProfileSchema,
  metadata: metadataSchema,
  savedProfile: z.any().optional(),
  saved: z.boolean(),
  error: z.string().optional()
});

// Export types derived from the schemas
export type ProfileInput = z.infer<typeof profileInputSchema>;
export type EnhancedProfile = z.infer<typeof enhancedProfileSchema>;
export type StructuredProfile = z.infer<typeof structuredProfileSchema>;
export type Metadata = z.infer<typeof metadataSchema>;
export type ProfileOutput = z.infer<typeof profileOutputSchema>; 