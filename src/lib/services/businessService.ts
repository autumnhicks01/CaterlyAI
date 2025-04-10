import { Business, BusinessSearchRequest, BusinessSearchResponse } from "@/types/business";
import { WorkflowManager } from "@/workflows/workflowManager";

// Storage keys
const SELECTED_LEADS_STORAGE_KEY = 'catering_ai_selected_leads';

// Interface for extended business data in enrichment
interface EnrichmentBusiness extends Business {
  // Standard fields that might not be in the Business type
  city?: string;
  state?: string;
  zip_code?: string;
  website_url?: string;
  // Any other fields that might be needed for enrichment
  [key: string]: any;
}

/**
 * Service for business-related operations
 */
export const businessService = {
  /**
   * Store selected leads in localStorage for enrichment
   */
  storeSelectedLeads(leads: Business[]): void {
    try {
      // Only store essential data to avoid exceeding storage limits
      const essentialData = leads.map(lead => ({
        id: lead.id || `temp-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        name: lead.name,
        website_url: lead.website || lead.contact?.website || '',
        phone: lead.phone || lead.contact?.phone || '',
        address: lead.address,
        description: lead.description || '',
        category: lead.category || lead.type || 'Business',
        hasEventSpace: lead.hasEventSpace
      }));
      
      localStorage.setItem(SELECTED_LEADS_STORAGE_KEY, JSON.stringify(essentialData));
      console.log(`Stored ${essentialData.length} leads in localStorage for enrichment`);
    } catch (error) {
      console.error('Error storing leads in localStorage:', error);
      // If localStorage fails, store in memory as fallback
      (window as any).__selectedLeads = leads;
    }
  },
  
  /**
   * Get selected leads from localStorage or memory fallback
   */
  getSelectedLeads(): Business[] {
    try {
      const storedData = localStorage.getItem(SELECTED_LEADS_STORAGE_KEY);
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        console.log(`Retrieved ${parsedData.length} leads from localStorage`);
        return parsedData;
      }
    } catch (error) {
      console.error('Error retrieving leads from localStorage:', error);
    }
    
    // Check memory fallback if localStorage fails
    if ((window as any).__selectedLeads) {
      return (window as any).__selectedLeads;
    }
    
    return [];
  },
  
  /**
   * Clear stored leads after enrichment is complete
   */
  clearSelectedLeads(): void {
    try {
      localStorage.removeItem(SELECTED_LEADS_STORAGE_KEY);
      if ((window as any).__selectedLeads) {
        delete (window as any).__selectedLeads;
      }
    } catch (error) {
      console.error('Error clearing stored leads:', error);
    }
  },

  /**
   * Fast business search - returns essential data quickly
   * Returns: Name, Address, Phone, Website URL, Category
   */
  async fastSearch(request: BusinessSearchRequest): Promise<BusinessSearchResponse> {
    try {
      // Build the search parameters
      const searchParams = new URLSearchParams();
      searchParams.append('query', request.query || '');
      
      // Handle location parameter
      if (request.location && request.location.trim() !== '') {
        searchParams.append('location', request.location);
        console.log(`Using provided location: ${request.location}`);
      } else if (request.coordinates && request.coordinates.lat && request.coordinates.lng) {
        const locationString = `${request.coordinates.lat},${request.coordinates.lng}`;
        searchParams.append('location', locationString);
        console.log(`Using coordinates as location: ${locationString}`);
      } else {
        console.error('No location or coordinates provided for business search');
        throw new Error('Location is required for business search');
      }
      
      if (request.radius) {
        searchParams.append('radius', request.radius.toString());
      }
      
      console.log(`Fast search API request: /api/leads/streaming?${searchParams.toString()}`);
      
      // Make the API request
      const response = await fetch(`/api/leads/streaming?${searchParams.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Fast search failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // Parse the response
      const responseData = await response.json();
      console.log("Fast search response:", responseData);

      // Return the parsed response
      return {
        businesses: responseData.results || [],
        count: responseData.count || 0,
        message: responseData.message || 'Search completed'
      };
    } catch (error) {
      console.error('Error in fast search:', error);
      return {
        businesses: [],
        count: 0,
        error: String(error),
        message: `Error: ${String(error)}`
      };
    }
  },

  /**
   * Legacy search businesses function
   */
  async searchBusinesses(request: BusinessSearchRequest): Promise<BusinessSearchResponse> {
    // Just use the fast search implementation
    return this.fastSearch(request);
  },

  /**
   * Legacy streaming search - kept for backward compatibility
   */
  async searchBusinessesWithStreaming(
    request: BusinessSearchRequest, 
    callbacks: {
      onProgress?: (progress: any) => void;
      onBusiness?: (business: Business) => void;
      onComplete?: (results: BusinessSearchResponse) => void;
      onError?: (error: string) => void;
    } = {}
  ): Promise<{ cancel: () => void }> {
    try {
      // Just use the fast search implementation
      const results = await this.fastSearch(request);
      
      // Call the progress callback immediately
      if (callbacks.onProgress) {
        callbacks.onProgress({
          step: 'search-businesses',
          status: 'completed',
          count: results.businesses?.length || 0,
          total: results.businesses?.length || 0,
          message: `Found ${results.businesses?.length || 0} businesses`
        });
      }
      
      // Send all businesses at once
      if (callbacks.onBusiness && results.businesses && results.businesses.length > 0) {
        results.businesses.forEach(business => {
          callbacks.onBusiness!(business);
        });
      }
      
      // Call the complete callback
      if (callbacks.onComplete) {
        callbacks.onComplete(results);
      }
      
      // If there was an error, call the error callback
      if (results.error && callbacks.onError) {
        callbacks.onError(results.error);
      }
      
      return { cancel: () => {} };
    } catch (error) {
      console.error('Error in streaming search:', error);
      if (callbacks.onError) {
        callbacks.onError(error instanceof Error ? error.message : String(error));
      }
      return { cancel: () => {} };
    }
  },

  /**
   * Enriches a list of businesses using a consolidated enrichment process.
   * This is the single source of truth for the enrichment flow.
   * 
   * Steps:
   * 1. Take lead information from discovery page
   * 2. Save leads to database with status="new"
   * 3. Process each lead's website through our enrichment pipeline
   * 4. Save enrichment results to database
   * 5. Return enriched leads for display in the UI
   */
  async enrichBusinesses(businesses: Business[]): Promise<{ businesses?: Business[], error?: string }> {
    console.log("[ENRICHMENT] Starting streamlined business enrichment process");

    // Validate businesses input
    if (!businesses || businesses.length === 0) {
      console.error("[ENRICHMENT] No businesses provided for enrichment");
      return { error: "No businesses provided for enrichment" };
    }

    try {
      // STEP 1: Prepare lead data with all necessary information
      console.log(`[ENRICHMENT] Preparing ${businesses.length} leads for enrichment`);
      
      const essentialData = businesses.map(business => {
        // Create a clean business object with only the essential data
        return {
          id: business.id || `temp-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          name: business.name,
          address: business.address,
          website_url: (business as any).website_url || business.website || business.contact?.website,
          contact_email: business.contact?.email,
          contact_phone: business.contact?.phone || business.phone,
          contact_name: (business as any).contact_name,
          type: business.type || 'Venue',
          description: business.description
        };
      });
      
      // Basic validation - check for required website URLs
      const missingWebsites = essentialData.filter(lead => !lead.website_url);
      if (missingWebsites.length > 0) {
        console.error(`[ENRICHMENT] ${missingWebsites.length} leads are missing website URLs`);
        return { 
          error: `${missingWebsites.length} leads are missing website URLs and cannot be enriched. Please provide website URLs for: ${missingWebsites.map(l => l.name).join(', ')}`
        };
      }

      // Create a tracking object in localStorage to monitor enrichment progress
      localStorage.setItem('enrichment_status', 'processing');
      localStorage.setItem('enrichment_count', essentialData.length.toString());
      localStorage.setItem('enrichment_start_time', new Date().toISOString());

      // Import the enrichment functions here to avoid bundling issues
      const { processUrl, waitForCompletion } = await import('@/lib/enrichment');
      
      // STEP 2: Save leads to database first with status="new"
      console.log(`[ENRICHMENT] Saving ${essentialData.length} leads to database`);
      
      const saveResponse = await fetch('/api/leads/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-protection': '1'
        },
        body: JSON.stringify({
          businesses: essentialData
        })
      });
      
      if (!saveResponse.ok) {
        const errorData = await saveResponse.json();
        console.error("[ENRICHMENT] Failed to save leads:", errorData);
        
        localStorage.setItem('enrichment_status', 'error');
        localStorage.setItem('enrichment_error', `Failed to save leads: ${errorData.error || 'Unknown error'}`);
        
        return { error: `Failed to save leads: ${errorData.error || 'Unknown error'}` };
      }
      
      const savedLeadsData = await saveResponse.json();
      const savedLeads = savedLeadsData.leads || [];
      
      if (savedLeads.length === 0) {
        console.error("[ENRICHMENT] No leads were saved successfully");
        localStorage.setItem('enrichment_status', 'error');
        localStorage.setItem('enrichment_error', 'No leads were saved successfully');
        return { error: 'No leads were saved successfully' };
      }
      
      console.log(`[ENRICHMENT] Successfully saved ${savedLeads.length} leads to database`);
      
      // STEP 3: Process each lead through the enrichment pipeline
      console.log(`[ENRICHMENT] Starting enrichment process for ${savedLeads.length} leads`);
      
      const enrichedLeads = [];
      const failedLeads = [];
      
      // Process leads one by one to avoid overwhelming the API
      for (let i = 0; i < savedLeads.length; i++) {
        const lead = savedLeads[i];
        try {
          console.log(`[ENRICHMENT] Processing lead ${i+1}/${savedLeads.length}: ${lead.name}`);
          
          // Update progress in localStorage
          const progress = Math.round(((i+1) / savedLeads.length) * 100);
          localStorage.setItem('enrichment_progress', progress.toString());
          localStorage.setItem('enrichment_current_lead', lead.name);
          
          // Start enrichment process for this lead's website
          const { jobId } = await processUrl(lead.website_url);
          console.log(`[ENRICHMENT] Started job ${jobId} for lead ${lead.name}`);
          
          // Wait for enrichment completion
          const enrichmentResult = await waitForCompletion(jobId, (status, progress) => {
            console.log(`[ENRICHMENT] Lead ${lead.name} - Status: ${status}, Progress: ${progress}%`);
          });
          
          console.log(`[ENRICHMENT] Enrichment complete for lead ${lead.name}`);
          
          // STEP 4: Save enrichment result to database
          const updateResponse = await fetch('/api/leads/update', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-csrf-protection': '1'
            },
            body: JSON.stringify({
              leadId: lead.id,
              enrichment_data: enrichmentResult,
              status: 'enriched',
              lead_score: enrichmentResult.leadScore?.score,
              lead_score_label: enrichmentResult.leadScore?.potential
            })
          });
          
          if (updateResponse.ok) {
            const updatedLead = await updateResponse.json();
            console.log(`[ENRICHMENT] Successfully updated lead ${lead.name} with enrichment data`);
            enrichedLeads.push(updatedLead.lead || lead);
          } else {
            console.error(`[ENRICHMENT] Failed to update lead ${lead.name} with enrichment data`);
            failedLeads.push({
              id: lead.id,
              name: lead.name,
              error: 'Failed to update lead with enrichment data'
            });
          }
          
        } catch (leadError) {
          console.error(`[ENRICHMENT] Error processing lead ${lead.name}:`, leadError);
          failedLeads.push({
            id: lead.id,
            name: lead.name,
            error: leadError instanceof Error ? leadError.message : String(leadError)
          });
        }
      }
      
      // STEP 5: Update status and return results
      const successCount = enrichedLeads.length;
      const failCount = failedLeads.length;
      
      console.log(`[ENRICHMENT] Enrichment process complete. Success: ${successCount}, Failed: ${failCount}`);
      
      // Set success status in localStorage
      localStorage.setItem('enrichment_status', successCount > 0 ? 'success' : 'error');
      localStorage.setItem('enrichment_count', successCount.toString());
      localStorage.setItem('enrichment_time', new Date().toISOString());
      
      // Clear tracking data
      localStorage.removeItem('enrichment_start_time');
      localStorage.removeItem('enrichment_progress');
      localStorage.removeItem('enrichment_current_lead');
      
      // Return the enriched businesses
      return { 
        businesses: enrichedLeads,
        error: failCount > 0 
          ? `${failCount} leads could not be enriched` 
          : undefined
      };
    } catch (error) {
      console.error("[ENRICHMENT] Unhandled error in enrichment process:", error);
      
      // Ensure error status is set in localStorage
      localStorage.setItem('enrichment_status', 'error');
      localStorage.setItem('enrichment_error', error instanceof Error ? 
        error.message : "Unknown error during enrichment");
      
      return { error: error instanceof Error ? error.message : "Unknown error during enrichment" };
    }
  }
};