import { NextRequest, NextResponse } from 'next/server';
import { GooglePlacesService } from '@/tools/googlePlaces';
import { auth } from '@/auth';

/**
 * Fast business search API endpoint
 * 
 * Returns only essential business data:
 * 1. Business name
 * 2. Address
 * 3. Phone number
 * 4. Website URL (required)
 * 5. Category/Type
 */
export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }
    
    // Extract query parameters
    const url = new URL(req.url);
    const query = url.searchParams.get('query');
    const location = url.searchParams.get('location');
    const radiusParam = url.searchParams.get('radius');
    
    // Validate required parameters
    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }
    
    if (!location) {
      return NextResponse.json({ error: 'Location parameter is required' }, { status: 400 });
    }
    
    // Validate location format (lat,lng)
    if (!/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(location)) {
      return NextResponse.json({ 
        error: 'Location must be in format "latitude,longitude"' 
      }, { status: 400 });
    }
    
    // Parse radius into number (default to 10 miles if not provided)
    const radius = radiusParam ? parseInt(radiusParam, 10) : 10;
    
    console.log(`Fast search API call with query: ${query}, location: ${location}, radius: ${radius}`);
    
    // Call Google Places API to search for businesses
    const googlePlaces = new GooglePlacesService();
    
    // Get places from Google API
    const businesses = await googlePlaces.searchPlaces(query, location, radius);
    
    console.log(`Found ${businesses.length} businesses from Google Places API`);
    
    // Return immediate response
    return NextResponse.json({
      success: true,
      count: businesses.length,
      results: businesses.map((business: any) => ({
        id: business.id || business.place_id,
        name: business.name,
        address: business.address || business.formatted_address,
        phone: business.phone || business.formatted_phone_number,
        website: business.website,
        category: business.type || (business.types && business.types.length > 0 ? business.types[0] : 'Business'),
        // Keep hasEventSpace for compatibility
        hasEventSpace: business.types ? business.types.some((t: string) => 
          ['event_venue', 'wedding_hall', 'banquet_hall'].includes(t)) : false
      }))
    }, { status: 200 });
  } catch (error) {
    console.error('Error in fast search API:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'An error occurred during business search' 
    }, { status: 500 });
  }
} 