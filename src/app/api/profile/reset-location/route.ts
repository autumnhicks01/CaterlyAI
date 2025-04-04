import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { Database } from '@/types/supabase'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get the current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error('Session error:', sessionError)
      return NextResponse.json({ 
        error: 'Authentication error',
        details: sessionError
      }, { status: 401 })
    }
    
    if (!session) {
      return NextResponse.json({ 
        error: 'Not authenticated'
      }, { status: 401 })
    }
    
    // First check if profile exists
    const { data: existingProfile, error: fetchError } = await supabase
      .from('user_profiles')
      .select('id, full_address, user_input_data')
      .eq('user_id', session.user.id)
      .maybeSingle()
    
    if (fetchError) {
      console.error('Error checking for existing profile:', fetchError)
      return NextResponse.json({ 
        error: 'Database error when checking for existing profile',
        details: fetchError
      }, { status: 500 })
    }
    
    // If the profile doesn't exist, return a helpful message
    if (!existingProfile) {
      return NextResponse.json({ 
        error: 'Profile not found - please set up your profile first',
      }, { status: 404 })
    }
    
    console.log(`Resetting location for profile ${existingProfile.id}. Current value: ${existingProfile.full_address}`)
    
    // Update only the location field, leaving other fields intact
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ 
        full_address: 'Please update your address',  // Use a placeholder instead of null
        user_input_data: { 
          ...(existingProfile.user_input_data as Record<string, any> || {}),
          location: ''  // Empty string instead of null
        }
      })
      .eq('id', existingProfile.id)
    
    if (updateError) {
      console.error('Error updating profile location:', updateError)
      return NextResponse.json({ 
        error: 'Failed to reset location',
        details: updateError
      }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Location reset successfully'
    })
  } catch (error) {
    console.error('Unexpected error resetting location:', error)
    return NextResponse.json({ 
      error: 'Unexpected error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 