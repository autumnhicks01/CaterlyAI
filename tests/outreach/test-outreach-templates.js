// Test script to generate outreach templates for all categories
// Run with: node -r dotenv/config test-outreach-templates.js
require('dotenv').config(); // Load environment variables if not using -r flag

const { generateDripCampaign } = require('../../src/agents/outreachAgent');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Mock user profile in case we can't connect to Supabase
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
  photos: [
    "https://culinarydelights.example.com/gallery/corporate",
    "https://culinarydelights.example.com/gallery/weddings",
    "https://culinarydelights.example.com/gallery/education"
  ]
};

// Categories to test
const categories = ['wedding', 'corporate', 'education'];

// Create output directory if it doesn't exist
const outputDir = path.join(__dirname, '..', 'outreach-templates');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Function to fetch user profile from Supabase
async function getUserProfile() {
  if (!supabaseUrl || !supabaseKey) {
    console.log('Missing Supabase environment variables, using mock profile');
    return MOCK_PROFILE;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Default to the first user if no userId is provided
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      console.log('Falling back to mock profile');
      return MOCK_PROFILE;
    }

    if (!data) {
      console.log('No user profile found, using mock profile');
      return MOCK_PROFILE;
    }

    // Format the profile data in the format expected by the outreachAgent
    return {
      companyName: data.business_name || data.company_name || MOCK_PROFILE.companyName,
      description: data.business_description || data.description || MOCK_PROFILE.description,
      menuLink: data.menu_url || data.website || MOCK_PROFILE.menuLink,
      managerContact: `${data.first_name || 'Manager'} ${data.last_name || ''}, ${data.phone || 'No phone'}`,
      orderingLink: data.ordering_url || data.website || MOCK_PROFILE.orderingLink,
      focus: data.business_focus || data.target_audience || MOCK_PROFILE.focus,
      idealClients: data.ideal_clients || data.target_categories?.join(', ') || MOCK_PROFILE.idealClients,
      specialties: Array.isArray(data.specialties) ? data.specialties : 
                  (data.specialties ? [data.specialties] : MOCK_PROFILE.specialties),
      photos: Array.isArray(data.photo_urls) ? data.photo_urls : 
            (data.photo_urls ? [data.photo_urls] : MOCK_PROFILE.photos)
    };
  } catch (error) {
    console.error('Failed to connect to Supabase:', error);
    console.log('Falling back to mock profile');
    return MOCK_PROFILE;
  }
}

// Function to save templates to file
function saveTemplateToFile(category, templates) {
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const filename = path.join(outputDir, `${category}-templates-${timestamp}.txt`);
  
  let content = `# ${category.toUpperCase()} OUTREACH TEMPLATES\n`;
  content += `Generated: ${new Date().toLocaleString()}\n\n`;
  
  templates.forEach((template, index) => {
    content += `## EMAIL ${index + 1}\n\n${template}\n\n`;
  });
  
  fs.writeFileSync(filename, content);
  console.log(`Saved templates to ${filename}`);
}

// Main test function
async function testOutreachTemplates() {
  console.log('Starting outreach template test with real user profile...');
  console.log('------------------------------------------------------');

  try {
    // Fetch the user profile
    const userProfile = await getUserProfile();
    console.log(`Using profile for: ${userProfile.companyName}`);
    
    for (const category of categories) {
      console.log(`\nGenerating templates for ${category.toUpperCase()} category...`);
      try {
        const templates = await generateDripCampaign(category, userProfile);
        
        console.log(`✅ Successfully generated ${templates.length} templates for ${category}`);
        
        // Save templates to file
        saveTemplateToFile(category, templates);
        
        // Log the first template as a sample
        if (templates.length > 0) {
          console.log('\nSample template:');
          console.log('----------------');
          console.log(templates[0]);
          console.log('----------------\n');
        }
      } catch (error) {
        console.error(`❌ Error generating templates for ${category}:`, error);
      }
    }
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
  }
}

// Run the test
testOutreachTemplates()
  .then(() => console.log('\nTest completed successfully!'))
  .catch(err => console.error('Test failed:', err)); 