import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    console.log('API: /profile/current called')
    const supabase = createClient()
    
    // Get the current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error('API: Session error in /profile/current:', sessionError)
      return NextResponse.json({ 
        error: 'Authentication error',
        details: sessionError
      }, { status: 401 })
    }
    
    if (!session) {
      console.log('API: No session found in /profile/current')
      return NextResponse.json({ 
        error: 'Not authenticated',
        authenticated: false
      }, { status: 401 })
    }
    
    console.log('API: Session found for user:', session.user.id)
    
    // Get the user's profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, business_name, full_address, latitude, longitude, delivery_radius')
      .eq('user_id', session.user.id)
      .single()
    
    if (profileError) {
      console.error('API: Error fetching profile:', profileError)
      
      if (profileError.code === 'PGRST116') {
        // Profile not found - that's okay, just return that there's no profile yet
        console.log('API: No profile found for user')
        return NextResponse.json({ 
          authenticated: true,
          profile: null
        })
      }
      
      return NextResponse.json({ 
        error: 'Error fetching profile',
        details: profileError
      }, { status: 500 })
    }
    
    console.log('API: Profile found with ID:', profile?.id)
    
    // Return profile data including the ID
    return NextResponse.json({
      authenticated: true,
      profile
    })
  } catch (error) {
    console.error('API: Unexpected error in /profile/current:', error)
    return NextResponse.json({ 
      error: 'Unexpected error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 