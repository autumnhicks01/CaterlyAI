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
    const { leads, businesses, skipEnrichment = false } = body;
    
    // Allow either "leads" or "businesses" for backward compatibility
    const leadsToProcess = leads || businesses || [];

    if (!leadsToProcess || !Array.isArray(leadsToProcess) || leadsToProcess.length === 0) {
      return Response.json(
        { error: 'Missing or invalid leads array' },
        { status: 400 }
      );
    }
    
    // Initialize Supabase client
    const supabase = await createClient();
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
    const formattedLeads = leadsToProcess.map(business => {
      // Base lead data
      const leadData: any = {
        name: business.name,
        type: business.type || 'Venue',
        address: business.address,
        website_url: business.website_url || business.website || business.contact?.website || null,
        contact_phone: business.contact_phone || business.contact?.phone || business.phone || null,
        contact_email: business.contact_email || business.contact?.email || null,
        user_id: userId
      };

      // If this is a new lead, set created_at and status
      if (!business.id) {
        leadData.created_at = new Date().toISOString();
        leadData.status = 'new';
      } else if (business.enrichment_data && Object.keys(business.enrichment_data).length > 0) {
        // Only mark as enriched if it actually has enrichment data
        leadData.status = 'enriched';
      }
      
      // If business has enrichment data, include it
      if (business.enrichment_data || business.description) {
        // Create enrichment data if it doesn't exist
        const enrichmentData = business.enrichment_data || {};
        
        // Add description as AI overview if available
        if (business.description && !enrichmentData.aiOverview) {
          enrichmentData.aiOverview = business.description;
        } else if (!enrichmentData.aiOverview) {
          // Create a simple description if none exists
          enrichmentData.aiOverview = `${business.name} is a venue located at ${business.address || 'an unknown address'}.`;
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
        
        // Add website if available - check both possible locations
        if (!enrichmentData.website) {
          if (business.website_url) {
            enrichmentData.website = business.website_url;
          } else if (business.website) {
            enrichmentData.website = business.website;
          } else if (business.contact?.website) {
            enrichmentData.website = business.contact.website;
          }
        }
        
        // Explicitly preserve firecrawl data if available
        if (business.firecrawl_data && !enrichmentData.firecrawlExtracted) {
          enrichmentData.firecrawlExtracted = business.firecrawl_data;
          console.log(`Preserved firecrawl_data for lead ${business.name}`);
          
          // If firecrawl has contact information, ensure it's included
          if (business.firecrawl_data.contactInformation) {
            const contactInfo = business.firecrawl_data.contactInformation;
            
            if (contactInfo.email && !enrichmentData.eventManagerEmail) {
              enrichmentData.eventManagerEmail = contactInfo.email;
              leadData.contact_email = contactInfo.email;
              console.log(`Added email from firecrawl: ${contactInfo.email}`);
            }
            
            if (contactInfo.phone && !enrichmentData.eventManagerPhone) {
              enrichmentData.eventManagerPhone = contactInfo.phone;
              leadData.contact_phone = contactInfo.phone;
              console.log(`Added phone from firecrawl: ${contactInfo.phone}`);
            }
            
            if (contactInfo.contactPersonName && !leadData.contact_name) {
              leadData.contact_name = contactInfo.contactPersonName;
              console.log(`Added contact name from firecrawl: ${contactInfo.contactPersonName}`);
            }
          }
        }
        
        // Preserve raw extracted data
        if (business.rawExtractedData && !enrichmentData.rawExtractedData) {
          enrichmentData.rawExtractedData = business.rawExtractedData;
          console.log(`Preserved rawExtractedData for lead ${business.name}`);
        }
        
        // Preserve website content if available
        if (business.websiteContent && !enrichmentData.websiteContent) {
          // Store only the first 2000 characters to avoid database issues
          enrichmentData.websiteContent = typeof business.websiteContent === 'string'
            ? business.websiteContent.substring(0, 2000) + "... [Content truncated]"
            : JSON.stringify(business.websiteContent).substring(0, 2000) + "... [Content truncated]";
          console.log(`Preserved websiteContent for lead ${business.name}`);
          
          // If we have website content but no good overview, try to create one
          if (!enrichmentData.aiOverview || enrichmentData.aiOverview.length < 50) {
            try {
              const content = typeof business.websiteContent === 'string' 
                ? business.websiteContent 
                : JSON.stringify(business.websiteContent);
              
              // Extract a simple description from website content
              let description = content
                .substring(0, 1000)
                .replace(/\s+/g, ' ')
                .trim();
  
              // Try to find a sentence that might be a good description
              const sentences = description.split(/[.!?]+/);
              let bestSentence = sentences.find(s => 
                s.length > 30 && 
                s.length < 200 && 
                (s.toLowerCase().includes('venue') || 
                 s.toLowerCase().includes('event') || 
                 s.toLowerCase().includes('wedding') || 
                 s.toLowerCase().includes('catering'))
              ) || sentences[0] || '';
  
              // Clean up the sentence
              bestSentence = bestSentence.trim();
              if (bestSentence) {
                enrichmentData.aiOverview = 
                  `${business.name} is a venue located at ${business.address || 'an unknown address'}. ${bestSentence}`;
                console.log(`Created basic AI overview from website content`);
              }
            } catch (error) {
              console.warn(`Error creating AI overview from website content:`, error);
            }
          }
        }
        
        // Ensure all required fields exist for proper UI display
        if (!enrichmentData.venueName) {
          enrichmentData.venueName = business.name;
        }
        
        // Add a proper business_id if missing
        if (!enrichmentData.business_id) {
          enrichmentData.business_id = `web_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
        }
        
        // Ensure description is present
        if (!enrichmentData.description && enrichmentData.aiOverview) {
          enrichmentData.description = enrichmentData.aiOverview;
        } else if (!enrichmentData.description) {
          enrichmentData.description = `${business.name} is a venue located at ${business.address || 'an unknown location'}.`;
        }
        
        // Ensure we have all required arrays, even if empty
        enrichmentData.commonEventTypes = enrichmentData.commonEventTypes || [];
        enrichmentData.amenities = enrichmentData.amenities || [];
        enrichmentData.preferredCaterers = enrichmentData.preferredCaterers || [];
        
        // Ensure we have contact info if available
        if (!enrichmentData.eventManagerEmail && business.contact_email) {
          enrichmentData.eventManagerEmail = business.contact_email;
        }
        
        if (!enrichmentData.eventManagerPhone && business.contact_phone) {
          enrichmentData.eventManagerPhone = business.contact_phone;
        }
        
        // Make sure inHouseCatering is defined
        if (enrichmentData.inHouseCatering === undefined) {
          enrichmentData.inHouseCatering = false;
        }
        
        // Ensure we have lastUpdated timestamp
        if (!enrichmentData.lastUpdated) {
          enrichmentData.lastUpdated = new Date().toISOString();
        }
        
        // Calculate a lead score if none exists
        if (!enrichmentData.leadScore) {
          const hasWebsite = Boolean(enrichmentData.website || business.website_url || business.website);
          const hasEmail = Boolean(enrichmentData.eventManagerEmail || business.contact_email || business.contact?.email);
          const hasPhone = Boolean(enrichmentData.eventManagerPhone || business.contact_phone || business.contact?.phone);
          const hasGoodDescription = Boolean(enrichmentData.aiOverview && enrichmentData.aiOverview.length > 100);
          
          // Base score increased if we have more information
          const score = Math.min(
            20 + // Base score 
            (hasWebsite ? 15 : 0) + // Has website
            (hasEmail ? 35 : 0) + // Has email (most important)
            (hasPhone ? 15 : 0) + // Has phone
            (hasGoodDescription ? 10 : 0), // Has good description
            100 // Max score
          );
          
          let potential = 'low';
          if (score >= 70) potential = 'high';
          else if (score >= 50) potential = 'medium';
          
          enrichmentData.leadScore = {
            score: score,
            reasons: [
              hasWebsite ? "Has website" : "No website",
              hasEmail ? "Has email contact" : "No email contact",
              hasPhone ? "Has phone contact" : "No phone contact",
              hasGoodDescription ? "Has detailed description" : "Missing detailed description"
            ],
            potential: potential,
            lastCalculated: new Date().toISOString()
          };
          
          console.log(`Generated lead score for ${business.name}: ${score} (${potential})`);
        }
        
        leadData.enrichment_data = enrichmentData;
        leadData.lead_score = enrichmentData.leadScore?.score || null;
        leadData.lead_score_label = enrichmentData.leadScore?.potential || null;
      }
      
      console.log("Prepared lead data:", leadData);
      return leadData;
    });
    
    // Check if each business already exists in the database to avoid duplicates
    let savedLeads = [];
    let errors = [];
    
    for (const lead of formattedLeads) {
      try {
        console.log(`Processing lead: ${lead.name}`);
        
        // Check if a lead with this name and user already exists
        const { data: existingLeads, error: findError } = await supabase
          .from('saved_leads')
          .select('id, status, enrichment_data')
          .eq('user_id', userId)
          .eq('name', lead.name);
          
        if (findError) {
          console.error(`Error checking for existing lead ${lead.name}:`, findError);
          errors.push(`Error checking lead ${lead.name}: ${findError.message}`);
          continue;
        }
        
        let result;
        
        if (existingLeads && existingLeads.length > 0) {
          // If there are multiple leads with the same name, use the first one
          console.log(`Found ${existingLeads.length} existing leads with name ${lead.name}`);
          const existingLeadId = existingLeads[0].id;
          console.log(`Updating existing lead ${lead.name} with ID ${existingLeadId}`);
          
          // Preserve enrichment data and status if already enriched
          if (existingLeads[0].status === 'enriched' && existingLeads[0].enrichment_data) {
            console.log(`Lead ${lead.name} is already enriched, preserving enrichment_data and status`);
            if (!lead.enrichment_data) {
              lead.enrichment_data = existingLeads[0].enrichment_data;
            }
            lead.status = 'enriched';
          }
          
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