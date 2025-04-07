import { Business, BusinessSearchRequest, BusinessSearchResponse } from "@/types/business";

/**
 * Service for business-related operations
 */
export const businessService = {
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
   * Enrich businesses with additional information
   */
  async enrichBusinesses(businesses: Business[]): Promise<BusinessSearchResponse> {
    try {
      // For now, just return the original businesses - no enrichment
      return {
        businesses,
        count: businesses.length,
        message: 'Businesses processed without enrichment'
      };
    } catch (error) {
      console.error('Error processing businesses:', error);
      return {
        businesses: businesses,
        count: businesses.length,
        error: String(error)
      };
    }
  }
}; 