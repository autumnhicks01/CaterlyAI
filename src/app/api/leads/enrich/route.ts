import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { fetchLeadsById, enrichLead } from '../api-utils';

export const maxDuration = 300; // 5 minutes (maximum allowed for Vercel Pro plan)

// Define interfaces for better type safety
interface Lead {
  id: string;
  name: string;
  website_url?: string | null;
  [key: string]: any;
}

interface EnrichmentProgressData {
  total: number;
  processed: number;
  currentLead: string;
  progress: number;
  success: boolean;
  hasEmail?: boolean;
  error?: string;
}

type ProgressCallback = (progressData: EnrichmentProgressData) => Promise<void>;

// Create a function to better track progress for the UI
async function trackEnrichmentProgress(leads: Lead[], callback?: ProgressCallback) {
  const results = [];
  let processedCount = 0;
  
  for (const lead of leads) {
    try {
      console.log(`[ENRICH-API] Processing lead ${processedCount + 1}/${leads.length}: ${lead.name}`);
      const result = await enrichLead(lead);
      results.push(result);
      
      processedCount++;
      
      // Call the callback with updated progress
      if (callback) {
        await callback({
          total: leads.length,
          processed: processedCount,
          currentLead: lead.name,
          progress: Math.round((processedCount / leads.length) * 100),
          success: result.success,
          hasEmail: result.success && result.enrichmentData?.eventManagerEmail
        });
      }
    } catch (error: unknown) {
      console.error(`[ENRICH-API] Error enriching lead ${lead.id}:`, error);
      results.push({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error", 
        leadId: lead.id 
      });
      
      processedCount++;
      
      // Call the callback with error information
      if (callback) {
        await callback({
          total: leads.length,
          processed: processedCount,
          currentLead: lead.name,
          progress: Math.round((processedCount / leads.length) * 100),
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  }
  
  return results;
}

/**
 * POST handler for lead enrichment
 * 
 * @deprecated This endpoint is being replaced by the new streamlined enrichment process
 * using the lib/enrichment module and API endpoints in /api/enrichment/*
 */
export async function POST(req: NextRequest) {
  console.warn('[API:ENRICH] This endpoint is deprecated. Please use the new enrichment implementation.');
  console.log('[API:ENRICH] Lead enrichment API route called');
  
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
    console.log(`[API:ENRICH] Request body: ${JSON.stringify(body)}`);
    
    // Check if leadIds are provided
    const leadIds = body.leadIds || [];
    console.log(`[API:ENRICH] Received ${leadIds.length} lead IDs to enrich`);
    
    if (leadIds.length === 0) {
      console.warn('[API:ENRICH] No lead IDs provided in request');
      return NextResponse.json({ 
        message: 'No leads to enrich', 
        success: false,
        count: 0,
        errors: ['No lead IDs provided']
      }, { status: 400 });
    }
    
    console.log(`[ENRICH-API] Starting enrichment for ${leadIds.length} leads`);
    
    // First, fetch the leads from the database
    const { data: leads, error: fetchError } = await fetchLeadsById(leadIds);
      
    if (fetchError || !leads) {
      console.error('[ENRICH-API] Error fetching leads for enrichment:', fetchError);
      return NextResponse.json(
        { error: fetchError instanceof Error ? fetchError.message : "Failed to fetch leads for enrichment" },
        { status: 500 }
      );
    }
    
    console.log(`[ENRICH-API] Successfully fetched ${leads.length} leads for enrichment`);
    
    // Check if any leads are missing website URLs
    const leadsWithoutWebsites = leads.filter(lead => !lead.website_url);
    
    if (leadsWithoutWebsites.length > 0) {
      // If any lead doesn't have a website, we can't enrich it
      const leadNames = leadsWithoutWebsites.map(lead => lead.name).join(", ");
      return NextResponse.json(
        { 
          error: `Cannot enrich leads without website URLs. Please add website URLs for: ${leadNames}`, 
          missingWebsites: leadsWithoutWebsites.map(lead => lead.name)
        },
        { status: 400 }
      );
    }
    
    // Return an immediate response with header flags to indicate processing has started
    const initialResponse = NextResponse.json({
      message: "Enrichment process started",
      processingStarted: true,
      count: leads.length,
      leadIds: leadIds,
      processingId: Date.now().toString(),
      success: true
    });
    
    // Add headers to signal the client to keep showing the loading UI
    initialResponse.headers.set('X-Firecrawl-Processing', 'true');
    initialResponse.headers.set('X-Firecrawl-Total-Leads', leads.length.toString());
    initialResponse.headers.set('X-Firecrawl-Expected-Duration', (leads.length * 30).toString()); // Approx 30 seconds per lead
    
    return initialResponse;
  } catch (error) {
    console.error('[ENRICH-API] Unexpected error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "An unexpected error occurred", 
        success: false 
      },
      { status: 500 }
    );
  }
} 