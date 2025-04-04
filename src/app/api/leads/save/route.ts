import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@/lib/supabase/server';
import { Business } from '@/types/business';

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
    const { businesses, skipEnrichment = false } = body;
    
    if (!businesses || !Array.isArray(businesses) || businesses.length === 0) {
      return Response.json(
        { error: 'Missing or invalid businesses array' },
        { status: 400 }
      );
    }
    
    // Initialize Supabase client
    const supabase = createClient();
    const userId = session.user.id;
    
    // Debug: Check table structure first
    console.log("Fetching saved_leads table structure...");
    try {
      const { data: tableData, error: tableError } = await supabase
        .from('saved_leads')
        .select('*')
        .limit(1);
      
      if (tableError) {
        console.error("Error checking table structure:", tableError);
      } else if (tableData && tableData.length > 0) {
        console.log("Example row structure:", Object.keys(tableData[0]));
      } else {
        console.log("No existing rows found to determine structure");
      }
    } catch (structErr) {
      console.error("Exception checking table structure:", structErr);
    }
    
    // Convert businesses to leads format for saving to Supabase
    const leads = businesses.map(business => {
      // Base lead data
      const leadData: any = {
        name: business.name,
        type: business.type || 'Venue',
        address: business.address,
        website_url: business.contact?.website || null,
        contact_phone: business.contact?.phone || null,
        contact_email: business.contact?.email || null,
        user_id: userId
      };

      // If this is a new lead, set created_at and status
      if (!business.id) {
        leadData.created_at = new Date().toISOString();
        // Set status based on whether this is an enriched business
        leadData.status = skipEnrichment ? 'new' : 'enriched';
      } else {
        // For existing leads, just update the status if enriched
        leadData.status = skipEnrichment ? leadData.status : 'enriched';
      }
      
      // If business has enrichment data, include it
      if (business.enrichment_data || business.description) {
        // Create enrichment data if it doesn't exist
        const enrichmentData = business.enrichment_data || {};
        
        // Add description as AI overview if available
        if (business.description && !enrichmentData.aiOverview) {
          enrichmentData.aiOverview = business.description;
        }
        
        // Include any basic contact information
        if (business.contact) {
          if (business.contact.email && !enrichmentData.eventManagerEmail) {
            enrichmentData.eventManagerEmail = business.contact.email;
          }
          if (business.contact.phone && !enrichmentData.eventManagerPhone) {
            enrichmentData.eventManagerPhone = business.contact.phone;
          }
        }
        
        // Add website if available
        if (business.contact?.website && !enrichmentData.website) {
          enrichmentData.website = business.contact.website;
        }
        
        // Add lastUpdated timestamp
        enrichmentData.lastUpdated = new Date().toISOString();
        
        leadData.enrichment_data = enrichmentData;
      }
      
      console.log("Prepared lead data:", leadData);
      return leadData;
    });
    
    // Check if each business already exists in the database to avoid duplicates
    let savedLeads = [];
    let errors = [];
    
    for (const lead of leads) {
      try {
        console.log(`Looking for existing lead with name: ${lead.name}`);
        // Check if a lead with this name and user already exists
        // We need to be more specific with our query to avoid multiple matches
        const { data: existingLeads, error: findError } = await supabase
          .from('saved_leads')
          .select('id')
          .eq('user_id', userId)
          .eq('name', lead.name);
          
        if (findError) {
          console.error(`Error checking for existing lead ${lead.name}:`, findError);
          errors.push(`Error checking lead ${lead.name}: ${findError.message}`);
          continue;
        }
        
        let result;
        if (existingLeads?.length > 0) {
          // If there are multiple leads with the same name, use the first one
          // This can happen if the schema allows duplicate names
          console.log(`Found ${existingLeads.length} existing leads with name ${lead.name}`);
          const existingLeadId = existingLeads[0].id;
          console.log(`Updating existing lead ${lead.name} with ID ${existingLeadId}`);
          
          result = await supabase
            .from('saved_leads')
            .update(lead)
            .eq('id', existingLeadId)
            .select();
        } else {
          // Insert new lead
          console.log(`Inserting new lead ${lead.name}`);
          result = await supabase
            .from('saved_leads')
            .insert(lead)
            .select();
        }
        
        if (result.error) {
          console.error(`Error saving lead ${lead.name}:`, result.error);
          errors.push(`Error saving lead ${lead.name}: ${result.error.message}`);
        } else if (result.data && result.data.length > 0) {
          savedLeads.push(result.data[0]);
        }
      } catch (leadError) {
        console.error(`Exception processing lead ${lead.name}:`, leadError);
        errors.push(`Exception for lead ${lead.name}: ${String(leadError)}`);
      }
    }
    
    // Return success or error based on results
    if (savedLeads.length === 0 && errors.length > 0) {
      return Response.json(
        { 
          error: 'Failed to save any leads',
          details: errors.join('; ')
        },
        { status: 500 }
      );
    }
    
    console.log(`Successfully saved ${savedLeads.length} leads with ${errors.length} errors`);
    return Response.json({
      success: true,
      message: `Saved ${savedLeads.length} leads successfully${errors.length > 0 ? ` with ${errors.length} errors` : ''}`,
      leads: savedLeads,
      errors: errors.length > 0 ? errors : undefined,
      count: savedLeads.length
    });
  } catch (error) {
    console.error('Lead saving error:', error);
    return Response.json(
      { error: String(error) },
      { status: 500 }
    );
  }
} 