import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@/lib/supabase/server';
import { enrichmentAgent } from '@/lib/ai/agents/enrichmentAgent';

export const maxDuration = 300; // 5 minutes for enrichment process

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return Response.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const body = await req.json();
    const { leadIds } = body;
    
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return Response.json(
        { error: 'Missing or invalid leadIds array' },
        { status: 400 }
      );
    }
    
    console.log(`Starting enrichment for ${leadIds.length} leads`);
    
    // Use the enrichmentAgent to enrich the leads
    const enrichmentResult = await enrichmentAgent.steps.enrichLeads({ leadIds });
    
    if (!enrichmentResult.success) {
      console.error('Lead enrichment failed:', enrichmentResult.message);
      return Response.json(
        { 
          error: 'Failed to enrich leads: ' + enrichmentResult.message,
          details: enrichmentResult.error
        },
        { status: 500 }
      );
    }
    
    // Get the number of successfully enriched leads
    const successCount = enrichmentResult.results?.successful || 0;
    
    // Update the leads' status to 'enriched' in Supabase
    try {
      const supabase = createClient();
      const updatedLeads = [];
      
      // For each lead that was successfully enriched, set its status to 'enriched'
      for (const leadId of leadIds) {
        const { data, error: updateError } = await supabase
          .from('saved_leads')
          .update({ status: 'enriched' })
          .eq('id', leadId)
          .select('id, name')
          .single();
        
        if (updateError) {
          console.error(`Error updating lead ${leadId} status:`, updateError);
        } else if (data) {
          console.log(`Updated lead ${data.name} (${leadId}) status to 'enriched'`);
          updatedLeads.push(data);
        }
      }
      
      return Response.json({
        success: true,
        message: `${successCount} leads enriched successfully`,
        updatedLeads,
        count: updatedLeads.length,
        results: enrichmentResult.results
      });
    } catch (updateErr) {
      console.error('Error updating lead statuses:', updateErr);
      // Still return success for enrichment, but note the status update failure
      return Response.json({
        success: true,
        warning: 'Leads were enriched but status update failed: ' + String(updateErr),
        message: `${successCount} leads enriched successfully but status update failed`,
        results: enrichmentResult.results
      });
    }
  } catch (error) {
    console.error('Lead enrichment error:', error);
    return Response.json(
      { error: String(error) },
      { status: 500 }
    );
  }
} 