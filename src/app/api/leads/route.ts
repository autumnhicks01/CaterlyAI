import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { workflowManager } from '@/lib/workflows';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('query') || '';
    const location = searchParams.get('location') || '';
    const radius = parseInt(searchParams.get('radius') || '25', 10);
    
    if (!query || !location) {
      return NextResponse.json(
        { error: 'Query and location are required parameters' },
        { status: 400 }
      );
    }
    
    console.log(`Searching for businesses: "${query}" in ${location}`);
    
    // Execute the business search workflow
    const result = await workflowManager.executeWorkflow('business-search', {
      query,
      location,
      radius
    });
    
    if (!result.success) {
      console.error('Business search workflow failed:', result.error);
      return NextResponse.json(
        { 
          error: 'Failed to search for businesses',
          details: result.error?.message
        },
        { status: 500 }
      );
    }
    
    // Get the results from the enhance businesses step
    const searchResults = result.stepResults.get('enhance-businesses')?.data;
    
    if (!searchResults) {
      return NextResponse.json(
        { error: 'Workflow completed but no search results available' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(searchResults);
  } catch (error) {
    console.error('Business search error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 