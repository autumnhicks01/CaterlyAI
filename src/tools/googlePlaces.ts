import { z } from 'zod';
import { Business } from '@/types/business';

// Type definitions
export interface GooglePlacesToolInput {
  query: string;
  location: string;
  radius?: number;
}

// Google Places API Service class
export class GooglePlacesService {
  async searchPlaces(query: string, location: string, radius: number = 25): Promise<any[]> {
    try {
      // Convert miles to meters for Google API
      const radiusInMeters = radius * 1609;
      console.log(`Searching Google Places: "${query}" in ${location} (${radius} miles / ${radiusInMeters}m radius)`);
      
      // Check if location is in coordinate format
      const coordinateRegex = /^(-?\d+(\.\d+)?),(-?\d+(\.\d+)?)$/;
      const isCoordinates = coordinateRegex.test(location);
      
      let locationParam = location;
      let lat: number;
      let lng: number;
      
      if (isCoordinates) {
        // Parse coordinates directly
        console.log('Using coordinates directly for search');
        const [latStr, lngStr] = location.split(',');
        lat = parseFloat(latStr);
        lng = parseFloat(lngStr);
        locationParam = `${lat},${lng}`;
      } else {
        // For non-coordinate locations, we'll fail with helpful error message
        console.error('Location must be in coordinate format (lat,lng)');
        throw new Error('Location must be in coordinate format (lat,lng)');
      }
      
      // Fast search approach - directly get businesses with all needed fields in a single request
      
      // Search for places using the location parameter directly
      const searchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${locationParam}&radius=${radiusInMeters}&keyword=${encodeURIComponent(query)}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
      
      console.log(`Making Google Places API request to: ${searchUrl.replace(process.env.GOOGLE_PLACES_API_KEY || '', 'API_KEY')}`);
      
      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();
      
      if (searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
        console.error('Google Places API error:', searchData);
        throw new Error(`Places API error: ${searchData.status} - ${searchData.error_message || 'Unknown error'}`);
      }
      
      if (searchData.status === 'ZERO_RESULTS' || !searchData.results || searchData.results.length === 0) {
        console.log('No results found in Google Places API');
        return [];
      }
      
      console.log(`Google Places API returned ${searchData.results?.length || 0} results`);
      
      // Convert Google Places results in a streamlined way
      const businesses: any[] = [];
      
      // Process places in parallel for speed using Promise.all
      await Promise.all(
        searchData.results.map(async (place: any) => {
          try {
            // Get place details for additional information - focused only on required fields
            const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,formatted_phone_number,website,types&key=${process.env.GOOGLE_PLACES_API_KEY}`;
            
            const detailsResponse = await fetch(detailsUrl);
            const detailsData = await detailsResponse.json();
            
            const details = detailsData.result || {};
            
            // Skip places without a website since it's required
            if (!details.website) {
              console.log(`Skipping ${place.name} - No website available`);
              return;
            }
            
            // Create the business object with all fields for maximum compatibility
            const business = {
              place_id: place.place_id,
              id: place.place_id,
              name: place.name,
              formatted_address: details.formatted_address || place.vicinity || '',
              address: details.formatted_address || place.vicinity || '',
              formatted_phone_number: details.formatted_phone_number || '',
              phone: details.formatted_phone_number || '',
              website: details.website || '',
              types: details.types || place.types || [],
              type: place.types?.[0] || 'business',
              contact: {
                phone: details.formatted_phone_number || '',
                website: details.website || ''
              },
              location: {
                lat,
                lng
              },
              hasEventSpace: place.types?.some((type: string) => 
                ['event_venue', 'banquet_hall', 'conference_center', 'concert_hall', 'restaurant'].includes(type)
              ) || false
            };
            
            businesses.push(business);
          } catch (error) {
            console.error(`Error fetching details for place ${place.name}:`, error);
          }
        })
      );
      
      console.log(`Successfully processed ${businesses.length} businesses with websites`);
      return businesses;
    } catch (error) {
      console.error('Google Places search error:', error);
      throw error;
    }
  }
}

// Legacy function - kept for backward compatibility
export async function searchPlaces(query: string, location: string, radius: number = 25000): Promise<Business[]> {
  const service = new GooglePlacesService();
  const results = await service.searchPlaces(query, location, radius / 1609); // Convert meters to miles
  return results as Business[];
}

// Tool functionality without using Mastra's createTool yet
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