// Test script for generating outreach templates
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration
const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const API_ENDPOINT = `${API_URL}/api/outreach/start`;

// Supabase setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Categories to test
const CATEGORIES = ['wedding', 'corporate', 'education'];

// Directory to save test results
const RESULTS_DIR = path.join(__dirname, 'results');

// Create results directory if it doesn't exist
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

/**
 * Fetch a real user profile from the database
 */
async function fetchUserProfile(userId) {
  console.log('Fetching user profile from database...');
  
  try {
    // Use the provided userId or fetch the first available profile
    const query = userId 
      ? supabase.from('user_profiles').select('*').eq('user_id', userId).single()
      : supabase.from('user_profiles').select('*').limit(1).single();
      
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching profile:', error.message);
      throw new Error(`Could not fetch profile: ${error.message}`);
    }
    
    if (!data) {
      throw new Error('No user profile found in the database');
    }
    
    console.log(`Found profile for: ${data.business_name || data.company_name || 'Unknown business'}`);
    return data;
  } catch (error) {
    console.error('Error in fetchUserProfile:', error);
    throw error;
  }
}

/**
 * Test email generation for a specific category
 */
async function testCategory(category, userProfile) {
  console.log(`\n🔄 Testing outreach for ${category.toUpperCase()} category...`);
  
  try {
    console.time(`${category} generation time`);
    
    // Format the profile for the API
    const formattedProfile = {
      companyName: userProfile.business_name || userProfile.company_name,
      description: userProfile.business_description || userProfile.description,
      menuLink: userProfile.menu_url || userProfile.website,
      managerContact: `${userProfile.first_name || ''} ${userProfile.last_name || ''}, ${userProfile.phone || ''}`,
      orderingLink: userProfile.ordering_url || userProfile.website,
      focus: userProfile.business_focus || userProfile.target_audience,
      idealClients: userProfile.ideal_clients || (Array.isArray(userProfile.target_categories) ? userProfile.target_categories.join(', ') : ''),
      specialties: Array.isArray(userProfile.specialties) ? userProfile.specialties : 
                 (userProfile.specialties ? [userProfile.specialties] : []),
      photos: Array.isArray(userProfile.photo_urls) ? userProfile.photo_urls : 
            (userProfile.photo_urls ? [userProfile.photo_urls] : [])
    };
    
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category,
        testMode: true,
        profile: formattedProfile
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API returned status ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    console.timeEnd(`${category} generation time`);
    
    if (!data.success) {
      throw new Error(data.error || 'API returned success: false');
    }
    
    const templates = data.templates[category] || [];
    console.log(`✅ Successfully generated ${templates.length} templates for ${category}`);
    
    // Save the templates to a file
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = path.join(RESULTS_DIR, `${category}-templates-${timestamp}.txt`);
    
    let content = `# ${category.toUpperCase()} OUTREACH TEMPLATES\n`;
    content += `Generated: ${new Date().toLocaleString()}\n`;
    content += `Company: ${formattedProfile.companyName}\n\n`;
    
    templates.forEach((template, index) => {
      content += `## EMAIL ${index + 1}\n\n${template}\n\n`;
      content += '-'.repeat(80) + '\n\n';
    });
    
    fs.writeFileSync(filename, content);
    console.log(`📝 Saved templates to ${filename}`);
    
    // Display a sample
    if (templates.length > 0) {
      console.log('\nSample template:');
      console.log('-'.repeat(50));
      console.log(templates[0]);
      console.log('-'.repeat(50));
    }
    
    return {
      category,
      success: true,
      count: templates.length,
      filename
    };
  } catch (error) {
    console.error(`❌ Error testing ${category}:`, error);
    return {
      category,
      success: false,
      error: error.message
    };
  }
}

/**
 * Main test function
 */
async function runTest() {
  console.log('=================================================');
  console.log('🚀 OUTREACH EMAIL TEMPLATE GENERATOR TEST');
  console.log('=================================================');
  
  try {
    // Parse command line args for userId
    const userId = process.argv[2];
    if (userId) {
      console.log(`Using provided user ID: ${userId}`);
    } else {
      console.log('No user ID provided, will use first available profile');
    }
    
    // Get a real user profile from the database
    const userProfile = await fetchUserProfile(userId);
    console.log('=================================================');
    
    const results = [];
    
    // Test all categories with the real profile
    for (const category of CATEGORIES) {
      const result = await testCategory(category, userProfile);
      results.push(result);
    }
    
    // Print summary
    console.log('\n=================================================');
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('=================================================');
    
    let successful = 0;
    let failed = 0;
    
    for (const result of results) {
      if (result.success) {
        console.log(`✅ ${result.category.toUpperCase()}: ${result.count} templates generated`);
        console.log(`   Saved to: ${result.filename}`);
        successful++;
      } else {
        console.log(`❌ ${result.category.toUpperCase()}: Failed - ${result.error}`);
        failed++;
      }
    }
    
    console.log('=================================================');
    console.log(`TOTAL: ${successful} succeeded, ${failed} failed`);
    console.log('=================================================');
    
    return failed === 0;
  } catch (error) {
    console.error('❌ Fatal error:', error);
    return false;
  }
}

// Run the test and exit with appropriate code
runTest()
  .then(success => {
    if (success) {
      console.log('\n✨ All tests completed successfully!');
      process.exit(0);
    } else {
      console.error('\n⚠️ Some tests failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n💥 Test execution error:', error);
    process.exit(1);
  }); 