import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { getUserProfile } from '@/lib/user-profile';
import { Business, BusinessSearchResponse } from '@/types/business';
import { searchBusinesses, enrichBusinesses } from '@/lib/ai/tools/businessSearchAgent';

// Function to deduplicate businesses 
function deduplicateBusinesses(businesses: Business[]): Business[] {
  const uniqueBizMap = new Map<string, Business>();
  
  for (const business of businesses) {
    // Create a normalized key based on name and address
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

// Search businesses API endpoint
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
    
    // Search for businesses using our AI-powered search agent
    const searchResult = await searchBusinesses(
      query,
      location,
      serviceRadius,
      userCoordinates || undefined
    );
    
    // Handle search errors
    if (searchResult.error) {
      console.error('Business search error:', searchResult.error);
      return Response.json(
        { error: searchResult.error },
        { status: 500 }
      );
    }
    
    // Handle empty results
    if (!searchResult.businesses || searchResult.businesses.length === 0) {
      return Response.json({
        businesses: [],
        count: 0,
        message: 'No businesses found matching your criteria'
      });
    }
    
    // Deduplicate and process businesses
    const businesses = deduplicateBusinesses(searchResult.businesses);
    
    // Log websites of found businesses for debugging
    console.log("Found businesses with websites:");
    businesses.forEach(business => {
      console.log(`- ${business.name}: ${business.contact?.website || 'No website'}`);
    });
    
    // Return the results
    return Response.json({
      businesses,
      count: businesses.length,
      location,
      radius: serviceRadius
    });
  } catch (error) {
    console.error('Business search error:', error);
    return Response.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

// Enrich businesses API endpoint
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
    
    // Enrich businesses using our AI agent
    const enrichResult = await enrichBusinesses(body.businesses);
    
    // Handle enrichment errors
    if (enrichResult.error) {
      console.error('Business enrichment error:', enrichResult.error);
      return Response.json(
        { error: enrichResult.error },
        { status: 500 }
      );
    }
    
    return Response.json({
      businesses: enrichResult.businesses,
      count: enrichResult.businesses.length
    });
  } catch (error) {
    console.error('Business enrichment error:', error);
    return Response.json(
      { error: String(error) },
      { status: 500 }
    );
  }
} 