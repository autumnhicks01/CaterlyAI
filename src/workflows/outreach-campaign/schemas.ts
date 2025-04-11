import { z } from 'zod';
import { EventEmitter } from 'events';

/**
 * Input schema for outreach campaign workflow
 */
export const outreachCampaignInputSchema = z.object({
  // Either categories or leads must be provided
  categories: z.array(z.string()).optional(),
  leads: z.array(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      email: z.string().optional(), 
      category: z.string().optional()
    })
  ).optional(),
  
  // Optional parameters
  userId: z.string().optional(),
  useAI: z.boolean().optional().default(true),
  templateCount: z.number().optional().default(8),
  userEmail: z.string().optional(),
});

// Add extended type with runtime properties
export interface OutreachCampaignInput extends z.infer<typeof outreachCampaignInputSchema> {
  progressEmitter?: EventEmitter;
}

/**
 * Output schema for fetch leads step
 */
export const fetchLeadsResultSchema = z.object({
  categorizedLeads: z.record(z.string(), z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      category: z.string()
    })
  )),
  totalLeads: z.number(),
  categories: z.array(z.string())
});

/**
 * Output schema for generate emails step
 */
export const generateEmailsResultSchema = z.object({
  emailTemplates: z.record(z.string(), z.array(z.string())),
  categoryCounts: z.array(z.string())
});

/**
 * Output schema for launch campaign step
 */
export const launchCampaignResultSchema = z.object({
  campaignStats: z.array(
    z.object({
      category: z.string(),
      leadCount: z.number(),
      emailCount: z.number(),
      totalEmails: z.number()
    })
  ),
  success: z.boolean(),
  message: z.string()
});

/**
 * Final result schema for outreach campaign workflow
 */
export const outreachCampaignResultSchema = z.object({
  success: z.boolean(),
  categorizedLeads: z.record(z.string(), z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      category: z.string()
    })
  )).optional(),
  emailTemplates: z.record(z.string(), z.array(z.string())).optional(),
  campaignStats: z.array(
    z.object({
      category: z.string(),
      leadCount: z.number(),
      emailCount: z.number(),
      totalEmails: z.number()
    })
  ).optional(),
  error: z.string().optional()
});

// Type exports
export type FetchLeadsResult = z.infer<typeof fetchLeadsResultSchema>;
export type GenerateEmailsResult = z.infer<typeof generateEmailsResultSchema>;
export type LaunchCampaignResult = z.infer<typeof launchCampaignResultSchema>;
export type OutreachCampaignResult = z.infer<typeof outreachCampaignResultSchema>; 