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

export async function POST(request: Request) {
  try {
    console.log('[ENRICHMENT] Starting URL enrichment process...');
    
    // Parse the request body
    const reqBody = await request.json();
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
    console.log(`[ENRICHMENT] Creating new job ${jobId} for URL: ${url}`);
    
    // Store the job in memory
    jobStorage.set(jobId, {
      url,
      status: 'processing',
      startedAt: new Date()
    });
    
    // Start the enrichment process in the background
    startEnrichmentProcess(jobId, url);
    
    // Return the job ID
    return NextResponse.json({ jobId });
  } catch (error) {
    console.error('[ENRICHMENT] Error starting enrichment:', error);
    return NextResponse.json(
      { error: 'Failed to start enrichment process' },
      { status: 500 }
    );
  }
}

// Function to process the URL in the background
async function startEnrichmentProcess(jobId: string, url: string) {
  try {
    console.log(`[ENRICHMENT] Starting enrichment process for job ${jobId}`);
    
    // Update status to extracting
    jobStorage.set(jobId, {
      ...jobStorage.get(jobId)!,
      status: 'extracting'
    });
    
    // Step 1: Use Firecrawl to extract data from the URL
    let extractedData = null;
    
    try {
      const apiKey = process.env.FIRECRAWL_API_KEY;
      
      // Create a detailed prompt for extraction that targets the data we need
      const extractPrompt = `
      Extract comprehensive venue information from this website.
      
      MOST IMPORTANT: Search thoroughly for email addresses and contact information!
      
      Extract the following information about this venue:
      1. Venue name
      2. Physical address
      3. Email addresses (search ALL pages, especially contact forms and footers)
      4. Phone numbers
      5. Types of events hosted
      6. Venue capacity
      7. In-house catering availability
      8. Venue description
      9. Amenities
      10. Preferred caterers list (if any)
      
      Also, provide a lead score from 0-100 indicating how promising this venue is for a catering company,
      with venues allowing external catering scoring higher than venues with mandatory in-house catering.
      Provide 1-2 sentences explaining your scoring reasoning.
      `;

      console.log(`[ENRICHMENT] Calling Firecrawl extract API for ${url}`);
      const extractResponse = await axios.post(
        'https://api.firecrawl.dev/v1/extract',
        { 
          urls: [url],
          prompt: extractPrompt,
          enableWebSearch: true,
          wait: 20000
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 60000 // Increase timeout to 60 seconds for large sites
        }
      );
      
      console.log(`[ENRICHMENT] Extract API response status: ${extractResponse.status}`);
      console.log(`[ENRICHMENT] Extract API response data:`, JSON.stringify(extractResponse.data, null, 2));
      
      // Check if we got data or if we need to poll
      if (extractResponse.data?.success === true && extractResponse.data.data) {
        console.log(`[ENRICHMENT] Extraction successful with direct data`);
        extractedData = extractResponse.data.data;
      } else if (extractResponse.data?.status === "processing" || extractResponse.data?.jobId || extractResponse.data?.job_id) {
        // Poll for job completion
        const extractionJobId = extractResponse.data.jobId || extractResponse.data.job_id;
        console.log(`[ENRICHMENT] Got job ID for polling: ${extractionJobId}`);
        if (extractionJobId) {
          extractedData = await pollExtractionJob(extractionJobId, apiKey!);
        } else {
          console.error(`[ENRICHMENT] No job ID was returned for polling`);
          throw new Error("Extract API processing but no job ID returned");
        }
      } else {
        console.error(`[ENRICHMENT] Extract API failed to return usable data:`, JSON.stringify(extractResponse.data));
        throw new Error("Extract API did not return valid data or a job ID");
      }
      
    } catch (extractError) {
      console.error(`[ENRICHMENT] Extraction error:`, extractError);
      throw new Error(`Failed to extract data from URL: ${extractError instanceof Error ? extractError.message : 'Unknown error'}`);
    }
    
    // Step 2: Process with OpenAI for overview and scoring if needed
    let enhancedData = extractedData || {};
    
    if (extractedData) {
      // Add AI overview if missing
      if (!extractedData.venue_description) {
        try {
          const overviewResponse = await generateAIOverview(url, extractedData);
          enhancedData = {
            ...enhancedData,
            venue_description: overviewResponse.venue_description,
            lead_score: overviewResponse.lead_score || enhancedData.lead_score,
            lead_score_reasoning: overviewResponse.lead_score_reasoning || enhancedData.lead_score_reasoning
          };
        } catch (aiError) {
          console.error(`[ENRICHMENT] OpenAI processing error:`, aiError);
          // Continue with what we have from Firecrawl
        }
      }
    }
    
    // Format the final result
    const finalResult = formatResult(url, enhancedData);
    
    // Update job with the result
    jobStorage.set(jobId, {
      ...jobStorage.get(jobId)!,
      status: 'complete',
      result: finalResult
    });
    
    console.log(`[ENRICHMENT] Job ${jobId} completed successfully`);
    
  } catch (error) {
    console.error(`[ENRICHMENT] Error in enrichment process for job ${jobId}:`, error);
    
    jobStorage.set(jobId, {
      ...jobStorage.get(jobId)!,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'An error occurred during the enrichment process'
    });
  }
}

// Helper function to poll for extraction job completion
async function pollExtractionJob(jobId: string, apiKey: string): Promise<any> {
  console.log(`[ENRICHMENT] Starting polling for job ${jobId}`);
  let extractionComplete = false;
  let retries = 0;
  const maxRetries = 15; // Poll for up to ~3 minutes (15 * 12s)
  
  while (!extractionComplete && retries < maxRetries) {
    retries++;
    try {
      console.log(`[ENRICHMENT] Checking status for job ${jobId}, attempt ${retries}/${maxRetries}`);
      const statusResponse = await axios.get(
        `https://api.firecrawl.dev/v1/extract/${jobId}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 10000
        }
      );
      
      console.log(`[ENRICHMENT] Poll response status: ${statusResponse.status}`);
      console.log(`[ENRICHMENT] Poll response data:`, JSON.stringify(statusResponse.data, null, 2));
      
      if (statusResponse.data.status === "completed" && statusResponse.data.data) {
        console.log(`[ENRICHMENT] Extraction completed for job ${jobId}`);
        return statusResponse.data.data;
      } else if (statusResponse.data.status === "failed" || statusResponse.data.status === "error") {
        throw new Error(`Firecrawl extraction job failed: ${statusResponse.data.message || 'Unknown error'}`);
      } else {
        console.log(`[ENRICHMENT] Extraction in progress: ${statusResponse.data.status}, retrying in 12s...`);
        await new Promise(resolve => setTimeout(resolve, 12000));
      }
    } catch (statusError) {
      console.error(`[ENRICHMENT] Error checking job status:`, statusError);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  throw new Error(`Extraction timed out after ${maxRetries} retries`);
}

// Generate AI overview and scoring from OpenAI
async function generateAIOverview(url: string, extractedData: any): Promise<any> {
  try {
    console.log(`[ENRICHMENT] Generating AI overview for ${url}`);
    
    const domain = new URL(url).hostname;
    
    // Create a prompt for overview and scoring
    const prompt = `
    Please analyze this venue as a potential catering lead and provide:
    1. A concise description of the venue (2-4 sentences)
    2. A lead score from 0-100
    3. 1-2 specific reasons for your score
    
    Venue Website: ${url}
    Domain: ${domain}
    
    Extracted Information:
    ${JSON.stringify(extractedData, null, 2)}
    
    Format your response ONLY as a JSON with these three fields:
    {
      "venue_description": "Your venue description here",
      "lead_score": number (0-100),
      "lead_score_reasoning": "Your specific reasons here"
    }
    `;
    
    // Call OpenAI API
    const openaiResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert assistant for catering companies evaluating venue websites. FORMAT YOUR RESPONSE ONLY AS JSON.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 300,
        response_format: { type: "json_object" }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );
    
    try {
      const aiResponse = JSON.parse(openaiResponse.data.choices[0].message.content);
      console.log(`[ENRICHMENT] Successfully generated AI overview and scoring`);
      return aiResponse;
    } catch (e) {
      console.error(`[ENRICHMENT] Error parsing OpenAI response:`, e);
      return {
        venue_description: `${extractedData.venue_name || domain} is a venue that may host events.`,
        lead_score: 50,
        lead_score_reasoning: "Based on limited available information."
      };
    }
  } catch (error) {
    console.error(`[ENRICHMENT] Error generating AI overview:`, error);
    throw error;
  }
}

// Format the result for the frontend
function formatResult(url: string, extractedData: any): any {
  const domain = new URL(url).hostname;
  const defaultResult = {
    url: url,
    domain: domain,
    venueName: "",
    address: "",
    website: url,
    aiOverview: "",
    venueCapacity: "",
    inHouseCatering: false,
    eventManagerName: "",
    eventManagerEmail: "",
    eventManagerPhone: "",
    commonEventTypes: [],
    amenities: [],
    preferredCaterers: [],
    leadScore: {
      score: 0,
      potential: "unknown",
      reasons: ["No data extracted"],
      lastCalculated: new Date().toISOString()
    },
    extracted_data: extractedData, // Include raw data for debugging
    processed_at: new Date().toISOString()
  };

  // If no data was extracted, return default
  if (!extractedData) {
    console.error(`[ENRICHMENT] No data was extracted from ${url}`);
    return defaultResult;
  }
  
  console.log(`[ENRICHMENT] Successfully extracted data:`, JSON.stringify(extractedData, null, 2));

  // Map extracted data to our result format
  const result = {
    ...defaultResult,
    venueName: extractedData.venue_name || extractedData.name || "",
    address: extractedData.physical_address || extractedData.address || "",
    aiOverview: extractedData.venue_description || extractedData.description || "",
    venueCapacity: extractedData.venue_capacity || extractedData.capacity || "",
    inHouseCatering: extractedData.in_house_catering_availability === "Yes" || extractedData.inHouseCatering === true || false,
    eventManagerName: extractedData.contact_person || extractedData.contactPersonName || 
                     (extractedData.contact_information?.contact_person) || "",
    eventManagerEmail: extractedData.email || 
                      (extractedData.contact_information?.email) || "",
    eventManagerPhone: extractedData.phone || 
                      (extractedData.contact_information?.phone) || "",
    commonEventTypes: extractedData.event_types_hosted || extractedData.eventTypes || [],
    amenities: extractedData.amenities_offered || extractedData.amenities || [],
    preferredCaterers: extractedData.preferred_caterers || extractedData.preferredCaterers || [],
    extracted_data: extractedData, // Include raw data for debugging
    leadScore: {
      score: extractedData.lead_score || 0,
      potential: getLeadPotential(extractedData.lead_score),
      reasons: extractedData.lead_score_reasoning ? [extractedData.lead_score_reasoning] : ["No specific reasons provided"],
      lastCalculated: new Date().toISOString()
    },
    processed_at: new Date().toISOString()
  };

  return result;
}

// Helper function to determine lead potential based on score
function getLeadPotential(score: number | undefined | null): 'high' | 'medium' | 'low' | 'unknown' {
  if (score === undefined || score === null) return 'unknown';
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export async function GET(request: Request) {
  try {
    // Get job ID from query parameters
    const url = new URL(request.url);
    const jobId = url.searchParams.get('jobId');
    
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }
    
    // Get job from storage
    const job = jobStorage.get(jobId);
    
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    
    // Return job details
    return NextResponse.json({
      jobId,
      status: job.status,
      result: job.result,
      message: job.message,
      error: job.error,
      startedAt: job.startedAt
    });
  } catch (error) {
    console.error('[ENRICHMENT] Error getting job status:', error);
    return NextResponse.json(
      { error: 'Failed to get job status' },
      { status: 500 }
    );
  }
} 