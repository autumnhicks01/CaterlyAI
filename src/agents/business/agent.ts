import { BusinessService } from './service';
import { Business, BusinessSearchParams, BusinessSearchResult, BusinessEnhanceResult, BusinessBatch } from './model';

/**
 * Agent for handling business-related operations
 */
export class BusinessAgent {
  private service: BusinessService;

  constructor() {
    this.service = new BusinessService();
  }

  /**
   * Search for businesses based on the provided parameters
   */
  async searchBusinesses(params: BusinessSearchParams): Promise<BusinessSearchResult> {
    return this.service.searchBusinesses(params);
  }

  /**
   * Get detailed information about a specific business
   */
  async getBusinessDetails(businessId: string): Promise<Business> {
    return this.service.getBusinessDetails(businessId);
  }

  /**
   * Find businesses for a catering event based on event requirements
   */
  async findBusinessesForEvent(eventType: string, location: string, guestCount: number): Promise<Business[]> {
    // First search for businesses
    const searchParams: BusinessSearchParams = {
      query: eventType + (guestCount > 100 ? " Large Catering" : " Catering"),
      location
    };

    const searchResults = await this.service.searchBusinesses(searchParams);
    
    // Enhance the business data
    const enhanceResult = await this.service.enhanceBusinesses(searchResults.businesses);
    
    // Filter businesses based on event requirements
    return enhanceResult.enhancedBusinesses.filter(business => {
      // For large events, prioritize businesses with event space
      if (guestCount > 200 && !business.hasEventSpace) {
        return false;
      }
      return true;
    });
  }

  /**
   * Process businesses in batches
   */
  async processBatchesOfBusinesses(businesses: Business[]): Promise<Business[]> {
    const batchSize = 10;
    const batches: BusinessBatch[] = [];
    
    // Split businesses into batches
    for (let i = 0; i < businesses.length; i += batchSize) {
      batches.push({
        batchIndex: i / batchSize,
        businesses: businesses.slice(i, i + batchSize)
      });
    }
    
    // Process each batch
    const batchPromises = batches.map(batch => this.service.processBatch(batch));
    const results = await Promise.all(batchPromises);
    
    // Combine all enhanced businesses
    return results.flatMap(result => result.enhancedBusinesses);
  }

  /**
   * Rank businesses by relevance to event requirements
   */
  rankBusinessesByRelevance(businesses: Business[], eventType: string): Business[] {
    // Simple ranking logic based on type match and event space
    return [...businesses].sort((a, b) => {
      // Prioritize businesses that match the event type
      const aTypeMatch = a.type.toLowerCase().includes(eventType.toLowerCase()) ? 1 : 0;
      const bTypeMatch = b.type.toLowerCase().includes(eventType.toLowerCase()) ? 1 : 0;
      
      if (aTypeMatch !== bTypeMatch) {
        return bTypeMatch - aTypeMatch;
      }
      
      // Then prioritize businesses with event space
      return (b.hasEventSpace ? 1 : 0) - (a.hasEventSpace ? 1 : 0);
    });
  }
} 