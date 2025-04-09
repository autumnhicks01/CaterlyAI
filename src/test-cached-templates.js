// Test script to demonstrate caching and performance improvements

import { generateDripCampaign, templateCache } from './agents/outreachAgent.js';

async function testCachedTemplates() {
  console.log('Testing optimized template generation with caching...');
  
  // Test profile
  const profile = {
    companyName: "Delicious Catering Co.",
    description: "We create memorable dining experiences with fresh, locally-sourced ingredients for all types of events.",
    menuLink: "https://example.com/menu",
    managerContact: "Jane Smith, 555-123-4567",
    orderingLink: "https://example.com/order",
    focus: "High-quality catering for corporate and social events",
    idealClients: "Corporate events, weddings, and educational institutions",
    specialties: ["Farm-to-table cuisine", "Dietary accommodations", "Unique presentation"],
    photos: ["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"]
  };
  
  // Test categories
  const categories = ['wedding', 'corporate', 'education'];
  
  for (const category of categories) {
    console.log(`\n=== Testing category: ${category} ===`);
    
    // First run - should generate fresh templates
    console.log('First run - generating fresh templates...');
    const startTime1 = Date.now();
    const templates1 = await generateDripCampaign(category, profile);
    const endTime1 = Date.now();
    
    console.log(`Generated ${templates1.length} templates in ${(endTime1 - startTime1)/1000} seconds`);
    console.log(`First template subject line: ${templates1[0].split('\n')[0]}`);
    
    // Check cache state
    const cacheKey = `category:${category}`;
    console.log(`Cache status: ${templateCache[cacheKey] ? 'Cached' : 'Not cached'}`);
    
    // Second run - should use cached templates
    console.log('\nSecond run - should use cached templates...');
    const startTime2 = Date.now();
    const templates2 = await generateDripCampaign(category, profile);
    const endTime2 = Date.now();
    
    console.log(`Retrieved ${templates2.length} templates in ${(endTime2 - startTime2)/1000} seconds`);
    console.log(`Cache hit: ${endTime2 - startTime2 < 1000 ? 'Yes' : 'No'}`);
    
    // Verify templates are the same
    const templatesMatch = JSON.stringify(templates1) === JSON.stringify(templates2);
    console.log(`Templates match: ${templatesMatch ? 'Yes' : 'No'}`);
  }
}

// Run the test
testCachedTemplates().catch(console.error); 