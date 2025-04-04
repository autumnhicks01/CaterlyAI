import { createTool } from 'ai';
import { GooglePlacesClient } from '@/lib/googleplaces';
import { Business, BusinessSearchResponse } from '@/types/business';

interface GooglePlacesToolInput {
  query: string;
  location: string;
  radius?: number;
}

export const googlePlacesTool = createTool({
  name: 'google-places-search',
  description: 'Search businesses in a given location using Google Places',
  schema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      location: { type: 'string' },
      radius: { type: 'number', default: 25000 }
    },
    required: ['query', 'location']
  },
  execute: async ({ query, location, radius = 25000 }: GooglePlacesToolInput): Promise<BusinessSearchResponse> => {
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
});