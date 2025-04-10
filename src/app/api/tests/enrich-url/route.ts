import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

// Simple in-memory storage for jobs
declare global {
  var jobStorage: Map<string, {
    url: string;
    status: string;
    result?: any;
    message?: string;
    startedAt: Date;
    error?: any;
  }>;
}

// Initialize job storage
if (!global.jobStorage) {
  global.jobStorage = new Map();
}

// Use the global storage
const jobStorage = global.jobStorage;

// Helper function to check if Firecrawl API is working with a specific URL
async function testFirecrawlConnection(testUrl: string): Promise<{ success: boolean; message: string; diagnostics?: any }> {
  console.log(`Running Firecrawl connection test for URL: ${testUrl}...`);
  
  try {
    // Check API key
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      return { 
        success: false, 
        message: "Firecrawl API key is missing"
      };
    }
    
    // Add wildcard to the URL for better crawling as per docs
    const urlWithWildcard = testUrl.endsWith('/') ? `${testUrl}*` : `${testUrl}/*`;
    
    // Define test schema
    const testSchema = {
      type: "object",
      properties: {
        title: { type: "string", description: "Title or name of the page/venue" },
        description: { type: "string", description: "Brief description of the content" }
      }
    };
    
    // Try a simple scrape request first
    console.log(`Testing Firecrawl connectivity with scrape endpoint for ${testUrl}...`);
    try {
      const scrapeResponse = await axios.post(
        'https://api.firecrawl.dev/scrape',
        { 
          url: testUrl,
          formats: ['text'] 
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 15000
        }
      );
      
      console.log(`Scrape test succeeded with status: ${scrapeResponse.status}`);
      
      // Now test extract endpoint with schema using the wildcard
      console.log(`Testing Firecrawl extract endpoint with schema and wildcard URL: ${urlWithWildcard}...`);
      try {
        const extractResponse = await axios.post(
          'https://api.firecrawl.dev/extract',
          { 
            urls: [urlWithWildcard],
            prompt: "Extract the title and a brief description of this page.",
            schema: testSchema,
            enableWebSearch: true
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            timeout: 15000
          }
        );
        
        return {
          success: true,
          message: "Firecrawl API is working properly with schema",
          diagnostics: {
            scrapeStatus: scrapeResponse.status,
            extractStatus: extractResponse.status,
            scrapeData: scrapeResponse.data,
            extractResponse: extractResponse.data
          }
        };
      } catch (schemaError: any) {
        console.log(`Schema extract test failed: ${schemaError.message}`);
        
        // Try without schema as fallback
        const extractNoSchemaResponse = await axios.post(
          'https://api.firecrawl.dev/extract',
          { 
            urls: [urlWithWildcard],
            prompt: "Extract the title and a brief description of this page.",
            enableWebSearch: true
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            timeout: 15000
          }
        );
        
        return {
          success: true,
          message: "Firecrawl API is working with prompt only (schema failed)",
          diagnostics: {
            scrapeStatus: scrapeResponse.status,
            extractStatus: extractNoSchemaResponse.status,
            scrapeData: scrapeResponse.data,
            extractResponse: extractNoSchemaResponse.data,
            schemaError: {
              message: schemaError.message,
              response: schemaError.response?.data
            }
          }
        };
      }
    } catch (scrapeError: any) {
      console.log(`Scrape test failed: ${scrapeError.message}, trying extract only`);
      
      // Try extract even if scrape failed
      const extractResponse = await axios.post(
        'https://api.firecrawl.dev/extract',
        { 
          urls: [urlWithWildcard],
          prompt: "Extract the title and a brief description of this page.",
          enableWebSearch: true
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 15000
        }
      );
      
      return {
        success: true,
        message: "Firecrawl extract API is working but scrape failed",
        diagnostics: {
          scrapeError: {
            message: scrapeError.message,
            response: scrapeError.response?.data
          },
          extractStatus: extractResponse.status,
          extractResponse: extractResponse.data
        }
      };
    }
  } catch (error: any) {
    console.error("Firecrawl API test completely failed:", error.message);
    
    return {
      success: false,
      message: `Firecrawl API test failed: ${error.message}`,
      diagnostics: {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers
      }
    };
  }
}

export async function POST(request: Request) {
  try {
    console.log('Starting URL enrichment process...');
    console.log(`[ENV CHECK] FIRECRAWL_API_KEY present: ${Boolean(process.env.FIRECRAWL_API_KEY)}`);
    console.log(`[ENV CHECK] OPENAI_API_KEY present: ${Boolean(process.env.OPENAI_API_KEY)}`);
    
    // Parse the request body
    const reqBody = await request.json();
    
    // Check if this is a test request
    if (reqBody.testFirecrawl === true) {
      console.log("Received test request for Firecrawl API");
      const testUrl = reqBody.url || 'https://www.example.com';
      const testResult = await testFirecrawlConnection(testUrl);
      return NextResponse.json(testResult);
    }
    
    const { url } = reqBody;
    
    // Check for required API keys
    if (!process.env.FIRECRAWL_API_KEY) {
      return NextResponse.json({ error: 'API configuration error (Firecrawl API key missing)' }, { status: 500 });
    }
    
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'API configuration error (OpenAI API key missing)' }, { status: 500 });
    }
    
    // Validate the URL
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }
    
    // Create a unique job ID
    const jobId = uuidv4();
    console.log(`Creating new job ${jobId} for URL: ${url}`);
    
    // Store the job in memory
    jobStorage.set(jobId, {
      url,
      status: 'validating',
      startedAt: new Date()
    });
    
    // Start the enrichment process in the background
    startEnrichmentProcess(jobId, url);
    
    // Return the job ID
    return NextResponse.json({ jobId });
  } catch (error) {
    console.error('Error starting enrichment:', error);
    return NextResponse.json(
      { error: 'Failed to start enrichment process' },
      { status: 500 }
    );
  }
}

// Function to process the URL in the background
async function startEnrichmentProcess(jobId: string, url: string) {
  try {
    console.log(`Starting enrichment process for job ${jobId}`);
    
    // Update status to extracting
    jobStorage.set(jobId, {
      ...jobStorage.get(jobId)!,
      status: 'extracting'
    });
    
    // Step 1: Use Firecrawl to extract data from the URL
    let scrapedData = null;
    let websiteContent = '';
    
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      
      console.log(`Calling Firecrawl extract API for ${url}`);
      
      // Log API key info (first few chars only for security)
      const apiKey = process.env.FIRECRAWL_API_KEY;
      console.log(`API key available: ${Boolean(apiKey)}, Key starts with: ${apiKey ? apiKey.substring(0, 5) + '...' : 'N/A'}`);
      
      try {
        // Define a proper schema for Firecrawl extraction
        const extractSchema = {
          type: "object",
          properties: {
            venueName: { type: "string", description: "Name of the venue" },
            physicalAddress: { type: "string", description: "Complete physical address of the venue including street, city, state and zip code" },
            contactInformation: {
              type: "object",
              properties: {
                phone: { type: "string", description: "Main contact phone number for the venue" },
                email: { type: "string", description: "IMPORTANT: Main contact email address for the venue - search thoroughly in contact forms and pages" },
                contactPersonName: { type: "string", description: "Name of the main contact person" }
              },
              required: ["email", "phone"]
            },
            managementContact: {
              type: "object",
              properties: {
                managementContactName: { type: "string", description: "Name of the venue/event manager" },
                managementContactEmail: { type: "string", description: "CRITICAL: Email of the venue/event manager - search extensively in all pages and forms" },
                managementContactPhone: { type: "string", description: "Phone number of the venue/event manager" }
              },
              required: ["managementContactEmail"]
            },
            eventTypes: { 
              type: "array", 
              items: { type: "string" },
              description: "Types of events hosted at the venue (weddings, corporate, etc.)" 
            },
            venueCapacity: { type: "string", description: "The capacity/maximum occupancy of the venue" },
            inHouseCatering: { type: "boolean", description: "Whether the venue offers in-house catering" },
            amenities: { 
              type: "array", 
              items: { type: "string" },
              description: "List of amenities offered by the venue" 
            },
            preferredCaterers: { 
              type: "array", 
              items: { type: "string" },
              description: "List of preferred caterers if any" 
            },
            pricingInformation: { type: "string", description: "Pricing information for the venue" },
            description: { type: "string", description: "A brief description of the venue" },
            eventDetails: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  eventName: { type: "string" },
                  eventDate: { type: "string" }
                }
              },
              description: "Details of recent or upcoming events at the venue"
            }
          },
          required: ["contactInformation", "managementContact"]
        };

        const extractPrompt = `
        Extract comprehensive venue information from this website, formatted exactly according to the provided schema.
        
        *** MOST CRITICAL REQUIREMENT: Find at least one valid email address for contacting the venue. ***
        
        Specifically look for and extract:
        1. The venue name and complete physical address
        2. All contact information including phone, email, and contact person details
        3. Types of events hosted (be specific: weddings, corporate events, etc.)
        4. Venue capacity numbers
        5. Whether they offer in-house catering (true/false)
        6. Complete list of amenities offered
        7. List of preferred caterers (if mentioned)
        8. Any pricing information available
        9. A concise description of the venue
        
        EMAIL EXTRACTION INSTRUCTIONS (HIGHEST PRIORITY):
        - Search thoroughly for ANY email addresses on the site, especially in:
          * "Contact Us" pages
          * Staff/Team directories
          * Footer sections
          * Inquiry/booking forms (examine form fields and surrounding text)
          * Event planning or rental information pages
          * PDF brochures or documents linked from the site
        - Look for text patterns like "Email:", "Contact:", or email addresses directly
        - Check for JavaScript-based email protection and decode if needed
        - If an email is displayed as an image, note this in your response
        - Check both general contact emails and specific staff emails
        
        IMPORTANT: If you find multiple emails, prioritize ones for:
        1. Event managers/coordinators
        2. Sales/booking contacts
        3. General inquiries
        
        If in-house catering is mentioned anywhere, mark it as true. 
        If preferred or exclusive caterers are listed, capture all of them accurately.
        
        If you can't find specific information for a field, leave it empty rather than guessing.
        `;

        // Initialize extractResponse
        let extractResponse: any = null;
        let scrapedData: any = null;
        let extractionJobId: string | null = null;
        
        // Try with schema first
        try {
          console.log(`Calling Firecrawl extract API for ${url} with schema`);
          
          // Add wildcard to crawl the entire site - a key feature from docs
          const urlWithWildcard = url.endsWith('/') ? `${url}*` : `${url}/*`;
          console.log(`Using wildcard URL pattern: ${urlWithWildcard}`);
          
          extractResponse = await axios.post(
            'https://api.firecrawl.dev/extract',
            { 
              urls: [urlWithWildcard], // Use wildcard to crawl the entire site
              prompt: extractPrompt,
              schema: extractSchema,
              enableWebSearch: true
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`
              },
              timeout: 60000
            }
          );
          
          console.log(`Extract API response status: ${extractResponse.status}`);
          console.log(`Extract API response structure:`, JSON.stringify(Object.keys(extractResponse.data)).substring(0, 200));
          
          // Check if response has proper structure according to docs
          if (extractResponse.data && 
              (extractResponse.data.success === true) && 
              extractResponse.data.data) {
            console.log(`Extraction successful with data, content type:`, typeof extractResponse.data.data);
            scrapedData = extractResponse.data.data;
          } else if (extractResponse.data && 
                    (extractResponse.data.status === "processing" || extractResponse.data.job_id)) {
            extractionJobId = extractResponse.data.job_id;
            console.log(`Got job ID for polling: ${extractionJobId}`);
          } else {
            console.log(`Unexpected response structure: ${JSON.stringify(extractResponse.data).substring(0, 200)}`);
          }
        } catch (schemaError: any) {
          console.log(`Extract with schema failed, trying with prompt only: ${schemaError.message}`);
          console.log(`Error details: ${JSON.stringify(schemaError.response?.data || {})}`);
          
          // Fallback to prompt-only approach as shown in docs
          try {
            const urlWithWildcard = url.endsWith('/') ? `${url}*` : `${url}/*`;
            extractResponse = await axios.post(
              'https://api.firecrawl.dev/extract',
              { 
                urls: [urlWithWildcard],
                prompt: extractPrompt,
                enableWebSearch: true
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`
                },
                timeout: 60000
              }
            );
            
            console.log(`Extract API (prompt-only) response status: ${extractResponse.status}`);
            
            // Per docs, check correct response structure
            if (extractResponse.data && 
                (extractResponse.data.success === true) && 
                extractResponse.data.data) {
              console.log(`Prompt-only extraction successful`);
              scrapedData = extractResponse.data.data;
            } else if (extractResponse.data && 
                      (extractResponse.data.status === "processing" || extractResponse.data.job_id)) {
              extractionJobId = extractResponse.data.job_id;
              console.log(`Got job ID for polling: ${extractionJobId}`);
            } else {
              console.log(`Unexpected prompt-only response structure: ${JSON.stringify(extractResponse.data).substring(0, 200)}`);
            }
          } catch (promptError: any) {
            console.error(`Both schema and prompt-only approaches failed: ${promptError.message}`);
            // Continue to fallback methods
          }
        }
        
        // Check if we need to poll for results (async job) - as shown in the documentation
        if (extractionJobId) {
          // Poll for results
          let extractionComplete = false;
          let retries = 0;
          const maxRetries = 8;
          
          while (!extractionComplete && retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds between polls
            
            console.log(`Checking status for job ${extractionJobId}, attempt ${retries + 1}/${maxRetries}`);
            const statusResponse = await axios.get(
              `https://api.firecrawl.dev/extract/${extractionJobId}`,
              {
                headers: {
                  'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`
                }
              }
            );
            
            if (statusResponse.data.status === "completed") {
              console.log(`Firecrawl extraction completed for job ${extractionJobId}`);
              scrapedData = statusResponse.data.data;
              extractionComplete = true;
            } else if (statusResponse.data.status === "failed") {
              throw new Error(`Firecrawl job failed: ${statusResponse.data.error || 'Unknown error'}`);
            } else {
              console.log(`Extraction in progress: ${statusResponse.data.status}, retrying in 3s...`);
              retries++;
            }
          }
          
          if (!extractionComplete) {
            throw new Error(`Extraction timed out after ${maxRetries} retries`);
          }
        }
        
        // Now get content via scrape endpoint for additional context
        console.log(`Getting content via scrape endpoint for more context`);
        try {
          const scrapeResponse = await axios.post(
            'https://api.firecrawl.dev/scrape',
            { 
              url,
              formats: ['markdown']
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`
              },
              timeout: 30000
            }
          );
          
          if (scrapeResponse.data && scrapeResponse.data.success) {
            websiteContent = scrapeResponse.data.data.markdown || '';
            console.log(`Scrape successful, content length: ${websiteContent.length}`);
            
            // Add metadata if not already in scrapedData
            if (scrapeResponse.data.data.metadata && (!scrapedData || !scrapedData.metadata)) {
              if (!scrapedData) scrapedData = {};
              scrapedData.metadata = scrapeResponse.data.data.metadata;
            }
          }
        } catch (scrapeError) {
          console.log(`Scrape for content failed, but we have structured data from extract`);
          // Continue with the process - we have the structured data
        }
      } catch (extractError: unknown) {
        const typedError = extractError as { message?: string; response?: { data?: any; status?: number } };
        console.error(`Firecrawl extract error:`, typedError.message || 'Unknown error');
        console.error(`Error details:`, typedError.response?.data || 'No response data');
        console.error(`Error status:`, typedError.response?.status || 'No status code');
        
        // Try direct fetch as fallback
        try {
          const urlObj = new URL(url);
          const domain = urlObj.hostname;
          
          console.log(`Trying direct fetch as fallback for ${url}`);
          const directResponse = await axios.get(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.5"
            },
            timeout: 30000
          });
          
          websiteContent = directResponse.data;
          console.log(`Direct fetch successful, content length: ${websiteContent.length}`);
          
          // Create basic metadata
          scrapedData = { 
            metadata: { 
              sourceURL: url,
              statusCode: directResponse.status,
              title: url.split('/').pop() || domain
            }
          };
        } catch (directError) {
          console.error(`Direct fetch also failed:`, directError);
          
          // Create minimal data from the URL
          const urlObj = new URL(url);
          const domain = urlObj.hostname;
          websiteContent = `Could not retrieve content from ${url}`;
          
          // Extract venue name from domain for basic metadata
          const domainParts = domain.replace('www.', '').split('.');
          const possibleVenueName = domainParts[0]
            .split(/[-_]/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
            
          scrapedData = { 
            metadata: { 
              sourceURL: url,
              possibleVenueName 
            }
          };
        }
      }
    } catch (extractError) {
      console.error(`Firecrawl extract error:`, extractError);
      
      // Try direct fetch as fallback
      try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        
        console.log(`Trying direct fetch as fallback for ${url}`);
        const directResponse = await axios.get(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5"
          },
          timeout: 30000
        });
        
        websiteContent = directResponse.data;
        console.log(`Direct fetch successful, content length: ${websiteContent.length}`);
        
        // Create basic metadata
        scrapedData = { 
          metadata: { 
            sourceURL: url,
            statusCode: directResponse.status,
            title: url.split('/').pop() || domain
          }
        };
      } catch (directError) {
        console.error(`Direct fetch also failed:`, directError);
        
        // Create minimal data from the URL
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        websiteContent = `Could not retrieve content from ${url}`;
        
        // Extract venue name from domain for basic metadata
        const domainParts = domain.replace('www.', '').split('.');
        const possibleVenueName = domainParts[0]
          .split(/[-_]/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
          
        scrapedData = { 
          metadata: { 
            sourceURL: url,
            possibleVenueName 
          }
        };
      }
    }
    
    // Update status to processing
    jobStorage.set(jobId, {
      ...jobStorage.get(jobId)!,
      status: 'processing'
    });
    
    // Step 2: Process with OpenAI
    console.log(`Processing with OpenAI for job ${jobId}`);
    const enrichedData = await processWithOpenAI(url, websiteContent, scrapedData);
    
    // Update job with the result
    jobStorage.set(jobId, {
      ...jobStorage.get(jobId)!,
      status: 'complete',
      result: enrichedData
    });
    
    console.log(`Completed enrichment for job ${jobId}`);
  } catch (error) {
    console.error(`Error processing job ${jobId}:`, error);
    
    // Update job with error
    jobStorage.set(jobId, {
      ...jobStorage.get(jobId)!,
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      error
    });
  }
}

// Process data with OpenAI
async function processWithOpenAI(url: string, content: string, scrapedData: any): Promise<any> {
  try {
    const domain = new URL(url).hostname;
    const business_id = `web_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // If we already have complete data from the extract endpoint
    if (scrapedData && typeof scrapedData === 'object' && Object.keys(scrapedData).length > 0) {
      console.log(`Using data from extract endpoint, enhancing with OpenAI`);
      
      // Quick preprocessing to ensure consistent naming
      const processedData: {
        venue_name: string;
        physical_address: string;
        contact_information: {
          phone: string;
          email: string;
          contact_person: string;
        };
        event_types_hosted: string[];
        venue_capacity: string | number;
        in_house_catering_availability: boolean;
        amenities_offered: string[];
        preferred_caterers: string[];
        venue_description: string;
        lead_score?: number;
        lead_score_reasoning?: string;
        management_contact?: {
          name: string;
          email: string;
          phone: string;
        };
        pricing_information?: string;
      } = {
        venue_name: scrapedData.venueName || scrapedData.venue_name || scrapedData.name || "",
        physical_address: scrapedData.physicalAddress || scrapedData.physical_address || scrapedData.address || scrapedData.location || "",
        contact_information: {
          phone: scrapedData.contactInformation?.phone || scrapedData.contact_information?.phone || scrapedData.phone || "",
          email: scrapedData.contactInformation?.email || scrapedData.contact_information?.email || scrapedData.email || "",
          contact_person: scrapedData.contactInformation?.contactPersonName || scrapedData.contact_information?.contact_person || scrapedData.contactPersonName || ""
        },
        event_types_hosted: scrapedData.eventTypes || scrapedData.event_types_hosted || scrapedData.commonEventTypes || [],
        venue_capacity: scrapedData.venueCapacity || scrapedData.venue_capacity || scrapedData.capacity || "",
        in_house_catering_availability: Boolean(scrapedData.inHouseCatering || scrapedData.in_house_catering_availability || scrapedData.in_house_catering),
        amenities_offered: scrapedData.amenities || scrapedData.amenities_offered || [],
        preferred_caterers: scrapedData.preferredCaterers || scrapedData.preferred_caterers || [],
        venue_description: scrapedData.description || scrapedData.venue_description || "",
        management_contact: scrapedData.managementContact ? {
          name: scrapedData.managementContact.managementContactName || "",
          email: scrapedData.managementContact.managementContactEmail || "",
          phone: scrapedData.managementContact.managementContactPhone || ""
        } : undefined,
        pricing_information: scrapedData.pricingInformation || scrapedData.pricing_information || ""
      };
      
      // Only if we don't have a decent description and have content, use OpenAI to create one
      if ((!processedData.venue_description || processedData.venue_description.length < 50) && content.length > 200) {
        // Prepare the prompt for OpenAI just to generate a description and lead score
        const systemPrompt = `
        You are an expert assistant for catering companies evaluating venues.
        Based on the provided venue information and website content, create:
        1. A concise description of the venue
        2. A lead score (0-100) with reasons explaining the venue's potential as a catering client
        
        Keep your description factual and professional. Focus on details relevant to catering opportunities.
        `;
        
        const userPrompt = `
        Venue: ${processedData.venue_name || domain}
        Website: ${url}
        
        Extracted information:
        ${JSON.stringify(processedData, null, 2)}
        
        Website Content Sample:
        ${content.substring(0, 3000)}
        
        Please provide:
        1. A concise venue description (1-3 sentences)
        2. A lead score (0-100) with 2-3 reasons explaining why this venue is a good/bad lead for catering
        `;
        
        // Call OpenAI API for just description and lead score
        const openaiResponse = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.3,
            max_tokens: 500,
            response_format: { type: "json_object" }
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            }
          }
        );
        
        // Parse the OpenAI response
        try {
          const aiResponse = JSON.parse(openaiResponse.data.choices[0].message.content);
          processedData.venue_description = aiResponse.description || aiResponse.venue_description || processedData.venue_description;
          processedData.lead_score = aiResponse.lead_score || aiResponse.score || 50;
          processedData.lead_score_reasoning = aiResponse.reasoning || aiResponse.lead_score_reasoning || "";
        } catch (e) {
          console.error("Error parsing AI description:", e);
        }
      } else if (!processedData.lead_score) {
        // Calculate a basic lead score based on available data
        let score = 50; // Default score
        let reasons = [];
        
        // Adjust score based on available data
        if (processedData.preferred_caterers && processedData.preferred_caterers.length > 0) {
          score -= 15;
          reasons.push("Has preferred caterers (less likely to need external catering)");
        }
        
        if (processedData.in_house_catering_availability) {
          score -= 25;
          reasons.push("Has in-house catering (less likely to need external catering)");
        } else {
          score += 25;
          reasons.push("No in-house catering identified (more likely to need external catering)");
        }
        
        if (processedData.venue_capacity && 
            (typeof processedData.venue_capacity === 'number' ? processedData.venue_capacity > 100 : 
            parseInt(processedData.venue_capacity) > 100)) {
          score += 10;
          reasons.push("Large venue capacity (good for catering opportunities)");
        }
        
        if (processedData.event_types_hosted && processedData.event_types_hosted.length > 0) {
          score += 10;
          reasons.push("Hosts multiple types of events (diverse catering opportunities)");
        }
        
        // Prioritize venues where we have email contact information
        if (processedData.contact_information.email || 
            (processedData.management_contact && processedData.management_contact.email)) {
          score += 25;
          reasons.push("Email contact information available (enabling direct outreach)");
        } else if (processedData.contact_information.phone) {
          score += 10;
          reasons.push("Phone contact available but no email (requires additional outreach effort)");
        } else {
          score -= 15;
          reasons.push("Missing contact information (difficult to reach out)");
        }
        
        // Cap score between 0-100
        processedData.lead_score = Math.min(100, Math.max(0, score));
        processedData.lead_score_reasoning = reasons.join(". ");
      }
      
      // Generate an AI overview of the venue using the extracted data
      try {
        console.log('Generating AI overview from extracted data');
        const aiPrompt = `
        Create a comprehensive overview of this venue for a catering company lead.
        
        Venue Information:
        - Name: ${processedData.venue_name}
        - Address: ${processedData.physical_address}
        - Contact: Phone: ${processedData.contact_information.phone}, Email: ${processedData.contact_information.email}
        - Event Types: ${processedData.event_types_hosted.join(', ')}
        - Capacity: ${processedData.venue_capacity}
        - In-house Catering: ${processedData.in_house_catering_availability ? 'Yes' : 'No'}
        - Amenities: ${processedData.amenities_offered.join(', ')}
        - Preferred Caterers: ${processedData.preferred_caterers.join(', ')}
        
        Create a concise, fact-based summary (1-3 paragraphs) that highlights:
        1. The venue location and types of events hosted
        2. Catering situation (in-house or external)
        3. Contact information 
        4. Any other key details relevant to a catering company
        
        Write in third person, present tense. Focus on facts, not marketing language.
        `;
        
        const aiOverviewResponse = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: 'You are an AI assistant that creates factual summaries of venue information for catering companies.' },
              { role: 'user', content: aiPrompt }
            ],
            temperature: 0.3,
            max_tokens: 300
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            }
          }
        );
        
        const aiOverview = aiOverviewResponse.data.choices[0].message.content.trim();
        console.log(`Generated AI overview: ${aiOverview.substring(0, 100)}...`);
        
        // When returning the enriched data, also include firecrawl_extracted field with the raw data
        const now = new Date().toISOString();
        return {
          url,
          website: url,
          domain,
          ...processedData,
          business_id,
          aiOverview, // Add the AI overview
          extracted_content: content.length > 500 ? content.substring(0, 500) + '...' : content,
          processed_at: now,
          firecrawl_extracted: scrapedData // Include the raw extracted data for reference
        };
      } catch (aiError) {
        console.error('Error generating AI overview:', aiError);
        
        // Continue without the AI overview if there's an error
        const now = new Date().toISOString();
        return {
          url,
          website: url,
          domain,
          ...processedData,
          business_id,
          extracted_content: content.length > 500 ? content.substring(0, 500) + '...' : content,
          processed_at: now,
          firecrawl_extracted: scrapedData
        };
      }
    }
    
    // If we don't have good data from extract, use OpenAI to process everything
    // Prepare the prompt for OpenAI
    const systemPrompt = `
    You are an expert AI assistant that analyzes venue websites for catering companies.
    Extract key information about the venue and provide a structured analysis.
    
    Extract these details:
    - Venue name
    - Physical address
    - Contact information (phone, email, person)
    - Event types hosted (weddings, corporate, etc.)
    - Venue capacity
    - In-house catering availability
    - Amenities offered
    - Preferred caterers (if any)
    
    Also provide:
    - A brief description of the venue
    - A lead score (0-100) with reasons
    
    DO NOT use placeholder text like "**:" or "Look for this information typically in...".
    If information is unknown, leave that field empty or null rather than using placeholders.
    
    Respond with a JSON object with the following structure:
    {
      "venue_name": "",
      "physical_address": "",
      "contact_information": {
        "phone": "",
        "email": "",
        "contact_person": ""
      },
      "event_types_hosted": [],
      "venue_capacity": "",
      "in_house_catering_availability": "",
      "amenities_offered": [],
      "preferred_caterers": [],
      "venue_description": "",
      "lead_score": 0,
      "lead_score_reasoning": ""
    }
    `;
    
    const userPrompt = `
    URL: ${url}
    Domain: ${domain}
    
    ${scrapedData && Object.keys(scrapedData).length > 0 ? 
    `Extracted data from website:\n${JSON.stringify(scrapedData, null, 2)}\n` : ''}
    
    Website Content:
    ${content.length > 200 ? content : `Content extraction limited. This is a venue website at ${url}`}
    
    Please provide a structured JSON analysis of this venue as a potential catering lead.
    Include only factual information. If specific information is unavailable, leave that field empty.
    `;
    
    // Call OpenAI API
    const openaiResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: "json_object" }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );
    
    // Parse the OpenAI response
    const aiResponse = openaiResponse.data.choices[0].message.content;
    let extractedData = {};
    
    try {
      extractedData = JSON.parse(aiResponse);
    } catch (e) {
      console.error("Error parsing AI response:", e);
      extractedData = { error: "Failed to parse AI response" };
    }
    
    // Return the enriched data with combined data
    const now = new Date().toISOString();
    return {
      url,
      website: url,
      domain,
      ...extractedData,
      business_id,
      extracted_content: content.length > 500 ? content.substring(0, 500) + '...' : content,
      processed_at: now
    };
  } catch (error) {
    console.error('Error processing with OpenAI:', error);
    throw error;
  }
}

// Export jobStorage for status endpoint
export { jobStorage };

export async function GET(request: Request) {
  // Get URL from query parameters
  const url = new URL(request.url);
  const testUrl = url.searchParams.get('url') || 'https://www.example.com';
  
  try {
    // Run a test on Firecrawl API
    const testResult = await testFirecrawlConnection(testUrl);
    return NextResponse.json(testResult);
  } catch (error) {
    console.error('Error testing Firecrawl:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        url: testUrl
      },
      { status: 500 }
    );
  }
} 