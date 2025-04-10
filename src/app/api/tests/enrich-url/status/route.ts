import { NextResponse } from 'next/server';
import { jobStorage } from '../route';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const jobId = url.searchParams.get('jobId');
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }
    
    // Get job from storage
    const job = jobStorage.get(jobId);
    
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }
    
    // Return job status and data if available
    return NextResponse.json({
      jobId,
      status: job.status,
      startedAt: job.startedAt,
      message: job.message,
      result: job.status === 'complete' ? job.result : undefined,
      error: job.status === 'error' ? job.error : undefined
    });
  } catch (error) {
    console.error('Error checking job status:', error);
    return NextResponse.json(
      { error: 'Failed to check job status' },
      { status: 500 }
    );
  }
} 