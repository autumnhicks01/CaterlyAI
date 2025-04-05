import { workflowManager } from './manager';
import leadEnrichmentWorkflow from './lead-enrichment-workflow';
import businessSearchWorkflow from './business-search-workflow';
import profileGenerationWorkflow from './profile-generation-workflow';

// Register workflows
workflowManager.registerWorkflow(leadEnrichmentWorkflow);
workflowManager.registerWorkflow(businessSearchWorkflow);
workflowManager.registerWorkflow(profileGenerationWorkflow);

// Export workflow manager and workflows
export { workflowManager };
export { 
  leadEnrichmentWorkflow,
  businessSearchWorkflow,
  profileGenerationWorkflow
};

// Default export for convenience
export default workflowManager; 