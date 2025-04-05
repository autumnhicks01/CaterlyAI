import { Workflow } from './core';
import { 
  searchBusinessesStep, 
  filterBusinessesStep, 
  enhanceBusinessesStep,
  searchInputSchema
} from './steps/business-search-steps';

/**
 * Business Search Workflow
 * 
 * This workflow:
 * 1. Searches for businesses using Google Places API
 * 2. Filters businesses based on relevance to catering needs
 * 3. Enhances business data with additional details using OpenAI
 */
export const businessSearchWorkflow = new Workflow({
  name: 'business-search',
  description: 'Search and discover potential business leads for catering services',
  triggerSchema: searchInputSchema
})
  .step(searchBusinessesStep)
  .then(filterBusinessesStep)
  .then(enhanceBusinessesStep);

export default businessSearchWorkflow; 