import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@/utils/supabase/server';

/**
 * POST handler for temporarily saving leads before enrichment
 * 
 * This endpoint saves leads to a temporary collection in the database
 * so they can be processed by the enrichment workflow
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
  
  const userId = session.user.id;
  
  try {
    // Parse the request body
    const { businesses } = await req.json();
    
    if (!businesses || !Array.isArray(businesses) || businesses.length === 0) {
      return NextResponse.json(
        { error: "No businesses provided" },
        { status: 400 }
      );
    }
    
    console.log(`Temporarily saving ${businesses.length} leads for enrichment`);
    
    // Initialize Supabase client
    const supabase = await createClient();
    
    // Prepare leads for insertion
    const leadsToSave = businesses.map(business => ({
      user_id: userId,
      name: business.name,
      website_url: business.website || business.contact?.website || '',
      phone: business.phone || business.contact?.phone || '',
      address: business.address,
      category: business.category || business.type || 'Business',
      description: business.description || '',
      has_event_space: business.hasEventSpace,
      original_id: business.id,
      status: 'saved',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      temp_record: true
    }));
    
    // Insert the leads into the saved_leads table
    const { data, error } = await supabase
      .from('saved_leads')
      .insert(leadsToSave)
      .select('id');
    
    if (error) {
      console.error("Error saving leads:", error);
      return NextResponse.json(
        { error: `Failed to save leads: ${error.message}` },
        { status: 500 }
      );
    }
    
    // Return the IDs of the saved leads
    return NextResponse.json({
      message: `Successfully saved ${data.length} leads for enrichment`,
      count: data.length,
      leadIds: data.map(lead => lead.id)
    });
  } catch (error) {
    console.error("Error in temp-save API:", error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error occurred" },
      { status: 500 }
    );
  }
} 