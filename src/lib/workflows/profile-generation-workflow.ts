import { Workflow } from './core';
import { 
  validateProfileDataStep, 
  generateProfileStep, 
  saveProfileStep 
} from './steps/profile-generation-steps';
import { profileDataSchema } from './schemas/common';

/**
 * Profile Generation Workflow
 * 
 * This workflow:
 * 1. Validates the provided profile data
 * 2. Generates a structured catering business profile using OpenAI
 * 3. Saves the profile to the database
 */
export const profileGenerationWorkflow = new Workflow({
  name: 'profile-generation',
  description: 'Generate a professional catering business profile',
  triggerSchema: profileDataSchema
})
  .step(validateProfileDataStep)
  .then(generateProfileStep)
  .then(saveProfileStep);

export default profileGenerationWorkflow; 