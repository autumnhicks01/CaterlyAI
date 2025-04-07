import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// Create CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function PATCH(request: NextRequest) {
  // Need to await createClient since it's now an async function
  const supabase = await createClient()
  
  // Get the current session directly
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    return NextResponse.json({ 
      error: 'Not authenticated'
    }, { status: 401, headers: corsHeaders })
  }
  
  const user = session.user
  
  // Get the request body (new AI data)
  const aiData = await request.json()
  
  // Check if profile exists
  const { data: existingProfile, error: fetchError } = await supabase
    .from('user_profiles')
    .select('id, ai_profile_data')
    .eq('user_id', user.id)
    .single()
  
  if (fetchError && fetchError.code !== 'PGRST116') {
    return NextResponse.json({ error: fetchError.message }, { status: 500, headers: corsHeaders })
  }
  
  let result;
  
  if (existingProfile) {
    // Merge with existing data
    const mergedData = {
      ...existingProfile.ai_profile_data,
      ...aiData
    }
    
    // Update existing profile
    result = await supabase
      .from('user_profiles')
      .update({ ai_profile_data: mergedData })
      .eq('user_id', user.id)
      .select('*')
      .single()
  } else {
    // Create new profile with minimal required fields
    result = await supabase
      .from('user_profiles')
      .insert({
        user_id: user.id,
        business_name: 'AI Generated Profile',
        full_address: 'No address provided',
        ai_profile_data: aiData
      })
      .select('*')
      .single()
  }
  
  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500, headers: corsHeaders })
  }
  
  return NextResponse.json({ 
    success: true,
    profile: result.data
  }, { headers: corsHeaders })
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders,
      'Access-Control-Max-Age': '86400' // 24 hours
    }
  })
} 