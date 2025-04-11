/**
 * Workflows Index
 * 
 * This file exports all workflows implemented in the application.
 */

// Business Search Workflow
export { 
  businessSearchWorkflow,
  executeBusinessSearch 
} from './business-search';

export type { 
  BusinessSearchInput,
  BusinessSearchResult
} from './business-search/schemas';

// Lead Enrichment Workflow
import leadEnrichmentWorkflow from './lead-enrichment';
import { enrichLeads } from '@/agents/enrichmentAgent';

export { 
  leadEnrichmentWorkflow,
  enrichLeads
};

export type { LeadEnrichmentInput, LeadData } from './lead-enrichment/schemas';

// Outreach Campaign Workflow
import { outreachCampaignWorkflow } from './outreach-campaign';

export {
  outreachCampaignWorkflow,
  executeOutreachCampaign,
  generateCategoryEmails
} from './outreach-campaign';

export type {
  OutreachCampaignInput,
  OutreachCampaignResult
} from './outreach-campaign/schemas';

// Export workflows object as default
const workflows = {
  'lead-enrichment': leadEnrichmentWorkflow,
  'outreach-campaign': outreachCampaignWorkflow
};

export default workflows; 