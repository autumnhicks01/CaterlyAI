import { Workflow } from '@mastra/core/workflows';
import { validateProfileData, generateAIProfile, saveGeneratedProfile } from './steps';
import { profileInputSchema, profileOutputSchema, ProfileInput } from './schemas';

/**
 * Profile Generation Workflow
 * 
 * This workflow handles the end-to-end process of generating and saving
 * an AI-enhanced business profile for catering businesses.
 * 
 * It consists of three main steps:
 * 1. Validate and normalize input data
 * 2. Generate AI-enhanced profile using OpenAI
 * 3. Save the generated profile to the database
 */
export const profileGenerationWorkflow = new Workflow({
  name: 'Profile Generation',
  description: 'Generate an AI-enhanced business profile for a catering business',
  input: profileInputSchema,
  output: profileOutputSchema,
  steps: [
    validateProfileData,
    generateAIProfile,
    saveGeneratedProfile
  ]
});

/**
 * Execute the profile generation workflow
 * 
 * This is a helper function that provides a simpler interface for executing
 * the profile generation workflow.
 */
export async function executeProfileGeneration(input: ProfileInput, progressEmitter?: any) {
  try {
    const instance = profileGenerationWorkflow.start({
      input,
      context: progressEmitter ? { progressEmitter } : {}
    });
    
    const result = await instance.waitUntilComplete();
    return result;
  } catch (error) {
    console.error('Error executing profile generation workflow:', error);
    throw error;
  }
}

export default profileGenerationWorkflow; 