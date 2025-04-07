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
  
  // Validate location is in the expected coordinate format (lat,lng)
  const coordinateRegex = /^(-?\d+(\.\d+)?),(-?\d+(\.\d+)?)$/;
  if (!coordinateRegex.test(location)) {
    return NextResponse.json(
      { error: "Location must be in coordinate format (lat,lng)" },
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
    console.log("Workflow result data:", data);
    
    // Extract businesses from the correct path in the result data
    const businesses = data?.output?.businesses || data?.businesses || [];
    console.log(`Extracted ${businesses.length} businesses from workflow result`);
    
    if (!businesses || businesses.length === 0) {
      console.log("No businesses found in workflow result");
      return NextResponse.json(
        { message: "No matching businesses found", results: [] },
        { status: 200 }
      );
    }
    
    console.log(`Found ${businesses.length} businesses to return`);
    
    // Return the search results with businesses in both fields for compatibility
    const responseObj = {
      message: `Found ${businesses.length} businesses matching your search`,
      results: businesses,
      businesses: businesses, // Include in both fields
      query: data?.output?.query || data?.query || query,
      location: data?.output?.location || data?.location || location,
      count: businesses.length,
      runId: result.runId
    };
    
    console.log("Sending API response with businesses");
    return NextResponse.json(responseObj);
    
  } catch (error) {
    console.error("Error in business search API:", error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error occurred" },
      { status: 500 }
    );
  }
} 