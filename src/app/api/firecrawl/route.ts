import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

/**
 * POST handler for Firecrawl operations
 * 
 * This server-side API route ensures the Firecrawl API key is only accessed on the server
 * and not exposed to the client.
 */
export async function POST(req: NextRequest) {
  // Authenticate the user session
  const session = await auth();
  
  if (!session || !session.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }
  
  try {
    // Parse the request body containing the Firecrawl options
    const options = await req.json();
    
    // Get Firecrawl API key from environment variables (only accessible server-side)
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      console.error('[SERVER] Firecrawl API key not found in environment variables');
      return NextResponse.json(
        { success: false, error: 'Firecrawl API key not configured on server' },
        { status: 500 }
      );
    }
    
    // Validate URL(s)
    const urls = options.urls || [];
    if (urls.length === 0 && !options.url) {
      return NextResponse.json(
        { success: false, error: 'No URL provided for extraction' },
        { status: 400 }
      );
    }
    
    // Add the URL to urls array if it's not already there
    if (options.url && !urls.includes(options.url)) {
      urls.push(options.url);
    }
    
    const url = urls[0]; // We'll process just the first URL for simplicity
    
    // Prepare the request body for Firecrawl API
    const requestBody = {
      urls: [url],
      wait_time: options.waitTime || 5000,
      extract_contact_info: true,
      extract_structured_data: true,
      extract_metadata: true,
      enable_web_search: options.enableWebSearch || false,
      include_html: options.includeHtml || false,
      wait_until: options.waitUntil || 'networkidle0',
      formats: ['text', 'markdown']
    };
    
    console.log(`[SERVER] Calling Firecrawl API for URL: ${url}`);
    
    try {
      // Make the actual API call to Firecrawl
      const firecrawlEndpoint = 'https://api.firecrawl.dev/v1/extract';
      
      const firecrawlResponse = await fetch(firecrawlEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody),
        // Set a reasonable timeout
        signal: AbortSignal.timeout(30000)
      });
      
      if (!firecrawlResponse.ok) {
        console.error(`[SERVER] Firecrawl API returned error: ${firecrawlResponse.status}`);
        // If API call fails, use our fallback method
        return await handleDirectFallback(url);
      }
      
      // Parse the response from Firecrawl
      const responseData = await firecrawlResponse.json();
      
      if (!responseData || !Array.isArray(responseData) || responseData.length === 0) {
        console.error('[SERVER] Firecrawl API returned invalid data format');
        return await handleDirectFallback(url);
      }
      
      // Firecrawl v1 API returns an array of results
      const firstResult = responseData[0];
      
      console.log(`[SERVER] Firecrawl API extraction successful, processing data`);
      
      // Extract relevant data from the Firecrawl result
      const extractedData = processFirecrawlResult(firstResult, url);
      
      console.log(`[SERVER] Returning ${extractedData.data.content.length} characters of content with ${
        extractedData.data.contactInformation?.emails?.length || 0} emails and ${
        extractedData.data.contactInformation?.phoneNumbers?.length || 0} phone numbers`);
      
      return NextResponse.json(extractedData);
      
    } catch (apiError) {
      console.error(`[SERVER] Error calling Firecrawl API:`, apiError);
      // If API call fails with an exception, use our fallback method
      return await handleDirectFallback(url);
    }
    
  } catch (error) {
    console.error('[SERVER] Error in Firecrawl API route:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error occurred"
      },
      { status: 500 }
    );
  }
}

/**
 * Process the Firecrawl API result into a standard format
 */
function processFirecrawlResult(result: any, url: string): any {
  // Default empty response structure
  const defaultResponse = {
    success: true,
    url: url,
    data: {
      content: '',
      text: '',
      formats: {
        text: '',
        markdown: ''
      },
      metadata: {
        title: extractTitleFromUrl(url),
        description: '',
        url: url,
        source: "firecrawl"
      },
      contactInformation: {
        emails: [],
        phoneNumbers: []
      }
    }
  };
  
  if (!result) return defaultResponse;
  
  try {
    // Extract content from various possible locations in the response
    let content = '';
    let markdown = '';
    
    // Check for content in formats
    if (result.formats) {
      if (result.formats.text) {
        content = result.formats.text;
      }
      if (result.formats.markdown) {
        markdown = result.formats.markdown;
      }
    }
    
    // If no content found in formats, try direct content
    if (!content && result.content) {
      content = typeof result.content === 'string' ? result.content : '';
    }
    
    // Extract metadata
    const metadata = {
      title: result.title || result.metadata?.title || extractTitleFromUrl(url),
      description: result.description || result.metadata?.description || '',
      url: url,
      source: "firecrawl"
    };
    
    // Extract contact information
    const emails = [];
    const phoneNumbers = [];
    
    // Try to find contact info in the structured response
    if (result.contactInformation) {
      if (Array.isArray(result.contactInformation.emails)) {
        emails.push(...result.contactInformation.emails);
      }
      if (Array.isArray(result.contactInformation.phoneNumbers)) {
        phoneNumbers.push(...result.contactInformation.phoneNumbers);
      }
    }
    
    // If no emails found, try to extract from content
    if (emails.length === 0 && content) {
      const extractedEmails = extractEmailsFromContent(content);
      emails.push(...extractedEmails);
    }
    
    // If no phone numbers found, try to extract from content
    if (phoneNumbers.length === 0 && content) {
      const extractedPhones = extractPhoneNumbers(content);
      phoneNumbers.push(...extractedPhones);
    }
    
    return {
      success: true,
      url: url,
      data: {
        content: content,
        text: content,
        formats: {
          text: content,
          markdown: markdown || content
        },
        metadata: metadata,
        contactInformation: {
          emails: emails,
          phoneNumbers: phoneNumbers
        }
      }
    };
  } catch (error) {
    console.error(`[SERVER] Error processing Firecrawl result:`, error);
    return defaultResponse;
  }
}

/**
 * Fallback handler for direct website fetching when Firecrawl API fails
 */
async function handleDirectFallback(url: string) {
  console.log(`[SERVER] Using direct fetch fallback for ${url}`);
  
  let content = '';
  let title = '';
  let description = '';
  let emails: string[] = [];
  let phoneNumbers: string[] = [];
  
  try {
    // Basic web scraping fallback - get at least some content
    console.log(`[SERVER] Attempting direct fetch for ${url}`);
    const fetchResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (fetchResponse.ok) {
      const html = await fetchResponse.text();
      
      // Extract text content from HTML (basic)
      content = extractTextFromHtml(html);
      console.log(`[SERVER] Direct fetch succeeded, got ${content.length} chars`);
      
      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].trim();
      } else {
        title = extractTitleFromUrl(url);
      }
      
      // Extract meta description
      const descriptionMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i);
      if (descriptionMatch && descriptionMatch[1]) {
        description = descriptionMatch[1].trim();
      }
      
      // Extract emails
      emails = extractEmailsFromContent(content);
      
      // Extract phone numbers
      phoneNumbers = extractPhoneNumbers(content);
    }
  } catch (fetchError) {
    console.warn(`[SERVER] Direct fetch fallback failed:`, fetchError);
  }
  
  // Return the content in a format compatible with enrichment agent expectations
  const result = {
    success: true,
    url: url,
    data: {
      content: content,
      text: content,
      formats: {
        text: content,
        markdown: content
      },
      metadata: {
        title: title || extractTitleFromUrl(url),
        description: description || '',
        url: url,
        source: "fallback"
      },
      contactInformation: {
        emails: emails,
        phoneNumbers: phoneNumbers
      }
    }
  };
  
  console.log(`[SERVER] Returning ${content.length} characters of content with ${emails.length} emails and ${phoneNumbers.length} phone numbers from fallback`);
  return NextResponse.json(result);
}

/**
 * Helper function to extract text from HTML
 */
function extractTextFromHtml(html: string): string {
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
}

/**
 * Extract emails from content using regex
 */
function extractEmailsFromContent(content: string): string[] {
  if (!content) return [];
  
  // Email regex pattern
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
 * Extract phone numbers from content using regex
 */
function extractPhoneNumbers(content: string): string[] {
  if (!content) return [];
  
  // Phone number regex patterns
  const phonePatterns = [
    /\b\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})\b/g,  // (555) 555-5555, 555-555-5555, 555.555.5555
    /\b\+1\s?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})\b/g  // +1 (555) 555-5555
  ];
  
  let matches: string[] = [];
  
  // Find all matches from both patterns
  for (const pattern of phonePatterns) {
    const patternMatches = content.match(pattern) || [];
    matches = [...matches, ...patternMatches];
  }
  
  // Remove duplicates
  return [...new Set(matches)];
}

/**
 * Extract a title from a URL
 */
function extractTitleFromUrl(url: string): string {
  try {
    const { hostname, pathname } = new URL(url);
    
    // Extract domain name without www and TLD
    let domain = hostname.replace(/^www\./, '').split('.')[0];
    domain = domain.charAt(0).toUpperCase() + domain.slice(1);
    
    // Extract path segments
    const pathSegments = pathname.split('/').filter(Boolean);
    if (pathSegments.length > 0) {
      const lastSegment = pathSegments[pathSegments.length - 1]
        .replace(/-/g, ' ')
        .replace(/\.(html|php|aspx)$/, '');
      
      if (lastSegment) {
        return `${domain} - ${lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1)}`;
      }
    }
    
    return domain;
  } catch (e) {
    // If URL parsing fails, return the URL as is
    return url;
  }
} 