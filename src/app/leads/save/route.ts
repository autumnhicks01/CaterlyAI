import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { Business } from '@/types/business';
import { GooglePlacesClient } from '@/lib/googleplaces';

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

// Modern Next.js API route handlers
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
    const { query, location, radius, coordinates } = body;
    
    if (!query) {
      return Response.json(
        { error: 'Missing required query parameter' },
        { status: 400 }
      );
    }
    
    // Use direct search with coordinates if available
    if (coordinates && coordinates.lat && coordinates.lng) {
      try {
        // Convert miles to meters for Google Places API
        const radiusInMeters = (radius || 25) * 1609.34;
        
        // Create a Google Places client for direct search
        const apiKey = process.env.GOOGLE_PLACES_API_KEY;
        if (!apiKey) {
          throw new Error('Google Places API key not configured');
        }
        
        console.log(`Using coordinates for direct search: ${coordinates.lat}, ${coordinates.lng}`);
        const googlePlacesClient = new GooglePlacesClient(apiKey);
        const results = await googlePlacesClient.searchPlacesByCoordinates(
          query, 
          coordinates.lat, 
          coordinates.lng, 
          radiusInMeters
        );
        
        // Deduplicate businesses
        const businesses = deduplicateBusinesses(results);
        
        // Return the results
        return Response.json({
          businesses,
          count: businesses.length,
          location: location || 'Unknown location',
          radius: radius || 25,
          coordinates
        });
      } catch (error) {
        console.error('Error searching with coordinates:', error);
        return Response.json(
          { error: 'Failed to search for businesses' },
          { status: 500 }
        );
      }
    } else {
      // No coordinates available
      return Response.json(
        { error: 'Location coordinates are required for business search' },
        { status: 400 }
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

// PATCH endpoint for enriching lead data
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
    
    // Process each business for basic enrichment
    const enrichedBusinesses = body.businesses.map((business: Business) => {
      if (!business.name || !business.address) {
        return { ...business, error: 'Missing required fields' };
      }
      
      // Create a simple description based on business information
      const description = `${business.name} is a ${business.type || 'business'} located at ${business.address}.`;
      
      // Return basic enrichment
      return { 
        ...business, 
        description: business.description || description,
        hasEventSpace: business.hasEventSpace || false
      };
    });
    
    return Response.json({
      businesses: enrichedBusinesses,
      count: enrichedBusinesses.length,
      message: 'Businesses enriched successfully'
    });
  } catch (error) {
    console.error('Business enrichment error:', error);
    return Response.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}