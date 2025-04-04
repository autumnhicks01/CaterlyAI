import { openai } from "@ai-sdk/openai";
import { createStreamableUI } from "ai/rsc";
import { NextRequest, NextResponse } from "next/server";
import { getUserProfile } from "@/lib/user-profile";
import { auth } from "@/auth";
import { GooglePlacesClient } from "@/lib/googleplaces";
import { Business, BusinessSearchResponse } from "@/types/business";
import { z } from "zod";

export const maxDuration = 60;

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

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const body = await req.json();
    const { query, radius, coordinates: requestCoordinates } = body;
    
    if (!query) {
      return NextResponse.json(
        { error: 'Missing required query parameter' },
        { status: 400 }
      );
    }
    
    // Get user profile for location data
    const profile = await getUserProfile(session.user.id);
    
    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 400 }
      );
    }
    
    // Check for location using the right field name (full_address)
    const userLocation = profile.full_address;
    
    if (!userLocation) {
      return NextResponse.json(
        { error: 'User location not found' },
        { status: 400 }
      );
    }
    
    // Coordinates priority: request coordinates over profile coordinates
    let userCoordinates = null;
    
    // First use coordinates from the request if available
    if (requestCoordinates && 
        typeof requestCoordinates === 'object' &&
        typeof requestCoordinates.lat === 'number' && 
        typeof requestCoordinates.lng === 'number' &&
        !isNaN(requestCoordinates.lat) &&
        !isNaN(requestCoordinates.lng)) {
      userCoordinates = requestCoordinates;
      console.log(`Using coordinates from request: ${requestCoordinates.lat}, ${requestCoordinates.lng}`);
    } 
    // Fallback to coordinates from profile's user_input_data
    else if (profile.user_input_data && 
             typeof profile.user_input_data === 'object' &&
             profile.user_input_data.coordinates &&
             typeof profile.user_input_data.coordinates === 'object' &&
             typeof profile.user_input_data.coordinates.lat === 'number' && 
             typeof profile.user_input_data.coordinates.lng === 'number' &&
             !isNaN(profile.user_input_data.coordinates.lat) &&
             !isNaN(profile.user_input_data.coordinates.lng)) {
      userCoordinates = profile.user_input_data.coordinates;
      console.log(`Using coordinates from profile: ${userCoordinates.lat}, ${userCoordinates.lng}`);
    } else {
      console.log('No valid coordinates found in request or profile');
    }
    
    try {
      // Use the full address directly without parsing
      const location = userLocation;
      const serviceRadius = radius || profile.delivery_radius || 25;
      
      console.log(`Searching for "${query}" in ${location} (${serviceRadius} miles)`);
      
      // Directly use Google Places to search
      try {
        const apiKey = process.env.GOOGLE_PLACES_API_KEY;
        if (!apiKey) {
          throw new Error('Google Places API key not configured');
        }
        
        const client = new GooglePlacesClient(apiKey);
        // Convert miles to meters for Google Places API
        const radiusInMeters = serviceRadius * 1609.34;
        
        // Use the full address for more accurate results
        let results;
        
        // If we have coordinates, use them for more accurate search
        if (userCoordinates) {
          results = await client.searchPlacesByCoordinates(
            query, 
            userCoordinates.lat, 
            userCoordinates.lng, 
            radiusInMeters
          );
        } else {
          // Fall back to searching by location string
          console.log(`Searching by location string`);
          results = await client.searchPlaces(query, location, radiusInMeters);
        }
        
        // Deduplicate businesses
        const businesses = deduplicateBusinesses(results);
        
        // Return the results
        return NextResponse.json({
          businesses,
          count: businesses.length,
          location,
          radius: serviceRadius
        });
      } catch (error: any) {
        console.error('Error searching businesses:', error);
        
        // Provide more specific error for location not found
        if (error.message && error.message.includes('Location not found')) {
          return NextResponse.json(
            { error: `Error: Location not found: ${userLocation}` },
            { status: 400 }
          );
        }
        
        return NextResponse.json(
          { error: String(error) },
          { status: 500 }
        );
      }
    } catch (error) {
      console.error('Error in lead search:', error);
      return NextResponse.json(
        { error: `Error with location: ${userLocation}. Please check your address in your profile.` },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Business search error:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const body = await req.json();
    
    if (!body.businesses || !Array.isArray(body.businesses)) {
      return NextResponse.json(
        { error: 'Missing or invalid businesses array' },
        { status: 400 }
      );
    }
    
    const businesses = body.businesses as Business[];
    
    // Process each business for enrichment using direct API calls instead
    const enrichmentPromises = businesses.map(async (business: Business) => {
      if (!business.name || !business.address) {
        return { ...business, error: 'Missing required fields' };
      }
      
      try {
        // For now, return the business without enrichment
        // This avoids the streamObject issues while we fix the import
        return { 
          ...business, 
          description: business.description || `${business.name} is located at ${business.address}.`,
          hasEventSpace: business.type?.toLowerCase().includes('event') || false
        };
      } catch (error) {
        console.error(`Error enriching business ${business.name}:`, error);
        return { ...business, enrichmentError: String(error) };
      }
    });
    
    // Wait for all enrichments to complete
    const enrichedBusinesses = await Promise.all(enrichmentPromises);
    
    return NextResponse.json({
      businesses: enrichedBusinesses,
      count: enrichedBusinesses.length
    });
  } catch (error) {
    console.error('Business enrichment error:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}