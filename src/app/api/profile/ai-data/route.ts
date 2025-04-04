import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getAuthenticatedUser } from '@/utils/supabase/auth'

export async function PATCH(request: NextRequest) {
  const supabase = createClient()
  
  // Get the authenticated user securely
  const { user, session } = await getAuthenticatedUser()
  
  if (!user || !session) {
    return NextResponse.json({ 
      error: 'Not authenticated'
    }, { status: 401 })
  }
  
  // Get the request body (new AI data)
  const aiData = await request.json()
  
  // Check if profile exists
  const { data: existingProfile, error: fetchError } = await supabase
    .from('user_profiles')
    .select('id, ai_profile_data')
    .eq('user_id', user.id)
    .single()
  
  if (fetchError && fetchError.code !== 'PGRST116') {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
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
    return NextResponse.json({ error: result.error.message }, { status: 500 })
  }
  
  return NextResponse.json({ 
    success: true,
    profile: result.data
  })
} 