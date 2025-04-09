import { Tool } from '@mastra/core/tools';

/**
 * FireCrawl tool for web scraping and lead data enrichment
 * Handles extraction of website content for lead enrichment
 */

// Types for the FireCrawl tool
export interface FirecrawlOptions {
  url?: string;  // Keep for backward compatibility
  urls?: string[];  // New field for v1 API
  timeout?: number;
  waitTime?: number;
  enableWebSearch?: boolean;
  includeHtml?: boolean;
  extractMetadata?: boolean;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  formats?: string[];
}

export interface FirecrawlResult {
  success: boolean;
  data?: any;
  error?: string;
  url: string;
}

/**
 * Normalize URL by ensuring it has proper format with protocol
 */
function normalizeUrl(url: string): string {
  if (!url) return url;
  
  try {
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    // Validate the URL
    new URL(url);
    return url;
  } catch (error) {
    console.warn(`[FIRECRAWL] ⚠️ URL parsing failed for ${url}, using as-is:`, error);
    return url;
  }
}

/**
 * Extract data from a website using Firecrawl API
 */
export async function extractWebsiteData(options: FirecrawlOptions): Promise<FirecrawlResult> {
  const { 
    url: rawUrl, 
    urls: rawUrls,
    timeout = 30000, 
    waitTime = 5000, 
    enableWebSearch = false,
    includeHtml = false,
    extractMetadata = true,
    waitUntil = 'load',
    formats = []
  } = options;
  
  // Set up logging prefix for easy debugging
  const logPrefix = `[FIRECRAWL]`;
  
  // Determine URL to use - prefer urls array if provided, fall back to single url
  let urlToProcess = rawUrl;
  let urlsArray: string[] = [];
  
  if (rawUrls && rawUrls.length > 0) {
    urlsArray = rawUrls.map(u => normalizeUrl(u)).filter(Boolean) as string[];
    urlToProcess = urlsArray[0];
  } else if (rawUrl) {
    urlToProcess = normalizeUrl(rawUrl);
    urlsArray = [urlToProcess];
  }
  
  // If no URL provided, return error
  if (!urlToProcess) {
    console.error(`${logPrefix} ❌ No URL provided`);
    return {
      success: false,
      error: `No URL provided`,
      url: ''
    };
  }
  
  console.log(`${logPrefix} 📌 Extracting data from URL: ${urlToProcess}`);
  
  try {
    // Check if URL is valid
    try {
      new URL(urlToProcess);
    } catch (e) {
      console.error(`${logPrefix} ❌ Invalid URL: ${urlToProcess}`);
      return {
        success: false,
        error: `Invalid URL: ${urlToProcess}`,
        url: urlToProcess
      };
    }
    
    // Get Firecrawl API key from environment variables
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      console.error(`${logPrefix} ❌ API key not found in environment variables`);
      return {
        success: false,
        error: 'Firecrawl API key not configured',
        url: urlToProcess
      };
    }
    
    // Log API key existence (not the actual key)
    console.log(`${logPrefix} ✅ API key found: ${apiKey.substring(0, 10)}...`);
    
    // Call the Firecrawl API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      // Define the API endpoint for Firecrawl
      const firecrawlEndpoint = 'https://api.firecrawl.dev/v1/extract';
      
      // Prepare request body
      const requestBody = {
        urls: urlsArray,
        wait_time: waitTime,
        extract_contact_info: true,
        extract_structured_data: true,
        extract_metadata: extractMetadata,
        enable_web_search: enableWebSearch,
        include_html: includeHtml,
        wait_until: waitUntil,
        formats: formats.length > 0 ? formats : undefined
      };
      
      console.log(`${logPrefix} 📌 Calling API with settings:`, {
        urls: urlsArray,
        wait_time: waitTime,
        extract_contact_info: true,
        formats,
        endpoint: firecrawlEndpoint
      });
      
      // Make the API call
      console.log(`${logPrefix} 🔄 Making request to ${firecrawlEndpoint}`);
      const response = await fetch(firecrawlEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      console.log(`${logPrefix} 📝 Response status: ${response.status}, Status text: ${response.statusText}`);
      console.log(`${logPrefix} 📝 Response headers:`, Object.fromEntries([...response.headers.entries()]));
      
      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        const errorText = await response.text();
        console.error(`${logPrefix} ❌ API error: Status ${response.status}, Response: ${errorText.substring(0, 200)}`);
        
        // Try to parse error if it's JSON
        let parsedError = errorText;
        try {
          if (contentType.includes('application/json')) {
            const jsonError = JSON.parse(errorText);
            parsedError = JSON.stringify(jsonError);
            console.error(`${logPrefix} ❌ Parsed API error:`, jsonError);
          }
        } catch (e) {
          console.error(`${logPrefix} ❌ Error parsing error response:`, e);
        }
        
        return {
          success: false,
          error: `Firecrawl API error: ${response.status} ${parsedError.substring(0, 200)}`,
          url: urlToProcess
        };
      }
      
      // Parse response
      let data;
      let responseText;
      try {
        responseText = await response.text();
        console.log(`${logPrefix} 📝 Response body (first 200 chars): ${responseText.substring(0, 200)}...`);
        data = JSON.parse(responseText);
      } catch (parseError: unknown) {
        console.error(`${logPrefix} ❌ JSON parse error: ${parseError}`);
        console.error(`${logPrefix} ❌ Raw response text:`, responseText?.substring(0, 500));
        return {
          success: false,
          error: `Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          url: urlToProcess
        };
      }
      
      console.log(`${logPrefix} ✅ Successfully extracted data from ${urlToProcess}`);
      
      // Handle the array response format from v1 API
      if (data && Array.isArray(data) && data.length > 0) {
        const firstResult = data[0];
        // Log what we got for debugging
        console.log(`${logPrefix} 📝 Data keys: ${Object.keys(firstResult).join(', ')}`);
        
        // Check if we have contact information
        if (firstResult.contactInformation) {
          console.log(`${logPrefix} ✅ Contact info found: ${JSON.stringify(firstResult.contactInformation)}`);
        }
        
        // Check if we have content in different formats
        if (firstResult.formats) {
          console.log(`${logPrefix} ✅ Formats available: ${Object.keys(firstResult.formats).join(', ')}`);
        }
        
        return {
          success: true,
          url: urlToProcess,
          data: firstResult
        };
      } else {
        console.warn(`${logPrefix} ⚠️ Unexpected API response format`);
        console.warn(`${logPrefix} ⚠️ Response data:`, JSON.stringify(data).substring(0, 500));
        return {
          success: true,
          url: urlToProcess,
          data: { content: "No structured data available" }
        };
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error(`${logPrefix} ❌ Request timed out after ${timeout}ms for URL: ${urlToProcess}`);
        return {
          success: false,
          error: `Request timed out after ${timeout}ms`,
          url: urlToProcess
        };
      }
      
      console.error(`${logPrefix} ❌ Error during API call:`, error);
      console.error(`${logPrefix} ❌ Error details:`, {
        message: error.message,
        name: error.name,
        stack: error.stack?.substring(0, 500)
      });
      
      return {
        success: false,
        error: `Error during API call: ${error.message}`,
        url: urlToProcess
      };
    }
  } catch (error) {
    console.error(`${logPrefix} ❌ Error extracting data from ${urlToProcess}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      url: urlToProcess
    };
  }
}

/**
 * Extract content from Firecrawl data response
 */
export function extractContentFromFirecrawlData(data: any): string | null {
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
  
  return content.length > 0 ? content : null;
}

/**
 * FireCrawl tool integrated with Mastra framework
 */
export const firecrawlTool = {
  id: 'firecrawl',
  name: 'firecrawlTool',
  description: 'Extract structured data from websites',
  
  // Extract method 
  extract: async function(options: FirecrawlOptions): Promise<FirecrawlResult> {
    console.log(`[FIRECRAWL] 📌 Tool extraction requested for URL: ${options.url || (options.urls && options.urls[0]) || 'undefined'}`); 
    const startTime = Date.now();
    
    try {
      // Extract website data
      const result = await extractWebsiteData(options);
      
      // Log duration
      const duration = Date.now() - startTime;
      console.log(`[FIRECRAWL] ${result.success ? '✅' : '❌'} Extraction ${result.success ? 'completed' : 'failed'} in ${duration}ms`);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const url = options.url || (options.urls && options.urls[0]) || '';
      
      console.error(`[FIRECRAWL] ❌ Exception during extraction for ${url} (took ${duration}ms):`, error);
      
      return {
        success: false,
        url,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  },
  
  // Mastra Tool-compatible execute method
  async execute(params: FirecrawlOptions): Promise<FirecrawlResult> {
    return await this.extract(params);
  }
}; 