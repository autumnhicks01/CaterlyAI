// Import crypto polyfill first to ensure it's loaded before any Mastra imports
import { cryptoPolyfillLoaded, randomUUID } from '@/utils/crypto-polyfill';
import { Mastra } from "@mastra/core";
import { validateMastraEnv } from "./config";

// Import workflows
import { businessSearchWorkflow } from "@/workflows/business-search";
import { profileGenerationWorkflow } from "@/workflows/profile-generation";
// These imports will be uncommented after implementing the other workflows
// import { leadEnrichmentWorkflow } from "@/workflows/lead-enrichment";

// Import workflow manager
import { workflowManager } from "../workflowManager";

console.log("[Mastra] Initializing Mastra with crypto polyfill:", cryptoPolyfillLoaded ? "loaded" : "not loaded");

// Make sure environment variables are valid
const envIsValid = validateMastraEnv();
console.log("[Mastra] Environment validation:", envIsValid ? "passed" : "failed");

// Initialize Mastra instance with workflows
let mastraInstance: Mastra | null = null;

try {
  console.log("[Mastra] Creating Mastra instance with workflows");
  mastraInstance = new Mastra({
    workflows: {
      "business-search": businessSearchWorkflow,
      "profile-generation": profileGenerationWorkflow,
      // These will be added as they are implemented
      // "lead-enrichment": leadEnrichmentWorkflow,
    }
  });
  console.log("[Mastra] Mastra instance created successfully");
} catch (error) {
  console.error("[Mastra] Error creating Mastra instance:", error);
}

// Export the Mastra instance
export const mastra = mastraInstance;

// Export core workflow components
export { workflowManager };

// Export the UUID function to use for testing
export const generateUUID = randomUUID;

// Get the business search workflow
export const getBusinessSearchWorkflow = () => {
  try {
    return businessSearchWorkflow;
  } catch (error) {
    console.error("[Mastra] Error getting business search workflow:", error);
    return null;
  }
};

// Get the profile generation workflow
export const getProfileGenerationWorkflow = () => {
  try {
    console.log("[Mastra] Getting profile generation workflow", profileGenerationWorkflow);
    return profileGenerationWorkflow;
  } catch (error) {
    console.error("[Mastra] Error getting profile generation workflow:", error);
    return null;
  }
};

// These getters will be implemented as the workflows are created
export const getLeadEnrichmentWorkflow = () => {
  throw new Error("Lead enrichment workflow not yet implemented");
}; 