import { OutreachService } from './service';
import { CateringProfile, OutreachOptions, EmailCampaignResult } from './model';

/**
 * OutreachAgent handles email campaign generation for catering businesses
 */
export class OutreachAgent {
  private service: OutreachService;

  constructor() {
    this.service = new OutreachService();
  }

  /**
   * Generate a drip campaign for a specific business category
   * 
   * @param category The business category to target
   * @param profile Optional catering company profile for personalization
   * @param options Additional options for customizing the campaign
   * @returns Array of generated email templates
   */
  async generateDripCampaign(
    category: string,
    profile?: CateringProfile,
    options?: OutreachOptions
  ): Promise<string[]> {
    try {
      const result = await this.service.generateCampaign(category, profile, options);
      
      if (!result.success) {
        console.error(`Failed to generate campaign for ${category}:`, result.error);
        throw new Error(result.error);
      }
      
      return result.emails;
    } catch (error) {
      console.error(`Error in generateDripCampaign for ${category}:`, error);
      throw error;
    }
  }
} 