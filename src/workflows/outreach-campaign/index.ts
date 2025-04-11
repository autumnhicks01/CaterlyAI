import { Workflow } from '@mastra/core/workflows';
import { fetchLeadsStep, generateEmailsStep, launchCampaignStep } from './steps';
import { outreachCampaignInputSchema, outreachCampaignResultSchema } from './schemas';
import { EventEmitter } from 'events';
import { createClient } from '@supabase/supabase-js';
import outreachAgent from '@/agents/outreach';

// Initialize Supabase client for the workflow
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Outreach Campaign Workflow
 * 
 * This workflow handles the process of creating and sending email campaigns
 * to leads based on their business category.
 * 
 * The workflow follows these steps:
 * 1. Fetch leads from the database and categorize them
 * 2. Generate email templates for each category using AI
 * 3. Launch the approved email campaign
 */
export const outreachCampaignWorkflow = new Workflow({
  name: 'outreach-campaign',
  triggerSchema: outreachCampaignInputSchema,
});

// Define the workflow structure
outreachCampaignWorkflow
  // Step 1: Fetch leads from the database and categorize them
  .step(fetchLeadsStep)
  // Step 2: Generate email templates for each category
  .then(generateEmailsStep)
  // Step 3: Launch the approved email campaign
  .then(launchCampaignStep);

// Commit the workflow structure
outreachCampaignWorkflow.commit();

/**
 * Execute the Outreach Campaign workflow
 * 
 * @param categories Array of business categories to target
 * @param userEmail User's email for notifications
 * @param progressCallback Optional callback for progress updates
 * @returns Results of the outreach campaign workflow
 */
export async function executeOutreachCampaign(
  categories: string[],
  userEmail?: string,
  progressCallback?: (event: { step: string; status: string; message?: string }) => void
) {
  const { runId, start } = outreachCampaignWorkflow.createRun();
  
  console.log(`Starting outreach campaign workflow (${runId}) for categories: ${categories.join(', ')}`);
  
  // Create a progress emitter if callbacks are provided
  const progressEmitter = progressCallback ? new EventEmitter() : undefined;
  
  if (progressEmitter && progressCallback) {
    progressEmitter.on('progress', progressCallback);
    progressEmitter.on('error', ({ step, error }) => {
      progressCallback({
        step,
        status: 'failed',
        message: `Error: ${error}`
      });
    });
  }
  
  try {
    // Add the progress emitter to the context data
    const contextData: Record<string, any> = {};
    if (progressEmitter) {
      contextData.progressEmitter = progressEmitter;
    }
    
    // Run the workflow with the trigger data and optional context data
    const results = await start({
      triggerData: { 
        categories, 
        userEmail,
        useAI: true,
        templateCount: 8 
      },
      contextData
    });
    
    // Get the final results
    const finalResults = results.results?.['launch-campaign'] || {};
    
    return {
      success: true,
      data: finalResults,
      runId
    };
  } catch (error) {
    console.error(`Error executing outreach campaign workflow:`, error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      runId
    };
  } finally {
    // Clean up event listeners
    if (progressEmitter) {
      progressEmitter.removeAllListeners();
    }
  }
}

/**
 * Execute just the email generation step for previewing templates
 * 
 * @param category Business category to generate templates for
 * @param userProfile User profile for personalization
 * @returns Generated email templates
 */
export async function generateCategoryEmails(category: string, userProfile?: any) {
  console.log(`Generating preview emails for category: ${category}`);
  
  try {
    const templates = await outreachAgent.generateDripCampaign(category, userProfile);
    return {
      success: true,
      templates,
      count: templates.length
    };
  } catch (error) {
    console.error(`Error generating preview emails:`, error);
    return {
      success: false,
      templates: [],
      count: 0,
      error: String(error)
    };
  }
} 