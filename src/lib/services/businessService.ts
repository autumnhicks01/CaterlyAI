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
   * Enriches a list of businesses using the lead enrichment workflow.
   */
  async enrichBusinesses(businesses: Business[]): Promise<{ businesses?: Business[], error?: string }> {
    console.log("[ENRICHMENT] Starting business enrichment process");

    // Validate businesses input
    if (!businesses || businesses.length === 0) {
      console.error("[ENRICHMENT] No businesses provided for enrichment");
      return { error: "No businesses provided for enrichment" };
    }

    try {
      // Extract essential data to avoid serialization issues with date objects
      const essentialData = businesses.map(business => {
        const essentialBusiness: EnrichmentBusiness = {
          id: business.id || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: business.name,
          description: business.description,
          address: business.address,
          city: (business as any).city,
          state: (business as any).state,
          zip_code: (business as any).zip_code,
          website: business.website,
          website_url: (business as any).website_url || business.website,
          contact: business.contact
        };

        // Ensure we have a website URL
        if (!essentialBusiness.website_url && business.contact?.website) {
          essentialBusiness.website_url = business.contact.website;
        }

        return essentialBusiness;
      });

      // Store leads in localStorage for persistence across page navigation
      localStorage.setItem('enriching_leads', JSON.stringify(essentialData));
      console.log("[ENRICHMENT] Stored leads for enrichment:", essentialData.length);
      console.log("[ENRICHMENT] Sample lead data:", JSON.stringify(essentialData[0]).substring(0, 200));

      // Save leads to database first if they don't have IDs
      const leadIds = essentialData
        .filter(business => business.id && !business.id.startsWith('temp_'))
        .map(business => business.id);
      
      if (leadIds.length < essentialData.length) {
        console.log("[ENRICHMENT] Some leads need to be saved to database first");
        // Logic to save leads would go here if needed
        // For now, we'll just use the temp IDs
      }
      
      // Start workflow to enrich the businesses - using standard workflow name
      console.log("[ENRICHMENT] Executing lead-enrichment workflow with lead IDs:", leadIds);
      const workflowManager = new WorkflowManager();
      
      // Log environment status
      console.log("[ENRICHMENT] Environment check:", {
        apiKey: process.env.FIRECRAWL_API_KEY ? "Present (masked)" : "Missing",
        nodeEnv: process.env.NODE_ENV,
        apiUrl: process.env.API_URL || "Not set"
      });
      
      // Call the workflow with the list of lead IDs
      console.log("[ENRICHMENT] About to call workflow manager execute method");
      const result = await workflowManager.executeWorkflow('lead-enrichment', { leadIds });
      console.log("[ENRICHMENT] Workflow execution completed:", result);

      console.log("[ENRICHMENT] Workflow success status:", result.success);
      
      // Check results format
      if (Array.isArray(result.enrichedBusinesses)) {
        console.log("[ENRICHMENT] Received enriched businesses:", result.enrichedBusinesses.length);
        
        // Sample check for enrichment data
        const sampleBusiness = result.enrichedBusinesses[0];
        if (sampleBusiness?.enrichment_data) {
          console.log("[ENRICHMENT] Enrichment data found in first result");
          console.log("[ENRICHMENT] Sample enrichment data:", JSON.stringify(sampleBusiness.enrichment_data).substring(0, 500));
          
          // Check for Firecrawl data specifically
          if (sampleBusiness.enrichment_data.firecrawlExtracted || 
              sampleBusiness.enrichment_data.websiteContent) {
            console.log("[ENRICHMENT] Website content successfully extracted");
          }
        } else {
          console.warn("[ENRICHMENT] First business has no enrichment_data property");
          console.log("[ENRICHMENT] First business data:", JSON.stringify(sampleBusiness).substring(0, 500));
        }
      } else {
        console.warn("[ENRICHMENT] No enriched businesses array in result");
        console.log("[ENRICHMENT] Result structure:", Object.keys(result));
      }

      if (!result.success) {
        console.error("[ENRICHMENT] Workflow failed:", result.error);
        console.error("[ENRICHMENT] Workflow error details:", result);
        throw new Error(result.error || "Failed to execute enrichment workflow");
      }

      // Clear stored leads after successful enrichment
      console.log("[ENRICHMENT] Clearing stored leads from localStorage");
      localStorage.removeItem('enriching_leads');

      return { businesses: result.enrichedBusinesses };
    } catch (error) {
      console.error("[ENRICHMENT] Error in enrichBusinesses:", error);
      console.error("[ENRICHMENT] Error stack:", error instanceof Error ? error.stack : "No stack available");
      return { error: error instanceof Error ? error.message : "Unknown error during enrichment" };
    }
  }
};