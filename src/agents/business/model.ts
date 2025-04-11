/**
 * Business model definitions for the business agent
 */

export interface Business {
  name: string;
  address: string;
  type: string;
  description: string;
  contact?: string;
  hasEventSpace?: boolean;
  // Additional fields from search API
  [key: string]: any;
}

export interface BusinessSearchParams {
  query: string;
  location: string;
  radius?: number;
}

export interface BusinessSearchResult {
  businesses: Business[];
  total: number;
}

export interface BusinessEnhanceResult {
  enhancedBusinesses: Business[];
  enhancementDetails?: string;
}

// Batch processing interfaces
export interface BusinessBatch {
  businesses: Business[];
  batchIndex: number;
}

export interface BusinessBatchResult {
  batchIndex: number;
  enhancedBusinesses: Business[];
} 