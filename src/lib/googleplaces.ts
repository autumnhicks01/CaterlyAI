import { Business } from "@/types/business";

/**
 * Client for the Google Places API
 */
export class GooglePlacesClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Search places by text query and location
   */
  async searchPlaces(query: string, location: string, radius: number = 25000): Promise<Business[]> {
    try {
      // First geocode the location
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${this.apiKey}`;
      const geocodeResponse = await fetch(geocodeUrl);
      const geocodeData = await geocodeResponse.json();

      if (geocodeData.status !== 'OK' || !geocodeData.results[0]) {
        console.error('Geocode response error:', geocodeData);
        throw new Error(`Failed to geocode location: ${geocodeData.status}`);
      }

      const { lat, lng } = geocodeData.results[0].geometry.location;
      return this.searchPlacesByCoordinates(query, lat, lng, radius);
    } catch (error) {
      console.error('Error in searchPlaces:', error);
      throw error;
    }
  }

  /**
   * Search places by text query and coordinates
   */
  async searchPlacesByCoordinates(query: string, lat: number, lng: number, radius: number = 25000): Promise<Business[]> {
    try {
      const location = `${lat},${lng}`;
      const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${location}&radius=${radius}&key=${this.apiKey}`;
      
      const response = await fetch(searchUrl);
      const data = await response.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.error('Places API response error:', data);
        throw new Error(`Places API error: ${data.status}`);
      }

      if (!data.results || data.results.length === 0) {
        return [];
      }

      // For each place, get detailed information including website
      const placesWithDetails = await Promise.all(
        data.results.slice(0, 20).map(async (place: any) => {
          try {
            const placeDetails = await this.getPlaceDetails(place.place_id);
            return {
              ...place,
              website: placeDetails.website || '',
              formatted_phone_number: placeDetails.formatted_phone_number || '',
              international_phone_number: placeDetails.international_phone_number || '',
              // Include other details we might need
            };
          } catch (error) {
            console.error(`Error getting details for place ${place.place_id}:`, error);
            return place; // Return original place data if details fetch fails
          }
        })
      );

      // Transform to our Business model
      return placesWithDetails.map((place: any) => {
        return {
          id: place.place_id,
          name: place.name,
          address: place.formatted_address,
          location: {
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng
          },
          contact: {
            phone: place.formatted_phone_number || place.international_phone_number || '',
            website: place.website || '',
            email: ''
          },
          photos: place.photos ? place.photos.map((photo: any) => 
            `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo.photo_reference}&key=${this.apiKey}`
          ) : [],
          type: place.types ? place.types[0] : 'business'
        };
      });
    } catch (error) {
      console.error('Error in searchPlacesByCoordinates:', error);
      throw error;
    }
  }

  /**
   * Get detailed information for a place by its ID
   */
  async getPlaceDetails(placeId: string): Promise<any> {
    try {
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,website,formatted_phone_number,international_phone_number&key=${this.apiKey}`;
      const response = await fetch(detailsUrl);
      const data = await response.json();

      if (data.status !== 'OK') {
        console.error('Place details API error:', data);
        return {}; // Return empty object if details request fails
      }

      return data.result || {};
    } catch (error) {
      console.error(`Error fetching details for place ${placeId}:`, error);
      return {}; // Return empty object if details request fails
    }
  }
} 