import { z } from 'zod';
import { Workflow } from './core';
import { 
  fetchLeadsStep, 
  extractWebsiteDataStep, 
  processDataStep, 
  updateLeadsStep 
} from './steps/lead-enrichment-steps';

/**
 * Input schema for the lead enrichment workflow
 */
const leadEnrichmentInputSchema = z.object({
  leadIds: z.array(z.string()).describe('IDs of leads to enrich')
});

/**
 * Lead enrichment workflow
 * 
 * This workflow:
 * 1. Fetches leads from the database
 * 2. Extracts data from the leads' websites
 * 3. Processes the extracted data
 * 4. Updates the leads in the database
 */
export const leadEnrichmentWorkflow = new Workflow({
  name: 'lead-enrichment',
  description: 'Enrich leads with data from their websites',
  triggerSchema: leadEnrichmentInputSchema
})
  .step(fetchLeadsStep)
  .then(extractWebsiteDataStep)
  .then(processDataStep)
  .then(updateLeadsStep);

export default leadEnrichmentWorkflow; 