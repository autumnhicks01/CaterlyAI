/**
 * Utility functions for enrichment operations
 */

/**
 * Normalize URL function
 */
export function normalizeUrl(url: string): string {
  try {
    // Make sure URL starts with http:// or https://
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    // Parse the URL to get just the origin (protocol + hostname)
    const parsedUrl = new URL(url);
    return parsedUrl.origin;
  } catch (error) {
    console.error(`[EnrichmentAgent] Error normalizing URL ${url}:`, error);
    return url; // Return original if parsing fails
  }
}

/**
 * Extract emails from content
 */
export function extractEmails(content: string): string[] {
  if (!content) return [];
  
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const matches = content.match(emailPattern) || [];
  
  // Filter out common false positives
  const filteredEmails = [...new Set(matches)].filter(email => {
    // Skip common false positives
    return !(email.includes('example.com') || 
        email.includes('yourdomain.com') || 
        email.includes('domain.com') || 
        email.includes('@email') ||
        email.includes('your@') ||
        email.includes('user@') ||
        email.includes('name@') ||
        email.includes('email@') ||
        email.includes('info@example') ||
        email.includes('test@') ||
        email.includes('username@') ||
        email.includes('no-reply@'));
  });
  
  // Try to find event-related emails first
  const eventEmails = filteredEmails.filter(email => 
    email.includes('event') || 
    email.includes('catering') || 
    email.includes('booking') || 
    email.includes('sales') || 
    email.includes('venue') ||
    email.includes('reservation') ||
    email.includes('events') ||
    email.includes('book') ||
    email.includes('inquiry')
  );
  
  // If we have event-related emails, prioritize them
  if (eventEmails.length > 0) {
    console.log(`[EnrichmentAgent] Found ${eventEmails.length} event-related emails: ${eventEmails.join(', ')}`);
    return eventEmails;
  }
  
  // Sort general emails to prioritize more legitimate-looking ones
  // Prefer shorter domains and addresses that don't start with common prefixes
  const sortedEmails = filteredEmails.sort((a, b) => {
    // Prefer emails that aren't generic
    const aIsGeneric = a.startsWith('info@') || a.startsWith('contact@') || a.startsWith('hello@');
    const bIsGeneric = b.startsWith('info@') || b.startsWith('contact@') || b.startsWith('hello@');
    
    if (aIsGeneric && !bIsGeneric) return 1;
    if (!aIsGeneric && bIsGeneric) return -1;
    
    // Prefer shorter domain parts (likely the primary domain)
    const aDomain = a.split('@')[1];
    const bDomain = b.split('@')[1];
    if (aDomain.length !== bDomain.length) {
      return aDomain.length - bDomain.length;
    }
    
    // Prefer shorter email addresses overall
    return a.length - b.length;
  });
  
  console.log(`[EnrichmentAgent] Found ${sortedEmails.length} total emails after filtering`);
  return sortedEmails;
}

/**
 * Extract phone numbers from content
 */
export function extractPhones(content: string): string[] {
  if (!content) return [];
  
  const phonePattern = /(?:\+1|1)?\s*\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/g;
  const matches = content.match(phonePattern) || [];
  
  return [...new Set(matches)];
}

/**
 * Extract venue capacity from content
 */
export function extractVenueCapacity(content: string): number | null {
  try {
    const capacityPattern = /(?:capacity|accommodate|up to|maximum)[^\d]*(\d+)[^\d]*(guest|people|person|attendee|seat)/i;
    const match = content.match(capacityPattern);
    
    if (match && match[1]) {
      const capacity = parseInt(match[1]);
      if (!isNaN(capacity) && capacity > 20 && capacity < 2000) {
        return capacity;
      }
    }
    return null;
  } catch (error) {
    console.error('[EnrichmentAgent] Error extracting venue capacity:', error);
    return null;
  }
}

/**
 * Extract event types from content
 */
export function extractEventTypes(content: string): string[] {
  const eventKeywords = [
    'wedding', 'corporate', 'meeting', 'social', 'party', 'conference',
    'celebration', 'ceremony', 'reception', 'seminar', 'retreat', 'gala'
  ];
  
  return eventKeywords
    .filter(keyword => content.toLowerCase().includes(keyword))
    .map(keyword => keyword.charAt(0).toUpperCase() + keyword.slice(1));
}

/**
 * Check for in-house catering
 */
export function checkForInHouseCatering(content: string): boolean {
  const lowerContent = content.toLowerCase();
  
  // Patterns suggesting in-house catering
  const inHousePatterns = [
    'in-house catering', 'our catering', 'catering services provided',
    'on-site catering', 'our chef', 'our culinary team'
  ];
  
  // Patterns suggesting outside catering
  const outsidePatterns = [
    'preferred caterers', 'approved caterers', 'outside catering',
    'select from our list of caterers', 'catering not provided'
  ];
  
  // Check for in-house patterns
  for (const pattern of inHousePatterns) {
    if (lowerContent.includes(pattern)) {
      return true;
    }
  }
  
  // Check for outside patterns
  for (const pattern of outsidePatterns) {
    if (lowerContent.includes(pattern)) {
      return false;
    }
  }
  
  // Default to null if unclear
  return false;
}

/**
 * Create fallback data when AI fails
 */
export function createFallbackData(leadInfo: any): any {
  return {
    venueName: leadInfo.name,
    website: leadInfo.website || '',
    eventManagerPhone: leadInfo.phone || '',
    eventManagerEmail: leadInfo.email || '',
    aiOverview: `${leadInfo.name} is a ${leadInfo.type || 'venue'} located at ${leadInfo.address || 'an unknown location'}.`,
    commonEventTypes: ['Wedding', 'Corporate', 'Social'],
    amenities: []
  };
} 