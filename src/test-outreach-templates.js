// Test script for generating outreach templates for all categories using the AI agent
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { generateDripCampaign } = require('./agents/outreachAgent');

// Create an output directory for saving the templates
const outputDir = path.join(__dirname, 'test-output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Test profile data to simulate a real user profile
const testProfile = {
  companyName: "Gourmet Delights Catering",
  description: "Premium catering service specializing in seasonal, locally-sourced cuisine for events of all sizes",
  menuLink: "https://gourmetdelights.com/menus",
  managerContact: "Sarah Johnson, Events Manager, 555-123-4567",
  orderingLink: "https://gourmetdelights.com/book",
  focus: "Seasonal farm-to-table cuisine with customizable menu options",
  idealClients: "High-end events, corporate gatherings, and educational institutions",
  specialties: [
    "Farm-to-table cuisine", 
    "Custom menu design", 
    "Full-service staffing", 
    "Bar service"
  ],
  photos: [
    "https://gourmetdelights.com/gallery/corporate", 
    "https://gourmetdelights.com/gallery/weddings",
    "https://gourmetdelights.com/gallery/education"
  ]
};

// Categories to test
const categories = ['wedding', 'corporate', 'education'];

// Save templates to a file
function saveTemplateToFile(category, templates) {
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const filename = path.join(outputDir, `${category}-templates-${timestamp}.txt`);
  
  let content = `# ${category.toUpperCase()} OUTREACH TEMPLATES\n`;
  content += `Generated: ${new Date().toLocaleString()}\n\n`;
  
  templates.forEach((template, index) => {
    content += `## EMAIL ${index + 1} - ${getDelayForEmail(index)}\n\n${template}\n\n`;
    content += "-".repeat(80) + "\n\n";
  });
  
  fs.writeFileSync(filename, content);
  console.log(`Saved templates to ${filename}`);
  
  return filename;
}

// Helper function to get delay for each email
function getDelayForEmail(index) {
  const delays = [
    "Day 1 (Initial Contact)",
    "Day 3",
    "Week 2",
    "Week 3",
    "Week 5",
    "Week 7", 
    "Week 9",
    "Week 12"
  ];
  return delays[index] || `Week ${index + 1}`;
}

// Format email for display in console
function formatEmailForConsole(email, index) {
  // Extract subject line
  const subjectMatch = email.match(/Subject: (.*?)(?:\n|\r\n)/);
  const subject = subjectMatch ? subjectMatch[1].trim() : `Email ${index + 1}`;
  
  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${getDelayForEmail(index)} - ${subject}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${email}
`;
}

// Main test function
async function testOutreachTemplates() {
  console.log("🚀 Testing AI-Powered Outreach Template Generation");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Using profile for: ${testProfile.companyName}`);
  console.log(`Testing categories: ${categories.join(', ')}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  const results = {};
  
  for (const category of categories) {
    console.log(`\n🔄 Generating templates for ${category.toUpperCase()} category...`);
    
    try {
      console.time(`${category} generation time`);
      
      // Generate templates with the outreach agent
      const templates = await generateDripCampaign(category, testProfile);
      
      console.timeEnd(`${category} generation time`);
      console.log(`✅ Successfully generated ${templates.length} templates for ${category}\n`);
      
      // Save templates to file
      const savedFile = saveTemplateToFile(category, templates);
      
      // Display first and last email as samples
      if (templates.length > 0) {
        console.log(formatEmailForConsole(templates[0], 0));
        
        if (templates.length > 1) {
          console.log(`... ${templates.length - 2} more emails ...\n`);
          console.log(formatEmailForConsole(templates[templates.length - 1], templates.length - 1));
        }
      }
      
      // Store results
      results[category] = {
        count: templates.length,
        savedFile
      };
      
    } catch (error) {
      console.error(`❌ Error generating templates for ${category}:`);
      console.error(error);
    }
  }
  
  // Summary
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📋 Summary of Generated Templates:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  for (const category in results) {
    console.log(`${category.toUpperCase()}: ${results[category].count} templates`);
    console.log(`  - Saved to: ${results[category].savedFile}`);
  }
  
  console.log("\n✨ Test completed!");
}

// Run the test
testOutreachTemplates()
  .then(() => console.log('\nTest completed successfully!'))
  .catch(err => {
    console.error('Test failed with error:');
    console.error(err);
  }); 