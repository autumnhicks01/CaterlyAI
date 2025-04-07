import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { workflowManager } from '@/lib/workflowManager';

/**
 * GET handler for business search API
 * 
 * This endpoint searches for potential leads using the business search workflow
 */
export async function GET(req: NextRequest) {
  // Authenticate the user session
  const session = await auth();
  
  if (!session || !session.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }
  
  // Get query parameters
  const searchParams = req.nextUrl.searchParams;
  const query = searchParams.get('query');
  const location = searchParams.get('location');
  const radius = searchParams.has('radius') 
    ? Number(searchParams.get('radius'))
    : 25; // Default radius of 25km
  
  // Validate required parameters
  if (!query) {
    return NextResponse.json(
      { error: "Missing required parameter: query" },
      { status: 400 }
    );
  }
  
  if (!location) {
    return NextResponse.json(
      { error: "Missing required parameter: location" },
      { status: 400 }
    );
  }
  
  try {
    // Execute the business search workflow
    const result = await workflowManager.executeWorkflow('business-search', {
      query,
      location,
      radius
    });
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Workflow execution failed" },
        { status: 500 }
      );
    }
    
    // Check if we found any businesses
    const data = result.data as any;
    
    if (!data || !data.businesses || data.businesses.length === 0) {
      return NextResponse.json(
        { message: "No matching businesses found", results: [] },
        { status: 200 }
      );
    }
    
    // Return the search results
    return NextResponse.json({
      message: `Found ${data.count} businesses matching your search`,
      results: data.businesses,
      query: data.query,
      location: data.location,
      count: data.count,
      runId: result.runId
    });
    
  } catch (error) {
    console.error("Error in business search API:", error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error occurred" },
      { status: 500 }
    );
  }
} 