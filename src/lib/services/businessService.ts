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
      const response = await fetch('/api/business', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
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
      const response = await fetch('/api/business', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ businesses }),
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