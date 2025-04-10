import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { fetchLeadsById } from '../../api-utils';
import { processBatchEnrichment } from '../utils';

export const maxDuration = 300; // 5 minutes

/**
 * POST handler for batch lead enrichment
 */
export async function POST(req: NextRequest) {
  console.log('[API:BATCH-ENRICH] Batch enrichment API route called');
  
  // Authenticate the user session
  const session = await auth();
  
  if (!session || !session.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }
  
  try {
    const body = await req.json();
    const leadIds = body.leadIds || [];
    
    if (leadIds.length === 0) {
      return NextResponse.json({ 
        message: 'No leads to enrich', 
        success: false
      }, { status: 400 });
    }
    
    console.log(`[API:BATCH-ENRICH] Processing ${leadIds.length} leads`);
    
    // Fetch the leads from the database
    const { data: leads, error: fetchError } = await fetchLeadsById(leadIds);
      
    if (fetchError || !leads) {
      return NextResponse.json(
        { error: fetchError instanceof Error ? fetchError.message : "Failed to fetch leads" },
        { status: 500 }
      );
    }
    
    // Process the batch of leads
    const result = await processBatchEnrichment(leads);
    
    return NextResponse.json({
      success: result.success,
      message: `Batch processing complete. Processed: ${result.processed}, Succeeded: ${result.succeeded}, Failed: ${result.failed}, Emails found: ${result.emailsFound}`,
      results: {
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
        emailsFound: result.emailsFound
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
      enrichedLeads: result.enrichedLeads
    });
  } catch (error) {
    console.error('[API:BATCH-ENRICH] Unexpected error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "An unexpected error occurred", 
        success: false 
      },
      { status: 500 }
    );
  }
} 