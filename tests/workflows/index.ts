// Workflow test runner
import { testWorkflows } from './workflow-test';

// Run all workflow tests
(async () => {
  console.log('Starting workflow tests...\n');
  
  try {
    await testWorkflows();
    console.log('\nAll workflow tests completed successfully');
  } catch (error) {
    console.error('Error running workflow tests:', error);
    process.exit(1);
  }
})(); 