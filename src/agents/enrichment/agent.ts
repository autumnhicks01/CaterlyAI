import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";

/**
 * Lead enrichment agent for enhancing lead data
 */
export const enrichmentAgent = new Agent({
  name: "Lead Enrichment Agent",
  instructions: `
    You are a business analyst specializing in catering industry lead enrichment.
    Extract key venue details, event capabilities, and contact information.
    Format your response as structured JSON with venue details, contact info, and event capabilities.
  `,
  model: openai("gpt-4o"),
});

export default enrichmentAgent; 