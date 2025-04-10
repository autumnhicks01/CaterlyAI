/**
 * Types for the URL enrichment test module
 */

/**
 * Represents the status of an enrichment job
 */
export interface EnrichmentJob {
  status: 'validating' | 'extracting' | 'processing' | 'generating' | 'complete' | 'error';
  startedAt?: string;
  elapsedMs?: number;
  message?: string;
  result?: EnrichmentResult;
}

/**
 * Represents the lead score calculated by AI
 */
export interface LeadScore {
  score: number;
  potential: 'high' | 'medium' | 'low';
  reasons: string[];
  lastCalculated: string;
}

/**
 * Management contact information
 */
export interface ManagementContact {
  managementContactName?: string;
  managementContactEmail?: string;
  managementContactPhone?: string;
}

/**
 * Contact information
 */
export interface ContactInformation {
  email?: string;
  phone?: string;
  contactPersonName?: string;
}

/**
 * Event details
 */
export interface EventDetail {
  eventDate?: string;
  eventName?: string;
}

/**
 * Firecrawl extracted data
 */
export interface FirecrawlExtracted {
  venueName?: string;
  amenities?: string[];
  eventTypes?: string[];
  eventDetails?: EventDetail[];
  venueCapacity?: number | null;
  inHouseCatering?: boolean;
  physicalAddress?: string;
  managementContact?: ManagementContact;
  preferredCaterers?: string[];
  contactInformation?: ContactInformation;
  pricingInformation?: string;
}

/**
 * Represents the enrichment data for a venue
 */
export interface EnrichmentResult {
  url: string;
  domain: string;
  venueName?: string;
  address?: string;
  website?: string;
  description?: string;
  venue_capacity?: number;
  venueCapacity?: number;
  in_house_catering?: boolean;
  inHouseCatering?: boolean;
  event_manager_name?: string;
  event_manager_email?: string;
  eventManagerEmail?: string;
  event_manager_phone?: string;
  eventManagerPhone?: string;
  common_event_types?: string[];
  commonEventTypes?: string[];
  amenities?: string[];
  preferredCaterers?: string[];
  ai_overview?: string;
  aiOverview?: string;
  additionalDetails?: string;
  lead_score?: LeadScore;
  leadScore?: LeadScore;
  lastUpdated?: string;
  business_id?: string;
  firecrawlExtracted?: FirecrawlExtracted;
  extracted_content?: string;
  processed_at?: string;
} 