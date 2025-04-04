import { openai } from '@ai-sdk/openai';
import { GooglePlacesClient } from '@/lib/googleplaces';
import { Business, BusinessSearchResponse } from '@/types/business';
import { BUSINESS_ROUTER_PROMPT } from '@/lib/ai/prompts/router';

// Tool definition for Google Places search
const googlePlacesSearch = {
  name: 'google_places_search',
  description: 'Search for businesses using Google Places API',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query for finding businesses'
      },
      location: {
        type: 'string',
        description: 'The location to search in (address or city)'
      },
      radius: {
        type: 'number',
        description: 'The search radius in meters'
      }
    },
    required: ['query', 'location']
  },
  handler: async ({ query, location, radius = 25000 }: { 
    query: string; 
    location: string; 
    radius?: number;
  }): Promise<BusinessSearchResponse> => {
    try {
      const apiKey = process.env.GOOGLE_PLACES_API_KEY;
      if (!apiKey) {
        throw new Error('Google Places API key not configured');
      }
      
      const client = new GooglePlacesClient(apiKey);
      const results = await client.searchPlaces(query, location, radius);
      
      return { 
        businesses: results,
        count: results.length,
        location
      };
    } catch (error) {
      console.error('Google Places search error:', error);
      return { error: String(error), businesses: [], count: 0 };
    }
  }
};

// Tool definition for business enrichment
const businessEnrichment = {
  name: 'business_enrichment',
  description: 'Enrich business data with additional information',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Business name'
      },
      address: {
        type: 'string',
        description: 'Business address'
      },
      phone: {
        type: 'string',
        description: 'Business phone number'
      },
      website: {
        type: 'string',
        description: 'Business website'
      }
    },
    required: ['name', 'address']
  },
  handler: async ({ name, address, phone = '', website = '' }: { 
    name: string; 
    address: string; 
    phone?: string; 
    website?: string;
  }) => {
    try {
      // Only use real website data, no placeholders
      if (!website || website === 'not available' || website === 'N/A') {
        // Skip businesses without websites
        console.log(`No website for ${name}, skipping enrichment`);
        return { 
          error: 'No website available',
          website: '',
          description: '',
          phone: phone || ''
        };
      }
      
      return {
        website: website,
        description: `${name} is a business located at ${address}.`,
        phone: phone || '',
        hasEventSpace: false,
        type: 'business'
      };
    } catch (error) {
      console.error('Business enrichment error:', error);
      return { error: String(error) };
    }
  }
};

// Search for businesses using AI and Google Places
export async function searchBusinesses(
  query: string,
  location: string,
  radius: number = 25,
  coordinates?: { lat: number; lng: number }
): Promise<BusinessSearchResponse> {
  try {
    // If coordinates are provided, use direct search
    if (coordinates) {
      console.log(`Using coordinates for search: ${coordinates.lat}, ${coordinates.lng}`);
      // Convert miles to meters for Google Places API
      const radiusInMeters = radius * 1609.34;
      
      const apiKey = process.env.GOOGLE_PLACES_API_KEY;
      if (!apiKey) {
        throw new Error('Google Places API key not configured');
      }
      
      // Get detailed place information including websites
      const client = new GooglePlacesClient(apiKey);
      const results = await client.searchPlacesByCoordinates(
        query, 
        coordinates.lat, 
        coordinates.lng, 
        radiusInMeters
      );
      
      // Only use places with actual websites, limit to 20 for performance
      const validBusinesses = results
        .filter(business => business.contact?.website && 
                           business.contact.website !== '' && 
                           business.contact.website !== 'not available')
        .slice(0, 20);
      
      console.log(`Found ${results.length} businesses, filtered to ${validBusinesses.length} with valid websites`);
      
      return {
        businesses: validBusinesses,
        count: validBusinesses.length,
        location,
        coordinates
      };
    }
    
    // If no coordinates, use the Google Places API
    console.log(`Searching for "${query}" in ${location} (${radius} miles)`);
    
    // Convert miles to meters for Google Places API
    const radiusInMeters = radius * 1609.34;
    
    // Use the GooglePlacesSearch tool directly
    const results = await googlePlacesSearch.handler({
      query,
      location,
      radius: radiusInMeters
    });
    
    // Only use places with actual websites, limit to 20 for performance
    if (results.businesses && Array.isArray(results.businesses)) {
      const validBusinesses = results.businesses
        .filter(business => business.contact?.website && 
                           business.contact.website !== '' && 
                           business.contact.website !== 'not available')
        .slice(0, 20);
      
      console.log(`Found ${results.businesses.length} businesses, filtered to ${validBusinesses.length} with valid websites`);
      
      return {
        businesses: validBusinesses,
        count: validBusinesses.length,
        location
      };
    }
    
    return results;
  } catch (error) {
    console.error('Business search error:', error);
    return { error: String(error), businesses: [], count: 0 };
  }
}

// Enrich businesses with additional information
export async function enrichBusinesses(
  businesses: Business[]
): Promise<BusinessSearchResponse> {
  try {
    if (!businesses || !Array.isArray(businesses) || businesses.length === 0) {
      return {
        businesses: [],
        count: 0,
        error: 'No businesses provided for enrichment'
      };
    }
    
    // Process each business for enrichment
    const enrichmentPromises = businesses.map(async (business: Business) => {
      if (!business.name || !business.address) {
        return { ...business, error: 'Missing required fields for enrichment' };
      }
      
      console.log(`Enriching business: ${business.name}`, {
        address: business.address,
        phone: business.contact?.phone,
        website: business.contact?.website,
        type: business.type
      });
      
      const enrichResult = await businessEnrichment.handler({
        name: business.name,
        address: business.address,
        phone: business.contact?.phone || '',
        website: business.contact?.website || ''
      });
      
      console.log(`Enrichment result for ${business.name}:`, enrichResult);
      
      // Prepare improved contact data
      const contactData = {
        phone: business.contact?.phone || enrichResult.phone || '',
        website: business.contact?.website || enrichResult.website || '',
        email: business.contact?.email || ''
      };
      
      // Merge original business with enriched data
      return {
        ...business,
        type: business.type || enrichResult.type || 'point_of_interest',
        description: enrichResult.description || business.description || '',
        contact: contactData,
        hasEventSpace: enrichResult.hasEventSpace || false
      };
    });
    
    // Wait for all enrichments to complete
    const enrichedBusinesses = await Promise.all(enrichmentPromises);
    
    return {
      businesses: enrichedBusinesses,
      count: enrichedBusinesses.length
    };
  } catch (error) {
    console.error('Business enrichment error:', error);
    return { 
      businesses: businesses,
      count: businesses.length,
      error: String(error)
    };
  }
} 