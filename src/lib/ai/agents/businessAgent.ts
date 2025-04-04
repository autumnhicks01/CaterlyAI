import { createAI, createTool } from 'ai';
import { googlePlacesTool } from '@/lib/ai/tools/googlePlacesTool';
import { openAIEnrichmentTool } from '@/lib/ai/tools/openAITool';
import { NextRequest } from 'next/server';
import { BUSINESS_ROUTER_PROMPT } from '@/lib/ai/prompts/router';
import { getUserProfile } from '@/lib/user-profile';
import { auth } from '@/auth';
import { Business, EnrichmentInput, BusinessSearchResponse } from '@/types/business';
import { GooglePlacesClient } from '@/lib/googleplaces';

// Create the business agent
const businessAI = createAI({
  actions: {
    searchBusinesses: async (query: string, location: string, radius: number = 25) => {
      try {
        // Convert miles to meters for Google Places API
        const radiusInMeters = radius * 1609.34;
        
        const result = await googlePlacesTool.execute({
          query,
          location,
          radius: radiusInMeters
        });
        
        return JSON.stringify(result);
      } catch (error) {
        console.error('Search businesses error:', error);
        return JSON.stringify({ error: String(error), businesses: [], count: 0 });
      }
    },
    enrichBusiness: async (business: Business) => {
      try {
        if (!business.name || !business.address) {
          return JSON.stringify({ ...business, error: 'Missing required fields' });
        }
        
        // Log the incoming business data
        console.log(`Enriching business: ${business.name}`, {
          address: business.address,
          phone: business.contact?.phone,
          website: business.contact?.website,
          type: business.type
        });
        
        const enrichResult = await openAIEnrichmentTool.execute({
          name: business.name,
          address: business.address,
          phone: business.contact?.phone || '',
          website: business.contact?.website || ''
        } as EnrichmentInput);
        
        // Log enrichment result
        console.log(`Enrichment result for ${business.name}:`, enrichResult);
        
        // Prepare improved contact data
        const contactData = {
          phone: business.contact?.phone || enrichResult.phone || '',
          website: business.contact?.website || enrichResult.website || '',
          email: business.contact?.email || ''
        };
        
        // Merge original business with enriched data
        const enrichedBusiness = {
          ...business,
          type: business.type || enrichResult.type || 'point_of_interest',
          description: enrichResult.description || business.description || '',
          contact: contactData,
          hasEventSpace: enrichResult.hasEventSpace || false
        };
        
        return JSON.stringify(enrichedBusiness);
      } catch (error) {
        console.error(`Error enriching business ${business.name}:`, error);
        return JSON.stringify({ ...business, enrichmentError: String(error) });
      }
    }
  },
  tools: [googlePlacesTool, openAIEnrichmentTool]
});

// Function to deduplicate businesses 
function deduplicateBusinesses(businesses: Business[]): Business[] {
  const uniqueBizMap = new Map<string, Business>();
  
  for (const business of businesses) {
    // Create a normalized key
    const key = `${business.name.toLowerCase().replace(/\W/g, '')}-${
      business.address.toLowerCase().replace(/\W/g, '')
    }`;
    
    if (!uniqueBizMap.has(key)) {
      uniqueBizMap.set(key, business);
    } else {
      // Merge with existing business
      const existing = uniqueBizMap.get(key)!;
      const merged = {
        ...existing,
        // Keep non-empty values from both
        contact: {
          phone: existing.contact?.phone || business.contact?.phone || '',
          website: existing.contact?.website || business.contact?.website || '',
          email: existing.contact?.email || business.contact?.email || ''
        },
        // Keep any photos from either
        photos: [...(existing.photos || []), ...(business.photos || [])]
      };
      uniqueBizMap.set(key, merged);
    }
  }
  
  return Array.from(uniqueBizMap.values());
}

// Export routes
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return Response.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const body = await req.json();
    const { query, radius } = body;
    
    if (!query) {
      return Response.json(
        { error: 'Missing required query parameter' },
        { status: 400 }
      );
    }
    
    // Get user profile for location data
    const profile = await getUserProfile(session.user.id);
    
    if (!profile || !profile.full_address) {
      return Response.json(
        { error: 'User profile or location not found' },
        { status: 400 }
      );
    }
    
    // Check if we have stored coordinates in user_input_data
    let userCoordinates = null;
    if (profile.user_input_data && 
        typeof profile.user_input_data === 'object' && 
        'coordinates' in profile.user_input_data && 
        profile.user_input_data.coordinates) {
      
      userCoordinates = profile.user_input_data.coordinates as {lat: number, lng: number};
      console.log(`Found stored coordinates: ${userCoordinates.lat}, ${userCoordinates.lng}`);
    }
    
    // Use the full address without parsing
    const location = profile.full_address;
    const serviceRadius = radius || profile.service_radius || 25;
    
    console.log(`Searching for "${query}" in ${location} (${serviceRadius} miles)`);
    
    // Use the AI to perform the search
    const { searchBusinesses } = businessAI.actions;
    let searchResult;
    
    // Use coordinates if available for more precise search
    if (userCoordinates) {
      console.log(`Using coordinates for search: ${userCoordinates.lat}, ${userCoordinates.lng}`);
      // Directly call the Google Places tool via custom searchPlacesByCoordinates method
      try {
        // Convert miles to meters for Google Places API
        const radiusInMeters = serviceRadius * 1609.34;
        
        // Create a Google Places client for direct search
        const apiKey = process.env.GOOGLE_PLACES_API_KEY;
        if (!apiKey) {
          throw new Error('Google Places API key not configured');
        }
        
        const googlePlacesClient = new GooglePlacesClient(apiKey);
        const results = await googlePlacesClient.searchPlacesByCoordinates(
          query, 
          userCoordinates.lat, 
          userCoordinates.lng, 
          radiusInMeters
        );
        
        // Format results to match what the AI would return
        searchResult = JSON.stringify({
          businesses: results,
          count: results.length,
          location: location,
          coordinates: userCoordinates
        });
      } catch (error) {
        console.error('Error searching with coordinates:', error);
        // Fall back to regular AI search if direct coordinate search fails
        searchResult = await searchBusinesses(query, location, serviceRadius);
      }
    } else {
      searchResult = await searchBusinesses(query, location, serviceRadius);
    }
    
    // Parse and process the results
    try {
      const resultData = JSON.parse(searchResult) as BusinessSearchResponse;
      
      if (!resultData.businesses || !resultData.businesses.length) {
        return Response.json({
          businesses: [],
          count: 0,
          message: 'No businesses found'
        });
      }
      
      // Deduplicate and process businesses
      const businesses = deduplicateBusinesses(resultData.businesses);
      
      // Return the results
      return Response.json({
        businesses,
        count: businesses.length,
        location,
        radius: serviceRadius
      });
    } catch (error) {
      console.error('Error parsing AI response:', error);
      console.log('Raw response:', searchResult);
      
      return Response.json(
        { error: 'Failed to parse search results' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Business search error:', error);
    return Response.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return Response.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const body = await req.json();
    
    if (!body.businesses || !Array.isArray(body.businesses)) {
      return Response.json(
        { error: 'Missing or invalid businesses array' },
        { status: 400 }
      );
    }
    
    // Process each business for enrichment
    const { enrichBusiness } = businessAI.actions;
    const enrichmentPromises = body.businesses.map(async (business: Business) => {
      const enrichResult = await enrichBusiness(business);
      return JSON.parse(enrichResult);
    });
    
    // Wait for all enrichments to complete
    const enrichedBusinesses = await Promise.all(enrichmentPromises);
    
    return Response.json({
      businesses: enrichedBusinesses,
      count: enrichedBusinesses.length
    });
  } catch (error) {
    console.error('Business enrichment error:', error);
    return Response.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}