import { Business, BusinessSearchRequest, BusinessSearchResponse } from "@/types/business";

/**
 * Service for business-related operations
 */
export const businessService = {
  /**
   * Search for businesses based on query and user location
   */
  async searchBusinesses(request: BusinessSearchRequest): Promise<BusinessSearchResponse> {
    try {
      // Use the new workflow-based API endpoint
      const searchParams = new URLSearchParams();
      searchParams.append('query', request.query || '');
      searchParams.append('location', request.location || '');
      
      if (request.radius) {
        searchParams.append('radius', request.radius.toString());
      }
      
      const response = await fetch(`/api/leads?${searchParams.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to search businesses: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error searching businesses:', error);
      return {
        businesses: [],
        count: 0,
        error: String(error)
      };
    }
  },

  /**
   * Enrich businesses with additional information
   */
  async enrichBusinesses(businesses: Business[]): Promise<BusinessSearchResponse> {
    try {
      const response = await fetch('/api/leads/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          businesses,
          skipEnrichment: false
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to enrich businesses: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error enriching businesses:', error);
      return {
        businesses: businesses,
        count: businesses.length,
        error: String(error)
      };
    }
  }
}; 