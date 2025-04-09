import { config } from 'dotenv';
config(); // Load environment variables

import { generateDripCampaign } from '../../src/agents/outreachAgent';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Output directory for templates
const outputDir = path.join(__dirname, 'results');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Categories to test
const categories = ['wedding', 'corporate', 'education'];

// Mock profile to use if Supabase connection fails
const MOCK_PROFILE = {
  companyName: "Culinary Delights Catering",
  description: "We specialize in creating memorable dining experiences for all occasions with fresh, locally-sourced ingredients and exceptional service.",
  menuLink: "https://culinarydelights.example.com/menu",
  managerContact: "Chef Morgan Smith, 555-123-4567",
  orderingLink: "https://culinarydelights.example.com/order",
  focus: "Premium catering for special events",
  idealClients: "Corporate events, weddings, and educational institutions",
  specialties: [
    "Seasonal menus",
    "Dietary accommodations",
    "Interactive food stations",
    "Custom menu design"
  ],
  photos: []
};

// Function to save templates to file
function saveTemplateToFile(category: string, templates: string[]): string {
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const filename = path.join(outputDir, `${category}-templates-${timestamp}.txt`);
  
  let content = `# ${category.toUpperCase()} OUTREACH TEMPLATES\n`;
  content += `Generated: ${new Date().toLocaleString()}\n\n`;
  
  templates.forEach((template, index) => {
    content += `## EMAIL ${index + 1}\n\n${template}\n\n`;
  });
  
  fs.writeFileSync(filename, content);
  console.log(`Saved templates to ${filename}`);
  return filename;
}

// Main test function
async function runTest() {
  console.log('-----------------------------------------------------');
  console.log('AI OUTREACH EMAIL TEMPLATE GENERATOR TEST');
  console.log('-----------------------------------------------------');

  let userProfile;
  try {
    // Try to get a user profile from Supabase
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .limit(1)
      .single();

    if (error || !data) {
      console.log('Using mock profile since no Supabase profile was found');
      userProfile = MOCK_PROFILE;
    } else {
      console.log(`Found profile for: ${data.first_name} ${data.last_name}`);
      userProfile = {
        companyName: data.business_name || data.company_name || MOCK_PROFILE.companyName,
        description: data.business_description || data.description || MOCK_PROFILE.description,
        menuLink: data.menu_url || data.website || MOCK_PROFILE.menuLink,
        managerContact: `${data.first_name || 'Manager'} ${data.last_name || ''}, ${data.phone || 'No phone'}`,
        orderingLink: data.ordering_url || data.website || MOCK_PROFILE.orderingLink,
        focus: data.business_focus || data.target_audience || MOCK_PROFILE.focus,
        idealClients: data.ideal_clients || (Array.isArray(data.target_categories) ? data.target_categories.join(', ') : MOCK_PROFILE.idealClients),
        specialties: Array.isArray(data.specialties) ? data.specialties : 
                    (data.specialties ? [data.specialties] : MOCK_PROFILE.specialties),
        photos: Array.isArray(data.photo_urls) ? data.photo_urls : 
               (data.photo_urls ? [data.photo_urls] : [])
      };
    }

    console.log(`Generating templates for: ${userProfile.companyName}`);
    const savedFiles = [];
    
    // Generate templates for each category
    for (const category of categories) {
      console.log(`\nGenerating templates for ${category.toUpperCase()} category...`);
      try {
        console.log(`Calling generateDripCampaign with category: ${category}`);
        const templates = await generateDripCampaign(category, userProfile);
        
        console.log(`✅ Successfully generated ${templates.length} templates for ${category}`);
        
        // Save templates to file
        const filename = saveTemplateToFile(category, templates);
        savedFiles.push(filename);
        
        // Log the first template as a sample
        if (templates.length > 0) {
          console.log('\nSample template:');
          console.log('----------------');
          console.log(templates[0].substring(0, 300) + '...');
          console.log('----------------\n');
        }
      } catch (error) {
        console.error(`❌ Error generating templates for ${category}:`, error);
      }
    }
    
    console.log('\n-----------------------------------------------------');
    console.log('Test completed successfully!');
    console.log('Templates saved to:');
    savedFiles.forEach(file => console.log(`- ${file}`));
    console.log('-----------------------------------------------------');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
runTest(); 