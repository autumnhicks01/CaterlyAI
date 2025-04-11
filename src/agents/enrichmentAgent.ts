/**
 * DEPRECATED: This file is kept for backward compatibility.
 * Please import from src/agents/enrichment instead.
 */

import { 
  enrichmentAgent,
  enrichLeadData,
  enrichLeads,
  type EnrichmentData,
  type EnrichmentResult,
  type EnrichmentResponse
} from './enrichment';

// Export everything from the new structure
export { 
  enrichmentAgent,
  enrichLeadData,
  enrichLeads
};

export type {
  EnrichmentData,
  EnrichmentResult,
  EnrichmentResponse
};

export default enrichmentAgent;
