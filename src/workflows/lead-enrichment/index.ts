import { z } from 'zod';
import { Workflow } from '@mastra/core/workflows';
import { 
  fetchLeadsStep, 
  extractWebsiteDataStep, 
  processDataStep, 
  updateLeadsStep 
} from './steps';
import { enrichLeadData } from "../../agents/enrichmentAgent";
import { firecrawlTool } from '@/tools/firecrawl';

/**
 * Input schema for the lead enrichment workflow
 */
const leadEnrichmentInputSchema = z.object({
  leadIds: z.array(z.string()).describe('IDs of leads to enrich')
});

/**
 * Lead enrichment workflow
 * 
 * This workflow:
 * 1. Fetches leads from the database
 * 2. Extracts data from the leads' websites using Firecrawl API
 * 3. Processes the extracted data with the enrichment agent
 * 4. Updates the leads in the database
 */
export const leadEnrichmentWorkflow = new Workflow({
  name: 'lead-enrichment',
  steps: [
    fetchLeadsStep,
    extractWebsiteDataStep,
    processDataStep,
    updateLeadsStep
  ]
});

/**
 * Execute the lead enrichment workflow
 * 
 * @param leadIds - Array of lead IDs to enrich
 * @returns Result of the workflow execution
 */
export async function enrichLeads(leadIds: string[]) {
  try {
    console.log(`Starting lead enrichment workflow for ${leadIds.length} leads`);
    console.log(`Lead IDs to enrich:`, leadIds);
    
    // Create a run of the workflow
    const run = leadEnrichmentWorkflow.createRun();
    console.log(`Created workflow run`);
    
    // Start the run with the trigger data
    console.log(`Starting workflow run with leadIds: ${leadIds.length}`);
    const startTime = Date.now();
    const result = await run.start({
      triggerData: { leadIds }
    });
    const endTime = Date.now();
    console.log(`Lead enrichment workflow completed in ${(endTime-startTime)/1000} seconds`);
    
    // Debug the results
    if (result && result.results) {
      console.log(`Workflow results structure: ${Object.keys(result.results).join(', ')}`);
      
      // Try to extract enriched businesses from the result
      const updateLeadsStepResult = result.results['update-leads'];
      console.log(`Update leads step result:`, updateLeadsStepResult);
      
      // Check if the step was successful
      if (updateLeadsStepResult && updateLeadsStepResult.status === 'success') {
        // Need to use any type here due to dynamic step result structure
        const updateResults = (updateLeadsStepResult as any).data?.updateResults || [];
        console.log(`Update lead step results: ${updateResults.length} items`);
        
        // Map update results to enriched businesses
        const enrichedBusinesses = updateResults
          .filter((r: any) => r.success)
          .map((r: any) => ({
            id: r.leadId,
            name: r.lead?.name || 'Unknown',
            enrichment_data: r.enrichmentData,
            lead_score: r.enrichmentData?.leadScore?.score,
            lead_score_label: r.enrichmentData?.leadScore?.potential,
            // Include other relevant fields from the result
            ...r.lead
          }));
        
        console.log(`Mapped ${enrichedBusinesses.length} enriched businesses from results`);
        
        // Add the enriched businesses to the result
        return {
          success: true,
          data: result.results,
          enrichedBusinesses: enrichedBusinesses,
          // Include summary statistics
          stats: {
            totalLeads: leadIds.length,
            enriched: enrichedBusinesses.length,
            processingTime: (endTime - startTime) / 1000
          }
        };
      } else {
        console.warn('Update-leads step was not successful');
        if (updateLeadsStepResult && updateLeadsStepResult.status === 'failed') {
          console.error('Step failure reason:', (updateLeadsStepResult as any).error);
        }
      }
    }
    
    console.log(`Lead enrichment workflow returned results:`, result);
    
    // Default return with limited data
    return {
      success: true,
      data: result.results,
      enrichedBusinesses: []
    };
  } catch (error) {
    console.error(`Error in lead enrichment workflow:`, error);
    console.error(`Error stack:`, error instanceof Error ? error.stack : 'No stack trace available');
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace available'
    };
  }
}

/**
 * Extract content from a business website
 */
export async function extractWebsiteContent(originalUrl: string, retries = 2): Promise<string | null> {
  if (!originalUrl) {
    console.log('[FIRECRAWL] No website URL provided for extraction');
    return null;
  }

  // Normalize URL
  let normalizedUrl = originalUrl.trim();
  
  // Add protocol if missing
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = 'https://' + normalizedUrl;
  }

  // Remove trailing slashes
  normalizedUrl = normalizedUrl.replace(/\/+$/, '');
  
  console.log(`[FIRECRAWL] Extracting content from ${normalizedUrl}`);
  
  // Create URL variations to try
  const urlVariations: string[] = [];
  
  try {
    const urlObj = new URL(normalizedUrl);
    const hostname = urlObj.hostname;
    
    // Handle www. variations
    if (hostname.startsWith('www.')) {
      const nonWwwHostname = hostname.substring(4);
      urlVariations.push(
        `https://${hostname}${urlObj.pathname}${urlObj.search}`,
        `http://${hostname}${urlObj.pathname}${urlObj.search}`,
        `https://${nonWwwHostname}${urlObj.pathname}${urlObj.search}`,
        `http://${nonWwwHostname}${urlObj.pathname}${urlObj.search}`
      );
    } else {
      const wwwHostname = `www.${hostname}`;
      urlVariations.push(
        `https://${hostname}${urlObj.pathname}${urlObj.search}`,
        `http://${hostname}${urlObj.pathname}${urlObj.search}`,
        `https://${wwwHostname}${urlObj.pathname}${urlObj.search}`,
        `http://${wwwHostname}${urlObj.pathname}${urlObj.search}`
      );
    }
  } catch (parseError) {
    // If URL parsing fails, fall back to simple variations
    console.warn(`[FIRECRAWL] Error parsing URL ${normalizedUrl}: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    urlVariations.push(
      normalizedUrl,
      normalizedUrl.replace('https://', 'http://'),
      normalizedUrl.replace('http://', 'https://')
    );
    
    // Try adding/removing www
    if (normalizedUrl.includes('://www.')) {
      urlVariations.push(normalizedUrl.replace('://www.', '://'));
    } else {
      const protocol = normalizedUrl.startsWith('https://') ? 'https://' : 'http://';
      const domain = normalizedUrl.replace(/^https?:\/\//, '');
      urlVariations.push(`${protocol}www.${domain}`);
    }
  }
  
  // Remove duplicates
  const uniqueUrls = [...new Set(urlVariations)];
  console.log(`[FIRECRAWL] Will try these URL variations: ${uniqueUrls.join(', ')}`);
  
  // Try each URL variation with the improved firecrawlTool
  for (const url of uniqueUrls) {
    try {
      console.log(`[FIRECRAWL] Attempting to extract content using firecrawlTool for: ${url}`);
      
      const extractionResult = await firecrawlTool.extract({
        urls: [url],
        waitTime: 8000,                // Increase wait time for better content loading
        enableWebSearch: false,        // We don't need web search
        includeHtml: true,             // Include HTML for better extraction
        extractMetadata: true,         // Extract all possible metadata
        waitUntil: 'networkidle0',     // Wait until network is idle for better loading
        formats: ['text', 'markdown']  // Request both text and markdown formats
      });
      
      if (!extractionResult.success) {
        console.warn(`[FIRECRAWL] Extraction failed for ${url}: ${extractionResult.error}`);
        continue;
      }
      
      console.log(`[FIRECRAWL] Extraction successful for ${url}, processing data...`);
      
      // Process the extracted data to get text content
      let content = '';
      
      if (extractionResult.data) {
        const data = extractionResult.data;
        
        // Try different formats to extract content
        if (typeof data.content === 'string') {
          content = data.content;
          console.log(`[FIRECRAWL] Using direct content string (${content.length} chars)`);
        } else if (data.text) {
          content = data.text;
          console.log(`[FIRECRAWL] Using text property (${content.length} chars)`);
        } else if (data.formats?.text) {
          content = data.formats.text;
          console.log(`[FIRECRAWL] Using formats.text (${content.length} chars)`);
        } else if (data.formats?.markdown) {
          content = data.formats.markdown;
          console.log(`[FIRECRAWL] Using formats.markdown (${content.length} chars)`);
        } else if (data.formats?.html) {
          content = data.formats.html;
          console.log(`[FIRECRAWL] Using formats.html (${content.length} chars)`);
        } else if (Array.isArray(data.content)) {
          content = data.content
            .filter((item: any) => item && (item.content || item.text))
            .map((item: any) => item.content || item.text)
            .join('\n\n');
          console.log(`[FIRECRAWL] Using array content (${content.length} chars)`);
        } else if (data.contactInformation) {
          // If we have contact information but no content, create a minimal text representation
          const contactInfo = data.contactInformation;
          content = `Contact Information:\n`;
          if (contactInfo.email) content += `Email: ${contactInfo.email}\n`;
          if (contactInfo.phone) content += `Phone: ${contactInfo.phone}\n`;
          if (contactInfo.contactPersonName) content += `Contact: ${contactInfo.contactPersonName}\n`;
          if (contactInfo.address) content += `Address: ${contactInfo.address}\n`;
          console.log(`[FIRECRAWL] Using contact information (${content.length} chars)`);
        } else {
          // Last resort - stringify the data
          content = JSON.stringify(data, null, 2);
          console.log(`[FIRECRAWL] Using stringified data (${content.length} chars)`);
        }
      }
      
      if (content && content.length > 100) {
        console.log(`[FIRECRAWL] Successfully extracted ${content.length} characters from ${url}`);
        return content;
      } else {
        console.warn(`[FIRECRAWL] Extracted content from ${url} was too short or empty: ${content?.length || 0} chars`);
      }
    } catch (extractError) {
      console.error(`[FIRECRAWL] Error extracting content from ${url}:`, extractError);
    }
  }
  
  // If all previous attempts failed, try one last direct API call as fallback
  try {
    console.log(`[FIRECRAWL] All firecrawlTool attempts failed, trying fallback API for: ${normalizedUrl}`);
    const response = await fetch(`https://firecrawl-production.up.railway.app/api/extract?url=${encodeURIComponent(normalizedUrl)}`);
    
    if (response.ok) {
      const data = await response.json();
      const content = data.result?.content;
      
      if (content && content.length > 100) {
        console.log(`[FIRECRAWL] Successfully extracted ${content.length} characters using fallback API`);
        return content;
      }
    }
  } catch (fallbackError) {
    console.error(`[FIRECRAWL] Fallback extraction failed:`, fallbackError);
  }
  
  console.error(`[FIRECRAWL] Failed to extract content from any URL variation of ${originalUrl}`);
  return null;
}

interface EnrichmentOptions {
  prioritizeEmails?: boolean;
  skipWebsiteExtraction?: boolean;
}

interface EnrichmentWorkflowResult {
  success: boolean;
  enrichedBusinesses: any[];
  result: {
    totalProcessed: number;
    successCount: number;
    failureCount: number;
    details: any[];
    highValueLeads: number;
  };
  error?: string;
}

/**
 * Helper function to get a label for a lead score
 */
function getLeadScoreLabel(score: number): string {
  if (score >= 80) return 'Hot';
  if (score >= 60) return 'Warm';
  if (score >= 40) return 'Lukewarm';
  return 'Cold';
}

/**
 * Extract content from Firecrawl data response
 */
function extractContentFromFirecrawlData(data: any): string | null {
  if (!data) return null;
  
  // Initialize content
  let content = '';
  
  // Try different formats to extract content
  if (typeof data.content === 'string') {
    content = data.content;
    console.log(`[FIRECRAWL] Using direct content string (${content.length} chars)`);
  } else if (data.text) {
    content = data.text;
    console.log(`[FIRECRAWL] Using text property (${content.length} chars)`);
  } else if (data.formats?.text) {
    content = data.formats.text;
    console.log(`[FIRECRAWL] Using formats.text (${content.length} chars)`);
  } else if (data.formats?.markdown) {
    content = data.formats.markdown;
    console.log(`[FIRECRAWL] Using formats.markdown (${content.length} chars)`);
  } else if (data.formats?.html) {
    content = data.formats.html;
    console.log(`[FIRECRAWL] Using formats.html (${content.length} chars)`);
  } else if (Array.isArray(data.content)) {
    content = data.content
      .filter((item: any) => item && (item.content || item.text))
      .map((item: any) => item.content || item.text)
      .join('\n\n');
    console.log(`[FIRECRAWL] Using array content (${content.length} chars)`);
  }
  
  // If structured data is available, add it to the beginning for better context
  if (data.structuredData && Array.isArray(data.structuredData) && data.structuredData.length > 0) {
    content = `STRUCTURED DATA FROM WEBSITE:\n${JSON.stringify(data.structuredData, null, 2)}\n\n` + content;
    console.log(`[FIRECRAWL] Added structured data to content (${data.structuredData.length} items)`);
  }
  
  // If contact information is available but we don't have much content, add it
  if (data.contactInformation && content.length < 200) {
    const contactInfo = data.contactInformation;
    let contactText = `\nContact Information:\n`;
    if (contactInfo.email) contactText += `Email: ${contactInfo.email}\n`;
    if (contactInfo.phone) contactText += `Phone: ${contactInfo.phone}\n`;
    if (contactInfo.contactPersonName) contactText += `Contact: ${contactInfo.contactPersonName}\n`;
    if (contactInfo.address) contactText += `Address: ${contactInfo.address}\n`;
    
    content += contactText;
    console.log(`[FIRECRAWL] Added contact information to content`);
  }
  
  return content.length > 0 ? content : null;
}

export default leadEnrichmentWorkflow; 