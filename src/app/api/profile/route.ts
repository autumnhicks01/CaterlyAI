import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  const supabase = createClient()
  
  // Get the current session
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    return NextResponse.json({ 
      error: 'Not authenticated'
    }, { status: 401 })
  }
  
  // Get user profile
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', session.user.id)
    .single()
  
  if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" error code
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json({ profile: data || null })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  
  // Get the current session
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    return NextResponse.json({ 
      error: 'Not authenticated'
    }, { status: 401 })
  }
  
  // Get the request body
  const profileData = await request.json()
  
  // Add user_id to the profile data
  profileData.user_id = session.user.id
  
  // Insert or update the profile
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(profileData)
    .select()
    .single()
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json({ profile: data })
}

export async function PATCH(request: NextRequest) {
  const supabase = createClient()
  
  // Get the current session
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    return NextResponse.json({ 
      error: 'Not authenticated'
    }, { status: 401 })
  }
  
  // Get the request body
  const profileData = await request.json()
  
  // Update the profile
  const { data, error } = await supabase
    .from('user_profiles')
    .update(profileData)
    .eq('user_id', session.user.id)
    .select()
    .single()
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json({ profile: data })
} 