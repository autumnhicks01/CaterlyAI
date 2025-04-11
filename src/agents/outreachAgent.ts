/**
 * @deprecated This file is maintained for backwards compatibility.
 * Please import from '@/agents/outreach' instead.
 */

import outreachAgent, { type CateringProfile, type OutreachOptions } from './outreach';

// Template cache for storing generated emails
export const templateCache: Record<string, { templates: string[]; timestamp: number }> = {};

/**
 * Generate a drip campaign for a specific business category
 * 
 * @deprecated Use the new OutreachAgent class from '@/agents/outreach' instead.
 * @param category The business category to target
 * @param profile Optional catering company profile for personalization
 * @param options Additional options for customizing the campaign
 * @returns Array of generated email templates
 */
export async function generateDripCampaign(
  category: string,
  profile?: CateringProfile,
  options?: OutreachOptions
): Promise<string[]> {
  // Add results to cache
  const normalizedCategory = category.toLowerCase().trim();
  const cacheKey = `category:${normalizedCategory}`;
  
  const result = await outreachAgent.generateDripCampaign(category, profile, options);
  
  // Update cache with the new templates
  templateCache[cacheKey] = {
    templates: result,
    timestamp: Date.now()
  };
  
  return result;
}

export default {
  generateDripCampaign,
  templateCache
};
