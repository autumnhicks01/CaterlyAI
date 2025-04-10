/**
 * Workflows Index
 * 
 * This file exports all workflows implemented in the application,
 * providing a centralized entry point for workflow functionality.
 */

import { z } from 'zod';

// Business Search Workflow
export { 
  businessSearchWorkflow,
  executeBusinessSearch 
} from './business-search';

export type { 
  BusinessSearchInput,
  BusinessSearchResult,
  EnhancedBusinessResult 
} from './business-search/schemas';

// Import the workflow
import leadEnrichmentWorkflow from './lead-enrichment';

// Use the client-side implementation from enrichmentAgent
import { enrichLeads } from '@/agents/enrichmentAgent';

// Export the workflow and the enrichLeads function
export { 
  leadEnrichmentWorkflow,
  enrichLeads
};

// Lead enrichment input interface
export type { LeadEnrichmentInput } from './lead-enrichment/schemas';

// Export workflows object as default
const workflows = {
  'lead-enrichment': leadEnrichmentWorkflow
};

export default workflows; 