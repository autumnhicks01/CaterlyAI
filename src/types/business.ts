// Business types for the application

// Business entity
export interface Business {
  id?: string;
  name: string;
  address: string;
  location?: {
    lat: number;
    lng: number;
  };
  contact?: {
    phone?: string;
    website?: string;
    email?: string;
  };
  photos?: string[];
  type?: string;
  description?: string;
  hasEventSpace?: boolean;
}

// Input for enrichment
export interface EnrichmentInput {
  name: string;
  address: string;
  phone?: string;
  website?: string;
}

// Response from enrichment
export interface EnrichmentResponse {
  website?: string;
  description?: string;
  phoneNumber?: string;
  phone?: string;
  hasEventSpace?: boolean;
  type?: string;
  error?: string;
}

// Response from business search
export interface BusinessSearchResponse {
  businesses: Business[];
  count: number;
  location?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  error?: string;
}

// Request for business search
export interface BusinessSearchRequest {
  query: string;
  location?: string;
  radius?: number; // in miles
  coordinates?: {
    lat: number;
    lng: number;
  };
} 