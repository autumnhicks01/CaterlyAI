import { createClient } from '@supabase/supabase-js';
import { generateDripCampaign } from '../../agents/outreachAgent';
import { scheduleDripCampaign } from '../../tools/resend';
import { Step } from '@mastra/core/workflows';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Create Supabase client instance once
const supabase = createClient(supabaseUrl, supabaseKey);

interface Lead {
  id: string;
  name: string;
  email: string;
  category: string; // e.g. 'wedding', 'education', 'corporate'
  // ...other fields from your DB
}

// Mock the Step context interface for compatibility
interface StepContext {
  triggerData: any;
  getStepResult: (stepId: string) => any;
}

/**
 * Step to fetch leads from saved_leads DB and categorize them
 */
export const fetchLeadsStep = new Step({
  id: 'fetch-leads',
  description: 'Fetch leads from saved_leads database and group by category',
  execute: async (context: StepContext) => {
    console.log('Fetching leads from saved_leads database');
    
    try {
      // Get all leads that have a category and email (required for outreach)
      const { data: leads, error } = await supabase
        .from('saved_leads')
        .select('*')
        .not('category', 'is', null)
        .not('email', 'is', null);
      
      if (error) {
        console.error('Error fetching leads:', error);
        throw new Error(`Failed to fetch leads: ${error.message}`);
      }
      
      if (!leads || leads.length === 0) {
        console.warn('No leads found with category and email');
        return { categorizedLeads: {}, totalLeads: 0, categories: [] };
      }
      
      // Group leads by category
      const categorizedLeads: Record<string, Lead[]> = {};
      
      leads.forEach((lead: any) => {
        // Ensure the category exists and standardize it
        if (!lead.category) return;
        
        const category = lead.category.toLowerCase().trim();
        
        // Skip leads with empty categories
        if (!category) return;
        
        // Initialize category array if not exists
        if (!categorizedLeads[category]) {
          categorizedLeads[category] = [];
        }
        
        categorizedLeads[category].push({
          id: lead.id,
          name: lead.name || lead.business_name || 'Business',
          email: lead.email,
          category
        });
      });
      
      // Get category counts for logging
      const categories = Object.keys(categorizedLeads);
      const categoryCount = categories.map(cat => 
        `${cat}: ${categorizedLeads[cat].length}`
      ).join(', ');
      
      console.log(`Grouped ${leads.length} leads into ${categories.length} categories: ${categoryCount}`);
      
      return { 
        categorizedLeads,
        totalLeads: leads.length,
        categories
      };
  } catch (error) {
      console.error('Error in fetchLeadsStep:', error);
    throw error;
  }
}
});

/**
 * Step to generate email templates for each category
 */
export const generateEmailsStep = new Step({
  id: 'generate-emails',
  description: 'Generate 8 drip campaign emails for each category',
  execute: async (context: StepContext) => {
    // Get the categorized leads from the previous step
    const fetchResults = context.getStepResult('fetch-leads');
    const { categorizedLeads, categories } = fetchResults || { categorizedLeads: {}, categories: [] };
    
    if (!categories || categories.length === 0) {
      console.warn('No categories found to generate emails for');
      return { emailTemplates: {} };
    }
    
    console.log(`Generating email templates for ${categories.length} categories`);
    
    // Generate 8 emails for each category using the AI agent
    const emailTemplates: Record<string, string[]> = {};
    
    // Get user profile for personalized emails
    try {
      // Fetch the first user profile as a fallback
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .limit(1)
        .single();
      
      if (profileError) {
        console.warn('Could not fetch user profile for personalization:', profileError.message);
      }
      
      const userProfile = profileData || null;
      
      for (const category of categories) {
        console.log(`Generating email templates for category: ${category}`);
        try {
          const templates = await generateDripCampaign(category, userProfile);
          emailTemplates[category] = templates;
          console.log(`Generated ${templates.length} email templates for ${category}`);
        } catch (error) {
          console.error(`Error generating templates for ${category}:`, error);
          // Continue with other categories even if one fails
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      
      // Continue without profile data if there's an error
      for (const category of categories) {
        console.log(`Generating email templates for category: ${category} without profile data`);
        try {
          const templates = await generateDripCampaign(category);
          emailTemplates[category] = templates;
          console.log(`Generated ${templates.length} email templates for ${category}`);
  } catch (error) {
          console.error(`Error generating templates for ${category}:`, error);
          // Continue with other categories even if one fails
        }
      }
    }
    
    return {
      emailTemplates,
      categoryCounts: Object.keys(emailTemplates).map(cat => 
        `${cat}: ${emailTemplates[cat]?.length || 0}`
      )
    };
  }
});

/**
 * Launch the approved email campaign
 */
export const launchCampaignStep = new Step({
  id: 'launch-campaign',
  description: 'Schedule and send the approved email campaign',
  execute: async (context: StepContext) => {
    // Get approved templates
    const { approvedTemplates, userEmail } = context.triggerData || {};
    
    if (!approvedTemplates || Object.keys(approvedTemplates).length === 0) {
      throw new Error('No approved templates provided');
    }
    
    try {
      // Get leads for each category
      const fetchResults = context.getStepResult('fetch-leads');
      const { categorizedLeads } = fetchResults || { categorizedLeads: {} };
      
      console.log('Scheduling email campaigns with Resend');
      await scheduleDripCampaign(approvedTemplates);
      
      // Calculate campaign stats for reporting
      const categoryCounts = Object.keys(categorizedLeads).map(category => ({
        category,
        leadCount: categorizedLeads[category]?.length || 0,
        emailCount: approvedTemplates[category]?.length || 0,
        totalEmails: (categorizedLeads[category]?.length || 0) * (approvedTemplates[category]?.length || 0)
      }));
      
      const totalLeads = Object.values(categorizedLeads || {}).reduce((sum: number, leads: any[]) => sum + (leads?.length || 0), 0);
      const totalEmailsToSend = categoryCounts.reduce((sum, cat) => sum + (cat.totalEmails || 0), 0);
      
      return {
        success: true,
        campaignStats: {
          categories: categoryCounts,
          totalLeads,
          totalEmailsToSend,
          startDate: new Date().toISOString(),
          scheduledBy: userEmail
        }
      };
    } catch (error) {
      console.error('Error launching campaign:', error);
      throw error;
    }
  }
});

/**
 * Main workflow function to start the email campaign process
 * This gets called by the API route
 */
export async function startEmailCampaignWorkflow() {
  try {
    console.log('Starting email campaign workflow');
    
    // Create proper context objects
    const fetchContext: StepContext = {
      triggerData: {},
      getStepResult: () => ({})
    };
    
    // Execute the fetch leads step
    const fetchResult = await fetchLeadsStep.execute(fetchContext);
    
    // Get the results from the fetch step
    const { categorizedLeads, categories } = fetchResult || {};
    
    if (!categories || categories.length === 0) {
      console.log('No categories found, returning early');
      return { 
        success: false, 
        error: 'No categorized leads found',
        data: { categorizedLeads: {} }
      };
    }
    
    // Execute the generate emails step with proper context
    const generateContext: StepContext = {
      triggerData: {},
      getStepResult: (stepId: string) => {
        if (stepId === 'fetch-leads') return fetchResult;
        return null;
      }
    };
    
    const generateResult = await generateEmailsStep.execute(generateContext);
    
    // Return both the leads and generated templates
    return {
      success: true,
      data: {
        categorizedLeads,
        emailTemplates: generateResult.emailTemplates,
        stats: {
          totalLeads: fetchResult.totalLeads || 0,
          categoryCount: categories.length,
          categories: categories,
          categoryCounts: generateResult.categoryCounts
        }
      }
    };
  } catch (error) {
    console.error("Error in startEmailCampaignWorkflow:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Function to launch the approved campaigns
 * Called after user approves the emails in the UI
 */
export async function launchApprovedCampaigns(
  approvedTemplates: Record<string, string[]>,
  userEmail: string
) {
  try {
    console.log('Launching approved campaigns');
    
    // Execute the fetch leads step with proper context
    const fetchContext: StepContext = {
      triggerData: {},
      getStepResult: () => ({})
    };
    
    const fetchResult = await fetchLeadsStep.execute(fetchContext);
    
    // Execute the launch campaign step with proper context
    const launchContext: StepContext = {
      triggerData: { approvedTemplates, userEmail },
      getStepResult: (stepId: string) => {
        if (stepId === 'fetch-leads') return fetchResult;
        return null;
      }
    };
    
    const launchResult = await launchCampaignStep.execute(launchContext);
    
    return {
      success: true,
      data: launchResult
    };
  } catch (error) {
    console.error("Error launching campaigns:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}