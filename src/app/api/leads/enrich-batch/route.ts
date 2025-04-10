import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@/utils/supabase/server';
import { normalizeUrl, extractWebContent, enrichLead } from '../api-utils';

export const maxDuration = 300; // 5 minutes (maximum allowed for Vercel Pro plan)

/**
 * POST handler for batch lead enrichment
 * 
 * This endpoint processes a batch of leads, extracting website content
 * and enriching them, then saves the results to the database.
 */
export async function POST(req: NextRequest) {
  console.log('[API:ENRICH-BATCH] Batch lead enrichment API route called');
  
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
    const leads = body.leads || [];
    console.log(`[API:ENRICH-BATCH] Received ${leads.length} leads to enrich`);
    
    if (leads.length === 0) {
      console.warn('[API:ENRICH-BATCH] No leads provided in request');
      return NextResponse.json({ 
        message: 'No leads to enrich', 
        success: false,
        leads: []
      }, { status: 400 });
    }
    
    // Get Supabase client for database operations
    const supabase = await createClient();
    
    // Results tracking
    const successfulLeads = [];
    const failedLeads = [];
    
    // Process each lead
    for (const lead of leads) {
      try {
        console.log(`[API:ENRICH-BATCH] Processing lead: ${lead.name}`);
        
        if (!lead.website_url) {
          console.warn(`[API:ENRICH-BATCH] Lead ${lead.name} has no website URL, skipping`);
          failedLeads.push({
            name: lead.name,
            error: "Missing website URL"
          });
          continue;
        }
        
        // Create the database record first
        const leadRecord = {
          name: lead.name,
          type: lead.type || 'Venue',
          address: lead.address,
          website_url: lead.website_url,
          contact_email: lead.contact_email || null,
          contact_phone: lead.contact_phone || null,
          contact_name: lead.contact_name || null,
          status: 'saved',
          user_id: session.user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // Save to database
        console.log(`[API:ENRICH-BATCH] Saving lead ${lead.name} to database`);
        
        const { data: savedLead, error: saveError } = await supabase
          .from('saved_leads')
          .insert(leadRecord)
          .select()
          .single();
          
        if (saveError) {
          console.error(`[API:ENRICH-BATCH] Error saving lead ${lead.name}:`, saveError);
          failedLeads.push({
            name: lead.name,
            error: saveError.message
          });
          continue;
        }
        
        console.log(`[API:ENRICH-BATCH] Successfully saved lead ${lead.name} with ID ${savedLead.id}`);
        
        // Now enrich the saved lead
        const enrichResult = await enrichLead(savedLead);
        
        if (!enrichResult.success) {
          console.error(`[API:ENRICH-BATCH] Error enriching lead ${lead.name}:`, enrichResult.error);
          failedLeads.push({
            name: lead.name,
            error: enrichResult.error
          });
        } else {
          console.log(`[API:ENRICH-BATCH] Successfully enriched lead ${lead.name}`);
          successfulLeads.push(savedLead);
        }
      } catch (leadError) {
        console.error(`[API:ENRICH-BATCH] Error processing lead ${lead.name}:`, leadError);
        failedLeads.push({
          name: lead.name,
          error: leadError instanceof Error ? leadError.message : String(leadError)
        });
      }
    }
    
    // Return the results
    console.log(`[API:ENRICH-BATCH] Completed batch enrichment: ${successfulLeads.length} succeeded, ${failedLeads.length} failed`);
    
    return NextResponse.json({
      success: successfulLeads.length > 0,
      message: `Successfully enriched ${successfulLeads.length} leads`,
      leads: successfulLeads,
      failed: failedLeads.length,
      failures: failedLeads
    });
    
  } catch (error) {
    console.error('[API:ENRICH-BATCH] Error in batch enrichment:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Unknown error occurred",
        success: false
      },
      { status: 500 }
    );
  }
} 