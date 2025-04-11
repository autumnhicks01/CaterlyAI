/**
 * API-related functions for the enrichment agent
 */

import { createPrompt } from './prompts';
import { parseResponse } from './parser';
import { extractAdditionalData } from './scoring';
import { createFallbackData } from './utils';

/**
 * Call OpenAI API for enrichment
 */
export async function callOpenAI(prompt: string): Promise<string> {
  try {
    console.log('[ENRICHMENT-AGENT] Calling OpenAI API with GPT-4o model...');

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key is not configured');
    }
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a business analyst specializing in catering industry lead enrichment. Extract key venue details, event capabilities, and contact information. Format your response as structured JSON with venue details, contact info, and event capabilities.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from OpenAI API');
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error('[ENRICHMENT-AGENT] Error in callOpenAI:', error);
    throw new Error(`Failed to call OpenAI API: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Process a lead with AI to generate enrichment data
 */
export async function processLeadWithAI(lead: any, websiteContent: string = ''): Promise<any> {
  try {
    // Create the prompt for analysis
    const prompt = createPrompt(lead, websiteContent);
    
    // Call OpenAI directly
    const response = await callOpenAI(prompt);
    
    // Parse the response
    const enrichmentData = parseResponse(response, lead);
    
    // Extract additional data from content if needed
    if (websiteContent && websiteContent.length > 200) {
      return extractAdditionalData(enrichmentData, websiteContent, lead);
    }
    
    return enrichmentData;
  } catch (aiError) {
    console.warn(`[ENRICHMENT-AGENT] AI enrichment failed, using fallback: ${aiError}`);
    // Create fallback data if AI fails
    return createFallbackData(lead);
  }
} 