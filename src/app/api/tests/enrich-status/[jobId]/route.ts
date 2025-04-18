import { NextResponse } from 'next/server';

// Define updated global object types
declare global {
  var jobStorage: Map<string, {
    url: string;
    status: string;
    result?: any;
    message?: string;
    startedAt: Date;
    error?: any;
  }>;
  var firecrawlCalls: {
    url: string;
    timestamp: Date;
    success: boolean;
    error?: any;
  }[];
}

export async function GET(
  request: Request,
  { params }: { params: { jobId: string } }
) {
  try {
    // Ensure we properly destructure the params
    const { jobId } = params;
    console.log(`Received status request for job: ${jobId}`);
    
    // Check if global job storage exists
    if (!global.jobStorage) {
      console.log(`No job storage found, job ${jobId} not found`);
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }
    
    // Get job data
    const jobData = global.jobStorage.get(jobId);
    console.log(`Retrieved job data for ${jobId}: ${jobData ? 'found' : 'not found'}`);
    
    if (!jobData) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }
    
    // Calculate progress percentage based on status
    let progress = 0;
    switch (jobData.status) {
      case 'validating':
        progress = 5;
        break;
      case 'extracting':
        progress = 20;
        break;
      case 'processing':
        progress = 50;
        break;
      case 'generating':
        progress = 80;
        break;
      case 'complete':
        progress = 100;
        break;
      case 'error':
        progress = 0;
        break;
      default:
        progress = 0;
    }
    
    // Calculate elapsed time
    const elapsedMs = Date.now() - jobData.startedAt.getTime();
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    
    // Calculate estimated time remaining (rough estimate)
    // Only relevant if not complete or error
    let estimatedRemainingSeconds = null;
    if (jobData.status !== 'complete' && jobData.status !== 'error' && progress > 0) {
      // Assuming linear progress, estimate remaining time
      const totalEstimatedSeconds = (elapsedSeconds / progress) * 100;
      estimatedRemainingSeconds = Math.max(1, Math.floor(totalEstimatedSeconds - elapsedSeconds));
    }
    
    // Get Firecrawl call info for this job
    let firecrawlInfo = null;
    if (global.firecrawlCalls) {
      firecrawlInfo = global.firecrawlCalls.find(call => call.url === jobData.url);
    }
    
    // Return complete status information
    console.log(`Returning complete status for job ${jobId}`);
    return NextResponse.json({
      jobId,
      status: jobData.status,
      progress,
      elapsedMs,
      elapsedSeconds,
      startedAt: jobData.startedAt,
      message: jobData.message,
      result: jobData.status === 'complete' ? jobData.result : undefined,
      error: jobData.status === 'error' ? jobData.error : undefined,
      firecrawlInfo
    });
  } catch (error) {
    console.error(`Error checking job status:`, error);
    return NextResponse.json(
      { error: 'Failed to check job status' },
      { status: 500 }
    );
  }
} 