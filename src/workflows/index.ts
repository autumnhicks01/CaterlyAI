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

// Lead Enrichment Workflow
export { 
  default as leadEnrichmentWorkflow,
  enrichLeads
} from './lead-enrichment';

// Lead enrichment input interface
export type { LeadEnrichmentInput } from './lead-enrichment/schemas';

// Export all workflows for default
import leadEnrichmentWorkflow from './lead-enrichment';

export default {
  'lead-enrichment': leadEnrichmentWorkflow
}; 