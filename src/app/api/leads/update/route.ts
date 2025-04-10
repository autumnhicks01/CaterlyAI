import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { safeEnrichmentData, updateLeadWithEnrichment } from '../api-utils';

/**
 * POST handler for lead updates
 * 
 * This endpoint updates a lead with enrichment data
 */
export async function POST(req: NextRequest) {
  console.log('[API:UPDATE] Lead update API route called');
  
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
    console.log(`[API:UPDATE] Request body keys: ${Object.keys(body).join(', ')}`);
    
    // Check if required data is provided
    const { leadId, enrichment_data } = body;
    
    if (!leadId) {
      console.warn('[API:UPDATE] No lead ID provided in request');
      return NextResponse.json({ 
        message: 'No lead ID provided', 
        success: false
      }, { status: 400 });
    }
    
    if (!enrichment_data) {
      console.warn('[API:UPDATE] No enrichment data provided for lead:', leadId);
      return NextResponse.json({ 
        message: 'No enrichment data provided', 
        success: false
      }, { status: 400 });
    }
    
    console.log(`[API:UPDATE] Updating lead ${leadId} with enrichment data`);
    
    // Update the lead with enrichment data
    const updateResult = await updateLeadWithEnrichment(leadId, enrichment_data, body);
      
    if (!updateResult.success) {
      console.error('[API:UPDATE] Error updating lead:', updateResult.error);
      return NextResponse.json(
        { error: updateResult.error, success: false },
        { status: 500 }
      );
    }
    
    console.log(`[API:UPDATE] Successfully updated lead ${leadId}`);
    
    // Return the updated lead
    return NextResponse.json({
      message: 'Lead updated successfully',
      lead: updateResult.data?.[0] || null,
      success: true
    });
    
  } catch (error) {
    console.error('[API:UPDATE] Error processing update request:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Unknown error occurred",
        success: false
      },
      { status: 500 }
    );
  }
} 