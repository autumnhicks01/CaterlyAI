/**
 * Outreach Agent Module
 * 
 * This module provides functionality for generating email campaigns
 * for catering businesses targeting specific business categories.
 */

// Export the main agent class
export { OutreachAgent } from './agent';

// Export types
export type {
  CateringProfile,
  OutreachOptions,
  EmailCampaign,
  EmailCampaignResult,
  SeasonalContext
} from './model';

// Create and export a singleton instance for convenient access
import { OutreachAgent } from './agent';
const outreachAgent = new OutreachAgent();
export default outreachAgent; 