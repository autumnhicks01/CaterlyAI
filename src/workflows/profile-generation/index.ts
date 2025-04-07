import { Workflow } from '@mastra/core/workflow';
import { validateProfileData, generateAIProfile, saveGeneratedProfile } from './steps';
import { profileInputSchema, profileOutputSchema } from './schemas';

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
  id: 'profile-generation',
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

export default profileGenerationWorkflow; 