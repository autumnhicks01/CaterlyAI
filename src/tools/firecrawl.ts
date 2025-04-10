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
  prompt?: string;
  schema?: any;
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
 * Helper function to extract text from HTML
 */
function extractTextFromHtml(html: string): string {
  try {
    // Remove scripts and style tags
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                   .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    
    // Remove HTML tags and decode entities
    text = text.replace(/<[^>]*>/g, ' ')
               .replace(/&nbsp;/g, ' ')
               .replace(/&amp;/g, '&')
               .replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>')
               .replace(/&quot;/g, '"')
               .replace(/&#39;/g, "'");
    
    // Remove excessive whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    return text;
  } catch (error) {
    console.error('[FIRECRAWL] Error extracting text from HTML:', error);
    return '';
  }
}

/**
 * Extract emails from content using regex
 */
function extractEmailsFromContent(content: string): string[] {
  if (!content) return [];
  
  // Email regex pattern - enhanced to catch more email formats
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  
  // Find all matches
  const matches = content.match(emailPattern) || [];
  
  // Filter out common false positives and duplicates
  const filteredEmails = [...new Set(matches)].filter(email => {
    // Skip common false positives
    if (email.includes('example.com')) return false;
    if (email.includes('yourdomain.com')) return false;
    if (email.includes('domain.com')) return false;
    if (email.includes('email@')) return false;
    
    return true;
  });
  
  return filteredEmails;
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
    formats = [],
    prompt,
    schema
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
      // Define the API endpoint for Firecrawl - using v1 extract endpoint
      const firecrawlEndpoint = 'https://api.firecrawl.dev/v1/extract';
      
      // Define a schema for structured extraction if not provided
      const extractionSchema = schema || {
        type: "object",
        properties: {
          venueName: { type: "string", description: "The name of the venue" },
          address: { type: "string", description: "The full physical address of the venue" },
          website: { type: "string", description: "The venue's website URL" },
          description: { type: "string", description: "A detailed description of the venue" },
          commonEventTypes: { 
            type: "array", 
            items: { type: "string" }, 
            description: "Types of events hosted at the venue (weddings, corporate, etc.)" 
          },
          amenities: { 
            type: "array", 
            items: { type: "string" }, 
            description: "Available amenities at the venue" 
          },
          inHouseCatering: { 
            type: "boolean", 
            description: "Whether the venue offers in-house catering" 
          },
          preferredCaterers: {
            type: "array",
            items: { type: "string" },
            description: "List of preferred caterers for the venue"
          },
          eventManagerPhone: { 
            type: "string", 
            description: "Contact phone number for venue bookings" 
          },
          eventManagerEmail: { 
            type: "string", 
            description: "Contact email for venue bookings - VERY IMPORTANT, search pages thoroughly for any contact email" 
          }
        },
        required: ["venueName", "eventManagerEmail", "address"]
      };
      
      // Use a venue-focused research prompt if not provided
      const researchPrompt = prompt || `Find comprehensive information about the venue at URL ${urlToProcess}, including:
      
1. Full official name of the venue
2. Complete physical address with zip code
3. Website URL
4. A concise description of the venue and its facilities
5. Types of events hosted (weddings, corporate, etc.)
6. Available amenities and special features
7. Whether they offer in-house catering
8. List of any preferred or exclusive caterers
9. Most importantly, find ALL contact information:
   - Direct email addresses for bookings or inquiries
   - Phone numbers
   - Names of venue managers or coordinators
   
If the venue has multiple websites or social media profiles, check all of them for contact information, especially email addresses.
Search for "Contact Us" pages, staff directories, booking forms, or "Meet the Team" sections.`;
      
      // Prepare request body according to v1 API
      const requestBody: {
        prompt: string;
        schema: any;
        enableWebSearch: boolean;
        urls?: string[];
      } = {
        prompt: researchPrompt,
        schema: extractionSchema,
        enableWebSearch: true // Always enable web search for best results
      };
      
      // Also include the URLs if provided
      if (urlsArray && urlsArray.length > 0) {
        requestBody.urls = urlsArray;
      }
      
      console.log(`${logPrefix} 📌 Calling Firecrawl v1 extract API for: ${urlToProcess}`);
      
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
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`${logPrefix} ❌ API error: Status ${response.status}, Response: ${errorText.substring(0, 200)}`);
        
        return {
          success: false,
          error: `Firecrawl API error: ${response.status} ${errorText.substring(0, 200)}`,
          url: urlToProcess
        };
      }
      
      // Parse the initial response
      const responseText = await response.text();
      const responseData = JSON.parse(responseText);
      
      // Check if we received a job ID for async extraction
      if (responseData && responseData.success && responseData.id) {
        console.log(`${logPrefix} 🔄 Received extraction job ID: ${responseData.id}, polling for results...`);
        
        // Poll for results (with timeout)
        const maxPolls = 12; // Max number of polls (12 * 5s = 60s timeout)
        let pollCount = 0;
        let extractionComplete = false;
        let extractedData = null;
        
        const statusEndpoint = `${firecrawlEndpoint}/${responseData.id}`;
        
        while (pollCount < maxPolls && !extractionComplete) {
          // Wait 5 seconds before each poll
          await new Promise(resolve => setTimeout(resolve, 5000));
          pollCount++;
          
          try {
            console.log(`${logPrefix} 🔄 Polling extraction status (attempt ${pollCount}/${maxPolls})...`);
            const statusResponse = await fetch(statusEndpoint, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${apiKey}`
              }
            });
            
            if (!statusResponse.ok) {
              console.error(`${logPrefix} ❌ Error checking extraction status: ${statusResponse.status}`);
              continue;
            }
            
            const statusData = await statusResponse.json();
            
            console.log(`${logPrefix} 📝 Status: ${statusData.status || 'unknown'}`);
            
            if (statusData.status === 'completed') {
              extractionComplete = true;
              extractedData = statusData.data;
              console.log(`${logPrefix} ✅ Extraction completed successfully`);
            } else if (statusData.status === 'failed') {
              extractionComplete = true;
              console.error(`${logPrefix} ❌ Extraction failed: ${statusData.error || 'Unknown error'}`);
              return {
                success: false,
                error: `Extraction failed: ${statusData.error || 'Unknown error'}`,
                url: urlToProcess
              };
            } else {
              console.log(`${logPrefix} 🔄 Extraction still in progress (${pollCount}/${maxPolls})...`);
            }
          } catch (pollError) {
            console.error(`${logPrefix} ❌ Error polling extraction status:`, pollError);
          }
        }
        
        if (!extractionComplete) {
          console.error(`${logPrefix} ❌ Extraction timed out after ${maxPolls} attempts`);
          return {
            success: false,
            error: `Extraction timed out after ${maxPolls * 5} seconds`,
            url: urlToProcess
          };
        }
        
        if (!extractedData) {
          console.error(`${logPrefix} ❌ No data returned from extraction`);
          return {
            success: false,
            error: 'No data returned from extraction',
            url: urlToProcess
          };
        }
        
        // Return the final extracted data
        return {
          success: true,
          data: extractedData,
          url: urlToProcess
        };
      } 
      
      // If no job ID, the response should contain the data directly
      return {
        success: true,
        data: responseData.data || responseData,
        url: urlToProcess
      };
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error(`${logPrefix} ❌ Error fetching from Firecrawl API:`, fetchError);
      
      return {
        success: false,
        error: `Error fetching from Firecrawl API: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
        url: urlToProcess
      };
    }
  } catch (error) {
    console.error(`${logPrefix} ❌ Unexpected error:`, error);
    
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      url: urlToProcess
    };
  }
}

// Add the firecrawlTool export that's used by other files
export const firecrawlTool = {
  /**
   * Extract structured data from a website using Firecrawl v1 API
   */
  async extract(options: FirecrawlOptions): Promise<FirecrawlResult> {
    return extractWebsiteData(options);
  },
  
  /**
   * Helper function to extract content from Firecrawl data
   */
  extractContent(data: any): string {
    if (!data) return '';
    
    // Try to find content in various response formats
    return data.text || 
           data.content || 
           (data.formats?.text) || 
           (data.formats?.markdown) ||
           '';
  }
};

// Export a function to extract content from Firecrawl data
export function extractContentFromFirecrawlData(data: any): string {
  return firecrawlTool.extractContent(data);
}