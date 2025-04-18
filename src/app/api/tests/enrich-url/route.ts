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
    console.log('[TEST] Starting URL enrichment process...');
    
    // Parse the request body
    const reqBody = await request.json();
    const { url } = reqBody;
    
    // Check for required API key
    if (!process.env.FIRECRAWL_API_KEY) {
      return NextResponse.json({ error: 'API configuration error (Firecrawl API key missing)' }, { status: 500 });
    }
    
    // Validate the URL
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }
    
    // Create a unique job ID
    const jobId = uuidv4();
    console.log(`[TEST] Creating new job ${jobId} for URL: ${url}`);
    
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
    console.error('[TEST] Error starting enrichment:', error);
    return NextResponse.json(
      { error: 'Failed to start enrichment process' },
      { status: 500 }
    );
  }
}

// Function to process the URL in the background
async function startEnrichmentProcess(jobId: string, url: string) {
  try {
    console.log(`[TEST] Starting enrichment process for job ${jobId}`);
    
    // Update status to extracting
    jobStorage.set(jobId, {
      ...jobStorage.get(jobId)!,
      status: 'extracting'
    });
    
    // Step 1: Use Firecrawl to extract data from the URL
    let extractedData = null;
    
    try {
      const apiKey = process.env.FIRECRAWL_API_KEY;
      
      // Create a detailed prompt for extraction
      const extractPrompt = `
      Extract comprehensive venue information from this website.
      
      Focus on finding information that would be relevant for a catering business:
      
      1. Email addresses (check contact pages, forms, footer)
      2. Phone numbers
      3. Physical address
      4. Venue name
      5. Types of events hosted
      6. Venue capacity
      7. In-house catering availability
      8. Venue description
      
      Also, provide a lead score from 0-100 indicating how promising this venue is for a catering company.
      `;

      console.log(`[TEST] Calling Firecrawl extract API for ${url}`);
      const extractResponse = await axios.post(
        'https://api.firecrawl.dev/v1/extract',
        { 
          urls: [url],
          prompt: extractPrompt,
          enableWebSearch: true
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 60000 // Increase timeout to 60 seconds
        }
      );
      
      console.log(`[TEST] Extract API response status: ${extractResponse.status}`);
      console.log(`[TEST] Extract API response data:`, JSON.stringify(extractResponse.data, null, 2));
      
      // Check if we got data directly or need to poll for job completion
      if (extractResponse.data?.success === true && extractResponse.data.data) {
        console.log(`[TEST] Extraction successful with direct data`);
        extractedData = extractResponse.data.data;
      } else if (extractResponse.data?.status === "processing" || extractResponse.data?.jobId || extractResponse.data?.job_id) {
        // Need to poll for completion
        console.log(`[TEST] Extract API returned processing status, need to poll`);
        const jobIdFromResponse = extractResponse.data.jobId || extractResponse.data.job_id;
        if (jobIdFromResponse) {
          extractedData = await pollExtractionJob(jobIdFromResponse, apiKey!);
        } else {
          console.error(`[TEST] No job ID was returned for polling`);
          throw new Error("Extract API processing but no job ID returned");
        }
      } else {
        console.error(`[TEST] Extract API failed to return usable data:`, JSON.stringify(extractResponse.data));
        throw new Error("Extract API did not return valid data or a job ID");
      }
      
    } catch (extractError) {
      console.error(`[TEST] Extraction error:`, extractError);
      throw new Error(`Failed to extract data from URL: ${extractError instanceof Error ? extractError.message : 'Unknown error'}`);
    }
    
    // Format the final result and add AI overview if needed
    const finalResult = await formatResult(url, extractedData);
    
    // Update job with the result
    jobStorage.set(jobId, {
      ...jobStorage.get(jobId)!,
      status: 'complete',
      result: finalResult
    });
    
    console.log(`[TEST] Job ${jobId} completed successfully`);
    
  } catch (error) {
    console.error(`[TEST] Error in enrichment process for job ${jobId}:`, error);
    
    // Update job with the error
    jobStorage.set(jobId, {
      ...jobStorage.get(jobId)!,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'An error occurred during the enrichment process'
    });
  }
}

// Helper function to poll for job completion
async function pollExtractionJob(jobId: string, apiKey: string): Promise<any> {
  console.log(`[TEST] Starting polling for job ${jobId}`);
  let retries = 0;
  const maxRetries = 15; // Increase poll time to 3 minutes (15 * 12s)
  
  while (retries < maxRetries) {
    retries++;
    try {
      console.log(`[TEST] Checking status, attempt ${retries}/${maxRetries}`);
      const statusResponse = await axios.get(
        `https://api.firecrawl.dev/v1/extract/${jobId}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 10000
        }
      );
      
      console.log(`[TEST] Poll response status: ${statusResponse.status}`);
      console.log(`[TEST] Poll response data:`, JSON.stringify(statusResponse.data, null, 2));
      
      if (statusResponse.data.status === "completed" && statusResponse.data.data) {
        console.log(`[TEST] Extraction completed for job ${jobId}`);
        return statusResponse.data.data;
      } else if (statusResponse.data.status === "failed" || statusResponse.data.status === "error") {
        throw new Error(`Firecrawl extraction job failed: ${statusResponse.data.message || 'Unknown error'}`);
      } else {
        console.log(`[TEST] Extraction in progress: ${statusResponse.data.status}, retrying in 12s...`);
        await new Promise(resolve => setTimeout(resolve, 12000));
      }
    } catch (statusError) {
      console.error(`[TEST] Error checking job status:`, statusError);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  throw new Error(`Extraction timed out after ${maxRetries} retries`);
}

// Add AI overview and scoring with OpenAI if needed
async function enhanceWithAI(url: string, extractedData: any): Promise<any> {
  try {
    console.log(`[TEST] Enhancing data with OpenAI for ${url}`);
    
    const domain = new URL(url).hostname;
    
    // Create a prompt for AI analysis
    const prompt = `
    Please analyze this venue as a potential catering lead and provide:
    1. A concise description of the venue (2-4 sentences)
    2. A lead score from 0-100
    3. 1-2 specific reasons for your score
    
    Venue Website: ${url}
    Domain: ${domain}
    
    Extracted Information:
    ${JSON.stringify(extractedData, null, 2)}
    
    Format your response as a JSON object with these fields:
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
            content: 'You are an expert assistant for catering companies evaluating venue websites.'
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
      console.log(`[TEST] Successfully generated AI overview and scoring`);
      return aiResponse;
    } catch (e) {
      console.error(`[TEST] Error parsing OpenAI response:`, e);
      return {
        venue_description: `${extractedData.venue_name || domain} is a venue that may host events.`,
        lead_score: 50,
        lead_score_reasoning: "Based on limited available information."
      };
    }
  } catch (error) {
    console.error(`[TEST] Error generating AI overview:`, error);
    return null;
  }
}

// Format the result for the frontend
async function formatResult(url: string, extractedData: any): Promise<any> {
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
    eventManagerEmail: "",
    eventManagerPhone: "",
    commonEventTypes: [],
    leadScore: {
      score: 0,
      potential: "unknown",
      reasons: ["No data extracted"],
      lastCalculated: new Date().toISOString()
    },
    extracted_data: null, // Add the raw extracted data for debugging
    processed_at: new Date().toISOString()
  };

  // If no data was extracted, return default
  if (!extractedData) {
    console.error(`[TEST] No data was extracted from ${url}`);
    return defaultResult;
  }
  
  console.log(`[TEST] Successfully extracted data:`, JSON.stringify(extractedData, null, 2));
  
  // Use OpenAI to enhance the data if needed
  let enhancedData = extractedData;
  
  try {
    if (!extractedData.venue_description || !extractedData.lead_score) {
      console.log(`[TEST] Enhancing data with OpenAI for ${url}`);
      
      // This part remains unchanged - AI enhancement if needed
      const aiEnhancement = await enhanceWithAI(url, extractedData);
      if (aiEnhancement) {
        enhancedData = {
          ...extractedData,
          venue_description: aiEnhancement.venue_description || extractedData.venue_description,
          lead_score: aiEnhancement.lead_score || extractedData.lead_score || 0,
          lead_score_reasoning: aiEnhancement.lead_score_reasoning || extractedData.lead_score_reasoning
        };
      }
    }
  } catch (error) {
    console.error(`[TEST] Error enhancing with AI:`, error);
    // Continue with what we have
  }

  // Map extracted data to our result format
  const result = {
    ...defaultResult,
    venueName: enhancedData.venue_name || enhancedData.name || "",
    address: enhancedData.physical_address || enhancedData.address || "",
    aiOverview: enhancedData.venue_description || enhancedData.description || "",
    venueCapacity: enhancedData.venue_capacity || enhancedData.capacity || "",
    inHouseCatering: enhancedData.in_house_catering_availability === "Yes" || false,
    eventManagerEmail: enhancedData.email || 
                     (enhancedData.contact_information?.email) || "",
    eventManagerPhone: enhancedData.phone || 
                     (enhancedData.contact_information?.phone) || "",
    commonEventTypes: enhancedData.event_types_hosted || [],
    extracted_data: enhancedData, // Include the full extracted data for debugging
    leadScore: {
      score: enhancedData.lead_score || 0,
      potential: getLeadPotential(enhancedData.lead_score),
      reasons: enhancedData.lead_score_reasoning ? [enhancedData.lead_score_reasoning] : ["No specific reasons provided"],
      lastCalculated: new Date().toISOString()
    },
    processed_at: new Date().toISOString()
  };

  return result;
}

// Helper function to determine lead potential based on score
function getLeadPotential(score: number | undefined | null): string {
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
    console.error('[TEST] Error getting job status:', error);
    return NextResponse.json(
      { error: 'Failed to get job status' },
      { status: 500 }
    );
  }
} 