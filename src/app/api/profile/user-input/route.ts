import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function PATCH(request: NextRequest) {
  // Need to await createClient since it's now an async function
  const supabase = await createClient()
  
  // Get the current session
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    return NextResponse.json({ 
      error: 'Not authenticated'
    }, { status: 401 })
  }
  
  // Get the request body (new input data)
  const inputData = await request.json()
  
  // Check if profile exists
  const { data: existingProfile, error: fetchError } = await supabase
    .from('user_profiles')
    .select('id, user_input_data')
    .eq('user_id', session.user.id)
    .single()
  
  if (fetchError && fetchError.code !== 'PGRST116') {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }
  
  let result;
  
  if (existingProfile) {
    // Merge with existing data
    const mergedData = {
      ...existingProfile.user_input_data,
      ...inputData
    }
    
    // Update existing profile
    result = await supabase
      .from('user_profiles')
      .update({ user_input_data: mergedData })
      .eq('user_id', session.user.id)
      .select('*')
      .single()
  } else {
    // Create new profile with minimal required fields
    result = await supabase
      .from('user_profiles')
      .insert({
        user_id: session.user.id,
        business_name: inputData.business_name || 'Unnamed Business',
        full_address: inputData.full_address || 'No address provided',
        user_input_data: inputData
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