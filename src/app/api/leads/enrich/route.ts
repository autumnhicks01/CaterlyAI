import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { workflowManager } from '@/workflows/workflowManager';
import { createClient } from '@/utils/supabase/server';
import type { Database } from '@/types/supabase';

export const maxDuration = 300; // 5 minutes for workflow execution

/**
 * POST handler for lead enrichment
 * 
 * This endpoint executes the standard lead-enrichment workflow
 */
export async function POST(req: NextRequest) {
  // Authenticate the user session
  const session = await auth();
  
  if (!session || !session.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }
  
  try {
    // Parse the request body
    const { leadIds } = await req.json();
    
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json(
        { error: "No lead IDs provided" },
        { status: 400 }
      );
    }
    
    console.log(`API: Starting lead enrichment for ${leadIds.length} leads`);
    console.log(`Lead IDs to enrich: ${leadIds.join(', ')}`);
    
    // First, fetch the leads from the database
    const supabase = await createClient();
    const { data: leads, error: fetchError } = await supabase
      .from('saved_leads')
      .select('*')
      .in('id', leadIds);
      
    if (fetchError || !leads) {
      console.error('Error fetching leads for enrichment:', fetchError);
      return NextResponse.json(
        { error: fetchError?.message || "Failed to fetch leads for enrichment" },
        { status: 500 }
      );
    }
    
    console.log(`API: Successfully fetched ${leads.length} leads for enrichment`);
    
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
    
    // Execute the standard lead-enrichment workflow
    console.log(`API: Executing lead-enrichment workflow with ${leadIds.length} lead IDs`);
    
    // Use the standard enrichment workflow directly with leadIds
    const result = await workflowManager.executeWorkflow('lead-enrichment', {
      leadIds
    });
    
    if (!result.success) {
      console.error('Workflow execution failed:', result.error);
      return NextResponse.json(
        { error: result.error || "Workflow execution failed" },
        { status: 500 }
      );
    }
    
    console.log(`API: Enrichment completed successfully`);
    
    // Save the enriched data back to the database if not already done by the workflow
    if (result.enrichedBusinesses?.length > 0) {
      const enrichedLeads = result.enrichedBusinesses;
      console.log(`Processing ${enrichedLeads.length} enriched leads to save to database`);
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const enrichedLead of enrichedLeads) {
        if (enrichedLead.id && enrichedLead.enrichment_data) {
          try {
            console.log(`Updating lead ${enrichedLead.id} (${enrichedLead.name}) in database with enrichment data`);
            
            // Ensure the enrichment_data doesn't contain problematic fields
            let safeEnrichmentData = { ...enrichedLead.enrichment_data };
            
            // Remove lastUpdated from enrichment_data to avoid database error
            if (safeEnrichmentData.lastUpdated) {
              delete safeEnrichmentData.lastUpdated;
            }
            
            // Convert any complex objects to strings to avoid database errors
            for (const key in safeEnrichmentData) {
              if (typeof safeEnrichmentData[key] === 'object' && safeEnrichmentData[key] !== null) {
                // If it's an array of strings, keep it as is
                if (Array.isArray(safeEnrichmentData[key]) && 
                    safeEnrichmentData[key].every((item: any) => typeof item === 'string')) {
                  continue;
                }
                
                // Otherwise, stringify it for safe storage
                safeEnrichmentData[key] = JSON.stringify(safeEnrichmentData[key]);
              }
            }
            
            // Strictly adhere to the existing database schema field names
            const updateData = {
              // Essential fields from the enrichment process
              enrichment_data: safeEnrichmentData,
              lead_score: enrichedLead.lead_score || enrichedLead.enrichment_data.leadScore?.score || null,
              lead_score_label: enrichedLead.lead_score_label || enrichedLead.enrichment_data.leadScore?.potential || null,
              status: 'enriched',
              website_url: enrichedLead.website_url || enrichedLead.website || enrichedLead.enrichment_data.website || null,
              contact_email: enrichedLead.enrichment_data.eventManagerEmail || enrichedLead.contact_email || null,
              contact_name: enrichedLead.enrichment_data.eventManagerName || enrichedLead.contact_name || null,
              contact_phone: enrichedLead.enrichment_data.eventManagerPhone || enrichedLead.contact_phone || null,
              has_email: Boolean(enrichedLead.enrichment_data.eventManagerEmail || enrichedLead.contact_email),
              updated_at: new Date().toISOString()
            };
            
            // Perform the update using exactly these fields
            const { error: updateError } = await supabase
              .from('saved_leads')
              .update(updateData)
              .eq('id', enrichedLead.id);
              
            if (updateError) {
              console.error(`Error updating lead ${enrichedLead.id}:`, updateError);
              
              // Try a fallback approach with fewer fields
              console.log(`Trying fallback update for lead ${enrichedLead.id} with minimal fields`);
              const minimalUpdate = {
                status: 'enriched',
                lead_score: enrichedLead.lead_score || null,
                updated_at: new Date().toISOString()
              };
              
              const { error: fallbackError } = await supabase
                .from('saved_leads')
                .update(minimalUpdate)
                .eq('id', enrichedLead.id);
                
              if (fallbackError) {
                console.error(`Fallback update also failed for lead ${enrichedLead.id}:`, fallbackError);
                errorCount++;
              } else {
                console.log(`Fallback update succeeded for lead ${enrichedLead.id}`);
                successCount++;
              }
            } else {
              console.log(`Successfully updated lead ${enrichedLead.id} with enrichment data`);
              successCount++;
            }
          } catch (updateError) {
            console.error(`Exception updating lead ${enrichedLead.id}:`, updateError);
            errorCount++;
          }
        } else {
          console.error(`Missing ID or enrichment data for lead:`, 
            enrichedLead.id ? 'Has ID but no enrichment_data' : 'Missing ID');
          errorCount++;
        }
      }
      
      console.log(`API: Updated ${successCount} leads in database after enrichment (${errorCount} errors)`);
    } else {
      console.warn('No enriched businesses found in workflow result');
      console.log('Workflow result:', result);
    }
    
    // Return the enriched leads
    return NextResponse.json({
      message: `Successfully enriched ${leadIds.length} leads`,
      businesses: result.enrichedBusinesses || [],
      count: result.enrichedBusinesses?.length || 0,
      success: true
    });
  } catch (error) {
    console.error("Error in lead enrichment API:", error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error occurred" },
      { status: 500 }
    );
  }
} 