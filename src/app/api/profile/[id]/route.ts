import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * GET /api/profile/[id] - Retrieve a profile by ID
 * 
 * The endpoint will return the profile with the given ID if the user
 * is authenticated and has permission to access it.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Get the profile ID from the URL
  const profileId = params.id;
  
  if (!profileId) {
    return NextResponse.json({ 
      error: 'Profile ID is required' 
    }, { status: 400, headers: corsHeaders });
  }

  // Create Supabase client
  const supabase = await createClient();
  
  // Get the current session
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return NextResponse.json({ 
      error: 'Not authenticated' 
    }, { status: 401, headers: corsHeaders });
  }
  
  // Get the profile by ID
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', profileId)
    .single();
  
  if (error) {
    console.error('Error fetching profile by ID:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: error.code === 'PGRST116' ? 404 : 500, headers: corsHeaders });
  }
  
  // Optionally check if the user has permission to view this profile
  // For now, just check if it's their own profile or implement your own permission logic
  const isOwner = data.user_id === session.user.id;
  
  // In this example, we allow viewing any profile but you could restrict this
  // if (isOwner || isAdmin || isPublicProfile) { ... }
  
  return NextResponse.json({ 
    profile: data,
    isOwner 
  }, { headers: corsHeaders });
}

/**
 * OPTIONS handler for CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders,
      'Access-Control-Max-Age': '86400',
    },
  });
} 