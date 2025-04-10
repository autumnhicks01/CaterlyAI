// URL Enrichment Test Module
// This module provides a simple interface for testing the enrichment process with a URL

import { EnrichmentJob, EnrichmentResult } from './types';

/**
 * Process a URL through the enrichment pipeline
 * 
 * @param url The venue website URL to process
 * @returns A promise that resolves with the enrichment job information
 */
export async function processUrl(url: string): Promise<{ jobId: string }> {
  console.log(`Starting URL processing for: ${url}`);
  
  try {
    const response = await fetch("/api/tests/enrich-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      let errorMessage = `API error (${response.status})`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        // If we can't parse the error as JSON, just use the status text
        errorMessage = `API error: ${response.statusText || response.status}`;
      }
      console.error(`Failed to process URL: ${errorMessage}`);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log(`Successfully created job: ${data.jobId}`);
    return data;
  } catch (error) {
    console.error("Error in processUrl:", error);
    throw error; // Re-throw to let caller handle it
  }
}

/**
 * Get the current status of an enrichment job
 * 
 * @param jobId The ID of the job to check
 * @returns A promise that resolves with the job status
 */
export async function getJobStatus(jobId: string): Promise<EnrichmentJob> {
  console.log(`Checking status for job: ${jobId}`);
  
  try {
    const response = await fetch(`/api/tests/enrich-status/${jobId}`);
    
    if (!response.ok) {
      console.error(`Status check failed: ${response.status} ${response.statusText}`);
      const responseText = await response.text();
      console.error(`Response body: ${responseText}`);
      throw new Error(`Failed to get status update: ${response.statusText || response.status}`);
    }
    
    const data = await response.json();
    console.log(`Job ${jobId} status: ${data.status}`);
    return data;
  } catch (error) {
    console.error(`Error checking job status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

/**
 * Poll for job completion
 * 
 * @param jobId The ID of the job to poll
 * @param onStatusUpdate Optional callback for status updates
 * @returns A promise that resolves with the enrichment result
 */
export async function waitForCompletion(
  jobId: string, 
  onStatusUpdate?: (status: string, progress: number) => void
): Promise<EnrichmentResult> {
  console.log(`Starting to poll for job completion: ${jobId}`);
  
  return new Promise((resolve, reject) => {
    const checkStatus = async () => {
      try {
        const data = await getJobStatus(jobId);
        
        // Call status update callback if provided
        if (onStatusUpdate) {
          const progress = getProgressFromStatus(data.status);
          onStatusUpdate(data.status, progress);
          console.log(`Updated status: ${data.status} (${progress}%)`);
        }
        
        if (data.status === "error") {
          console.error(`Job ${jobId} failed: ${data.message || 'Unknown error'}`);
          reject(new Error(data.message || "Processing failed"));
          return;
        }
        
        if (data.status === "complete") {
          console.log(`Job ${jobId} completed successfully`);
          resolve(data.result);
          return;
        }
        
        // Check again in 2 seconds
        console.log(`Job ${jobId} still processing, will check again in 2 seconds...`);
        setTimeout(checkStatus, 2000);
      } catch (error) {
        console.error(`Error in polling loop: ${error instanceof Error ? error.message : 'Unknown error'}`);
        reject(error);
      }
    };
    
    // Start checking
    checkStatus();
  });
}

/**
 * Helper to convert status to progress percentage
 */
export function getProgressFromStatus(status: string): number {
  const stageMap: Record<string, number> = {
    "validating": 10,
    "extracting": 30,
    "processing": 70,
    "generating": 90,
    "complete": 100,
    "error": 0
  };
  
  return stageMap[status] || 0;
} 