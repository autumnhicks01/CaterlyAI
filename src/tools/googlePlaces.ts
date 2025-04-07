import { z } from 'zod';
import { Business } from '@/types/business';

// Type definitions
export interface GooglePlacesToolInput {
  query: string;
  location: string;
  radius?: number;
}

// Google Places API functionality
async function searchPlaces(query: string, location: string, radius: number = 25000): Promise<Business[]> {
  try {
    console.log(`Searching Google Places: "${query}" in ${location} (${radius}m radius)`);
    
    // First, get coordinates for the location
    const geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
    const geocodingResponse = await fetch(geocodingUrl);
    const geocodingData = await geocodingResponse.json();
    
    if (!geocodingData.results || geocodingData.results.length === 0) {
      throw new Error(`Location not found: ${location}`);
    }
    
    const { lat, lng } = geocodingData.results[0].geometry.location;
    
    // Search for places using the coordinates
    const searchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&keyword=${encodeURIComponent(query)}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    
    if (searchData.status !== 'OK') {
      throw new Error(`Places API error: ${searchData.status} - ${searchData.error_message || 'Unknown error'}`);
    }
    
    // Convert Google Places results to our Business type
    const businesses: Business[] = await Promise.all(
      searchData.results.map(async (place: any) => {
        // Get place details for additional information
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,formatted_phone_number,website,url,types,photos&key=${process.env.GOOGLE_PLACES_API_KEY}`;
        const detailsResponse = await fetch(detailsUrl);
        const detailsData = await detailsResponse.json();
        
        const details = detailsData.result || {};
        
        return {
          id: place.place_id,
          name: place.name,
          address: details.formatted_address || place.vicinity,
          location: `${lat},${lng}`,
          type: place.types?.[0] || 'business',
          contact: {
            phone: details.formatted_phone_number,
            website: details.website
          },
          photos: place.photos?.map((photo: any) => 
            `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo.photo_reference}&key=${process.env.GOOGLE_PLACES_API_KEY}`
          ) || [],
          hasEventSpace: place.types?.some((type: string) => 
            ['event_venue', 'banquet_hall', 'conference_center', 'concert_hall', 'restaurant'].includes(type)
          ) || false
        };
      })
    );
    
    return businesses;
  } catch (error) {
    console.error('Google Places search error:', error);
    throw error;
  }
}

// Tool functionality without using Mastra's createTool yet
// We'll integrate with Mastra once we have the workflow implementation
export async function searchBusinessesWithGooglePlaces(query: string, location: string, radius: number = 25000) {
  try {
    const businesses = await searchPlaces(query, location, radius);
    
    return {
      businesses,
      count: businesses.length,
      location,
      query
    };
  } catch (error) {
    console.error('Google Places tool error:', error);
    return {
      error: error instanceof Error ? error.message : String(error),
      businesses: [] as Business[],
      count: 0,
      location,
      query
    };
  }
} 