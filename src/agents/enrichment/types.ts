/**
 * Types for enrichment functionality
 */

/**
 * Enrichment data structure for venues
 */
export interface EnrichmentData {
  venueName?: string;
  aiOverview?: string;
  eventManagerName?: string;
  eventManagerEmail?: string;
  eventManagerPhone?: string;
  commonEventTypes?: string[];
  inHouseCatering?: boolean;
  venueCapacity?: number;
  amenities?: string[] | string;
  pricingInformation?: string;
  preferredCaterers?: string[];
  website?: string;
  leadScore?: {
    score: number;
    reasons: string[];
    potential: 'high' | 'medium' | 'low';
    lastCalculated: string;
  };
  lastUpdated?: string;
  [key: string]: any;
}

/**
 * Result interface for batch operations
 */
export interface EnrichmentResult {
  success: boolean;
  message: string;
  results?: {
    processed?: number;
    total?: number;
    succeeded?: number;
    successful?: number;
    failed?: number;
    skipped?: number;
    errors?: string[];
  };
  error?: string;
  enrichedBusinesses?: any[];
}

/**
 * Enrichment API response
 */
export interface EnrichmentResponse {
  success: boolean;
  enrichmentData?: EnrichmentData;
  error?: string;
} 