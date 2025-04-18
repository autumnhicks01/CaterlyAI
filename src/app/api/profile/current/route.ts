import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { Database } from '@/types/supabase'
import { cookies } from 'next/headers'

// Define types for the profile data
interface ProfileData {
  id: string;
  business_name: string | null;
  full_address: string | null;
  delivery_radius: number | null;
  business_type: string | null;
  contact_phone: string | null;
  website_url: string | null;
  photo_urls?: string[] | null;
  user_input_data: {
    coordinates?: {
      lat: number;
      lng: number;
    },
    photo_urls?: string[];
    [key: string]: any;
  } | null;
  [key: string]: any; // Allow for additional properties
}

// Enhanced profile with coordinates
interface EnhancedProfile extends ProfileData {
  latitude?: number;
  longitude?: number;
}

export async function GET(request: NextRequest) {
  try {
    console.log('API: /profile/current called')
    
    // Create headers with CORS configuration
    const headers = new Headers({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json'
    });
    
    // Create a new Supabase client using the helper - now awaited
    const supabase = await createClient()
    
    // Get all cookies for debugging
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()
    const authCookies = allCookies.filter(cookie => 
      cookie.name.includes('auth') || cookie.name.startsWith('sb-')
    )
    
    console.log('API: Auth cookies found:', authCookies.map(c => c.name).join(', ') || 'none')
    
    // Get the current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error('API: Session error in /profile/current:', sessionError)
      return NextResponse.json({ 
        error: 'Authentication error',
        details: sessionError,
        cookies: {
          count: allCookies.length,
          authCookies: authCookies.map(c => c.name)
        }
      }, { status: 401, headers })
    }
    
    if (!session) {
      console.log('API: No session found in /profile/current')
      
      // Try to get user directly as a fallback
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        console.log('API: User found without session, ID:', user.id)
        // Continue with profile fetch using the user ID
      } else {
        return NextResponse.json({ 
          authenticated: false,
          profile: null,
          cookies: {
            count: allCookies.length,
            authCookies: authCookies.map(c => c.name)
          }
        }, { status: 401, headers })
      }
    }
    
    // Use user ID from session or direct user check
    const userId = session?.user.id || (await supabase.auth.getUser()).data.user?.id
    
    if (!userId) {
      return NextResponse.json({ 
        authenticated: false,
        profile: null,
        message: 'No user ID found'
      }, { status: 401, headers })
    }
    
    console.log('API: Session found for user:', userId)
    
    // Get the user's profile with all fields we need
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, business_name, full_address, delivery_radius, business_type, contact_phone, website_url, user_input_data, created_at, updated_at')
      .eq('user_id', userId)
      .single()
    
    if (profileError) {
      console.error('API: Error fetching profile:', profileError)
      
      if (profileError.code === 'PGRST116') {
        // Profile not found - that's okay, just return that there's no profile yet
        console.log('API: No profile found for user')
        return NextResponse.json({ 
          authenticated: true,
          profile: null
        }, { headers })
      }
      
      return NextResponse.json({ 
        error: 'Error fetching profile',
        details: profileError
      }, { status: 500, headers })
    }
    
    console.log('API: Profile found with ID:', profile?.id)
    
    // If we need coordinates, extract them from user_input_data
    const enhancedProfile: EnhancedProfile = { ...profile as ProfileData };
    
    // Check if coordinates exist in user_input_data
    if (profile?.user_input_data?.coordinates) {
      enhancedProfile.latitude = profile.user_input_data.coordinates.lat;
      enhancedProfile.longitude = profile.user_input_data.coordinates.lng;
      console.log('API: Found coordinates in user_input_data:', 
        profile.user_input_data.coordinates.lat, 
        profile.user_input_data.coordinates.lng);
    }
    
    // Return profile data including the ID
    return NextResponse.json({
      authenticated: true,
      profile: enhancedProfile
    }, { headers })
  } catch (error) {
    console.error('API: Unexpected error in /profile/current:', error)
    
    // Create headers with CORS configuration
    const headers = new Headers({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json'
    });
    
    return NextResponse.json({ 
      error: 'Unexpected error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500, headers })
  }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400' // 24 hours
    }
  });
} 