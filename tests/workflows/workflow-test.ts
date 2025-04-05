import { workflowManager } from '../../src/lib/workflows';

// Test function for the business search workflow
async function testBusinessSearchWorkflow() {
  console.log('=== Testing Business Search Workflow ===');
  
  const result = await workflowManager.executeWorkflow('business-search', {
    query: 'event venue',
    location: 'New York, NY',
    radius: 10
  });
  
  console.log(`Workflow success: ${result.success}`);
  
  if (!result.success) {
    console.error('Workflow failed:', result.error?.message);
    return;
  }
  
  console.log(`Execution time: ${result.duration / 1000} seconds`);
  
  // Log results from each step
  console.log('\nStep Results:');
  for (const [stepId, stepResult] of result.stepResults.entries()) {
    console.log(`- ${stepId} (${stepResult.status})`);
    console.log(`  Duration: ${stepResult.duration ? stepResult.duration / 1000 : 'N/A'} seconds`);
    
    if (stepId === 'search-businesses') {
      const data = stepResult.data as any;
      console.log(`  Found ${data?.businesses?.length || 0} businesses in ${data?.location}`);
    }
    
    if (stepId === 'enhance-businesses') {
      const data = stepResult.data as any;
      console.log(`  Enhanced ${data?.businesses?.length || 0} businesses`);
      
      // Print sample business
      if (data?.businesses?.length > 0) {
        const sample = data.businesses[0];
        console.log('\nSample Business:');
        console.log(`  Name: ${sample.name}`);
        console.log(`  Address: ${sample.address}`);
        console.log(`  Website: ${sample.contact?.website || 'N/A'}`);
        console.log(`  Description: ${sample.description?.substring(0, 100)}...`);
      }
    }
  }
}

// Test function for the lead enrichment workflow
async function testLeadEnrichmentWorkflow() {
  console.log('\n=== Testing Lead Enrichment Workflow ===');
  
  // This would normally come from the database, but for testing
  // we'll use dummy lead IDs
  const result = await workflowManager.executeWorkflow('lead-enrichment', {
    leadIds: ['test-lead-1', 'test-lead-2']
  });
  
  console.log(`Workflow success: ${result.success}`);
  
  if (!result.success) {
    console.error('Workflow failed:', result.error?.message);
    return;
  }
  
  console.log(`Execution time: ${result.duration / 1000} seconds`);
  
  // Log the steps that were executed
  console.log('\nExecuted Steps:');
  for (const [stepId, stepResult] of result.stepResults.entries()) {
    console.log(`- ${stepId} (${stepResult.status})`);
    
    if (stepResult.error) {
      console.log(`  Error: ${stepResult.error.message}`);
    }
  }
}

// Test function for the profile generation workflow
async function testProfileGenerationWorkflow() {
  console.log('\n=== Testing Profile Generation Workflow ===');
  
  const testProfileData = {
    businessName: 'Gourmet Delights Catering',
    location: 'Boston, MA',
    serviceRadius: '25 miles',
    yearsInOperation: '12 years',
    idealClients: 'Corporate events, weddings, and upscale private parties',
    signatureDishesOrCuisines: 'Mediterranean fusion, Farm-to-table, Seasonal specialties',
    uniqueSellingPoints: 'Locally sourced ingredients, Customizable menus, Professional staff',
    brandVoiceAndStyle: 'Upscale but approachable, warm and professional',
    testimonialsOrAwards: 'Best Caterer 2023, Weddings Magazine Top Pick',
    contactInformation: {
      phone: '(555) 123-4567',
      email: 'info@gourmetdelights.example',
      website: 'https://gourmetdelights.example',
      socialMedia: ['@GourmetDelights', 'facebook.com/GourmetDelights']
    }
  };
  
  // Set up context with a test user ID
  const contextSetup = (context: any) => {
    context.setMetadata('userId', 'test-user-1');
  };
  
  const result = await workflowManager.executeWorkflow(
    'profile-generation', 
    testProfileData,
    contextSetup
  );
  
  console.log(`Workflow success: ${result.success}`);
  
  if (!result.success) {
    console.error('Workflow failed:', result.error?.message);
    return;
  }
  
  console.log(`Execution time: ${result.duration / 1000} seconds`);
  
  // Log the results of each step
  console.log('\nStep Results:');
  for (const [stepId, stepResult] of result.stepResults.entries()) {
    console.log(`- ${stepId} (${stepResult.status})`);
    console.log(`  Duration: ${stepResult.duration ? stepResult.duration / 1000 : 'N/A'} seconds`);
    
    if (stepId === 'generate-profile' && stepResult.data) {
      const data = stepResult.data as any;
      if (data.structuredProfile) {
        console.log('\nGenerated Profile Preview:');
        console.log(`  Business Name: ${data.structuredProfile.businessName}`);
        console.log(`  Overview: ${data.structuredProfile.overview.substring(0, 100)}...`);
        console.log(`  Most Requested Dishes: ${data.structuredProfile.mostRequestedDishes.join(', ')}`);
      }
    }
  }
}

// Main test function
export async function testWorkflows() {
  try {
    // Test each workflow
    await testBusinessSearchWorkflow();
    await testLeadEnrichmentWorkflow();
    await testProfileGenerationWorkflow();
    
    console.log('\n=== All Tests Completed ===');
  } catch (error) {
    console.error('Error running workflow tests:', error);
  }
}

// If this file is executed directly (not imported), run the tests
if (require.main === module) {
  testWorkflows()
    .then(() => console.log('Testing complete'))
    .catch(err => console.error('Test error:', err));
} 