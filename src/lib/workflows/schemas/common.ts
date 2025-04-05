import { z } from 'zod';

/**
 * Business/Lead schema
 */
export const businessSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  address: z.string(),
  type: z.string().optional(),
  description: z.string().optional(),
  hasEventSpace: z.boolean().optional(),
  contact: z.object({
    phone: z.string().optional(),
    email: z.string().optional(),
    website: z.string().optional()
  }).optional(),
  enrichment_data: z.record(z.any()).optional()
});

export type Business = z.infer<typeof businessSchema>;

/**
 * Enrichment data schema
 */
export const enrichmentDataSchema = z.object({
  venueCapacity: z.number().optional(),
  inHouseCatering: z.boolean().optional(),
  eventManagerName: z.string().optional(),
  eventManagerEmail: z.string().optional(),
  eventManagerPhone: z.string().optional(),
  lastPublishedEvent: z.string().optional(),
  eventFrequency: z.string().optional(),
  commonEventTypes: z.array(z.string()).optional(),
  aiOverview: z.string().optional(),
  lastUpdated: z.string().optional(),
  website: z.string().optional(),
  additionalDetails: z.string().optional(),
  eventTypes: z.array(z.string()).optional(),
  venueName: z.string().optional(),
  websiteContent: z.string().optional(),
  pricingInformation: z.string().optional(),
  amenities: z.union([z.array(z.string()), z.string()]).optional(),
  eventsInformation: z.string().optional(),
  preferredCaterers: z.array(z.string()).optional(),
  managementContactName: z.string().optional(),
  managementContactEmail: z.string().optional(),
  managementContactPhone: z.string().optional(),
  managementContactTitle: z.string().optional(),
  leadScore: z.object({
    score: z.number(),
    reasons: z.array(z.string()),
    potential: z.enum(['high', 'medium', 'low']),
    lastCalculated: z.string()
  }).optional()
});

export type EnrichmentData = z.infer<typeof enrichmentDataSchema>;

/**
 * Lead schema (enhanced business)
 */
export const leadSchema = businessSchema.extend({
  user_id: z.string().optional(),
  status: z.enum(['new', 'enriched', 'contacted', 'converted', 'archived']).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  contact_name: z.string().optional(),
  contact_email: z.string().optional(),
  contact_phone: z.string().optional(),
  website_url: z.string().optional(),
  lead_score: z.number().optional(),
  lead_score_label: z.enum(['high', 'medium', 'low']).optional()
});

export type Lead = z.infer<typeof leadSchema>;

/**
 * Profile data schema
 */
export const profileDataSchema = z.object({
  businessName: z.string(),
  location: z.string(),
  serviceRadius: z.string(),
  yearsInOperation: z.string(),
  idealClients: z.string(),
  signatureDishesOrCuisines: z.string(),
  uniqueSellingPoints: z.string(),
  brandVoiceAndStyle: z.string(),
  testimonialsOrAwards: z.string(),
  contactInformation: z.object({
    phone: z.string(),
    email: z.string(),
    website: z.string(),
    socialMedia: z.array(z.string())
  })
});

export type ProfileData = z.infer<typeof profileDataSchema>;

/**
 * Structured profile schema
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

export type StructuredProfile = z.infer<typeof structuredProfileSchema>; 