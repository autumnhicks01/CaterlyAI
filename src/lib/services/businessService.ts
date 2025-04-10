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
   * 3. Call enrichment API to process the leads
   * 4. Return enriched leads for display in the UI
   */
  async enrichBusinesses(businesses: Business[]): Promise<{ businesses?: Business[], error?: string }> {
    console.log("[ENRICHMENT] Starting consolidated business enrichment process");

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

      // STEP 2: Call the server API to enrich the leads
      console.log(`[ENRICHMENT] Sending ${essentialData.length} leads to server for enrichment`);
      
      const enrichResponse = await fetch('/api/leads/enrich-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-protection': '1'
        },
        body: JSON.stringify({
          leads: essentialData
        })
      });
      
      if (!enrichResponse.ok) {
        const errorData = await enrichResponse.json();
        console.error("[ENRICHMENT] Failed to enrich leads:", errorData);
        
        localStorage.setItem('enrichment_status', 'error');
        localStorage.setItem('enrichment_error', `Failed to enrich leads: ${errorData.error || 'Unknown error'}`);
        
        return { error: `Failed to enrich leads: ${errorData.error || 'Unknown error'}` };
      }
      
      const enrichResult = await enrichResponse.json();
      console.log("[ENRICHMENT] Enrichment completed successfully:", enrichResult);
      
      // Set success status in localStorage
      localStorage.setItem('enrichment_status', 'success');
      localStorage.setItem('enrichment_count', (enrichResult.leads?.length || 0).toString());
      localStorage.setItem('enrichment_time', new Date().toISOString());
      
      // Clear tracking data
      localStorage.removeItem('enrichment_start_time');
      
      // Return the enriched businesses
      return { 
        businesses: enrichResult.leads || [],
        error: enrichResult.failed > 0 
          ? `${enrichResult.failed} leads could not be enriched` 
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