import { z } from 'zod';

/**
 * Input for the lead enrichment workflow
 */
export const leadEnrichmentInputSchema = z.object({
  leadIds: z.array(z.string()).describe('IDs of leads to enrich')
});

export type LeadEnrichmentInput = z.infer<typeof leadEnrichmentInputSchema>;

/**
 * Lead data structure
 */
export const leadSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().optional(),
  website_url: z.string().optional(),
  type: z.string().optional(),
  contact_email: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_name: z.string().optional(),
  status: z.enum(['saved', 'enriched', 'contacted', 'converted']).optional(),
  lead_score: z.number().optional(),
  lead_score_label: z.enum(['high', 'medium', 'low']).optional(),
  enrichment_data: z.record(z.any()).optional(),
  user_id: z.string()
});

export type Lead = z.infer<typeof leadSchema>;

/**
 * Enrichment data structure
 */
export const enrichmentDataSchema = z.object({
  venueName: z.string().optional(),
  aiOverview: z.string().optional(),
  eventManagerName: z.string().optional(),
  eventManagerEmail: z.string().optional(),
  eventManagerPhone: z.string().optional(),
  commonEventTypes: z.array(z.string()).optional(),
  inHouseCatering: z.boolean().optional(),
  venueCapacity: z.number().optional(),
  amenities: z.array(z.string()).optional(),
  pricingInformation: z.string().optional(),
  preferredCaterers: z.array(z.string()).optional(),
  website: z.string().optional(),
  leadScore: z.object({
    score: z.number(),
    reasons: z.array(z.string()),
    potential: z.enum(['high', 'medium', 'low']),
    lastCalculated: z.string()
  }).optional(),
  lastUpdated: z.string().optional()
});

export type EnrichmentData = z.infer<typeof enrichmentDataSchema>;

/**
 * Result of the lead enrichment workflow
 */
export interface LeadEnrichmentResult {
  success: boolean;
  error?: string;
  updatedLeads?: Lead[];
  failedLeads?: string[];
  totalProcessed: number;
  successCount: number;
  failureCount: number;
} 