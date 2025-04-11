/**
 * Lead scoring functionality
 */

import { EnrichmentData } from './types';

/**
 * Calculate lead score based on enrichment data
 */
export function calculateLeadScore(enrichmentData: any) {
  let score = 0;
  const reasons: string[] = [];
  
  // Contact information (up to 35 points) - crucial for lead scoring
  if (enrichmentData.eventManagerEmail) {
    score += 25; // Higher weight for email
    reasons.push('Has contact email');
  }
  
  if (enrichmentData.eventManagerPhone) {
    score += 10;
    reasons.push('Has contact phone');
  }
  
  if (enrichmentData.eventManagerName) {
    score += 5;
    reasons.push('Has contact name');
  }
  
  // Event hosting capabilities (up to 30 points)
  if (enrichmentData.venueCapacity && enrichmentData.venueCapacity > 50) {
    score += 15;
    reasons.push(`Venue capacity: ${enrichmentData.venueCapacity}`);
  }
  
  if (enrichmentData.commonEventTypes && enrichmentData.commonEventTypes.length > 0) {
    score += 10;
    reasons.push(`Hosts events: ${enrichmentData.commonEventTypes.join(', ')}`);
  }
  
  if (enrichmentData.pricingInformation) {
    score += 5;
    reasons.push('Pricing information available');
  }
  
  // Catering relationship (up to 25 points)
  if (enrichmentData.inHouseCatering === false) {
    // Venues without in-house catering are better leads
    score += 25;
    reasons.push('No in-house catering (potential for partnership)');
  } else if (enrichmentData.inHouseCatering === true) {
    // Venues with in-house catering may still need backup
    score += 5;
    reasons.push('Has in-house catering');
  }
  
  // Website/data quality (up to 10 points)
  if (enrichmentData.website) {
    score += 5;
    reasons.push('Has functional website');
  }
  
  if (enrichmentData.aiOverview && enrichmentData.aiOverview.length > 100) {
    score += 5;
    reasons.push('Has detailed venue description');
  }
  
  // Cap score at 100
  score = Math.min(score, 100);
  
  // Determine potential level
  let potential: 'high' | 'medium' | 'low' = 'low';
  if (score >= 70) {
    potential = 'high';
  } else if (score >= 40) {
    potential = 'medium';
  }
  
  return {
    score,
    reasons,
    potential,
    lastCalculated: new Date().toISOString()
  };
}

/**
 * Extract additional data from website content
 */
export function extractAdditionalData(data: EnrichmentData, content: string, leadInfo: any): EnrichmentData {
  try {
    // We'll pull extraction functions from utils.ts
    // This is a placeholder to avoid circular dependencies
    return data;
  } catch (error) {
    console.error('[ENRICHMENT-AGENT] Error in extractAdditionalData:', error);
    return data;
  }
} 