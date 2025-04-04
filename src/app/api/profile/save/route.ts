import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
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
    
    // Get the request body
    const profileData = await request.json()
    console.log('Received profile data:', JSON.stringify(profileData, null, 2))
    
    // Add user_id to the profile data
    const dataWithUserId = {
      ...profileData,
      user_id: session.user.id
    }
    
    // Ensure required fields are present
    if (!dataWithUserId.business_name) {
      dataWithUserId.business_name = 'Unnamed Business'
    }
    
    if (!dataWithUserId.full_address) {
      return NextResponse.json({ 
        error: 'Address is required',
        field: 'full_address'
      }, { status: 400 })
    }
    
    // Store location coordinates in the user_input_data JSON field if they exist
    if (dataWithUserId.user_input_data?.coordinates) {
      // Make sure user_input_data exists
      if (!dataWithUserId.user_input_data) {
        dataWithUserId.user_input_data = {}
      }
      
      // Save coordinates in a standardized location in the JSON structure
      dataWithUserId.user_input_data.location_coordinates = dataWithUserId.user_input_data.coordinates
      
      // For easier access in search functions, store lat/lng at root level
      dataWithUserId.latitude = dataWithUserId.user_input_data.coordinates.lat
      dataWithUserId.longitude = dataWithUserId.user_input_data.coordinates.lng
      
      // Delete the coordinates from the root level to prevent database errors
      delete dataWithUserId.coordinates
    } else if (dataWithUserId.latitude && dataWithUserId.longitude) {
      // If coordinates are provided at the root level, make sure they're also in user_input_data
      if (!dataWithUserId.user_input_data) {
        dataWithUserId.user_input_data = {}
      }
      
      // Add coordinates to user_input_data
      dataWithUserId.user_input_data.coordinates = {
        lat: dataWithUserId.latitude,
        lng: dataWithUserId.longitude
      }
      
      dataWithUserId.user_input_data.location_coordinates = dataWithUserId.user_input_data.coordinates
    }
    
    // Convert service radius to an integer if it's a string
    if (dataWithUserId.delivery_radius && typeof dataWithUserId.delivery_radius === 'string') {
      dataWithUserId.delivery_radius = parseInt(dataWithUserId.delivery_radius, 10)
    }
    
    console.log('Attempting to save profile for user:', session.user.id)
    
    // First check if profile exists
    const { data: existingProfile, error: fetchError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', session.user.id)
      .maybeSingle()
    
    if (fetchError) {
      console.error('Error checking for existing profile:', fetchError)
      return NextResponse.json({ 
        error: 'Database error when checking for existing profile',
        details: fetchError
      }, { status: 500 })
    }
    
    let result
    
    // If profile exists, update it
    if (existingProfile?.id) {
      console.log(`Updating existing profile with ID: ${existingProfile.id}`)
      
      // Use update for existing profiles
      result = await supabase
        .from('user_profiles')
        .update(dataWithUserId)
        .eq('id', existingProfile.id)
        .select()
        .single()
    } else {
      // Otherwise insert a new profile
      console.log('Creating new profile')
      result = await supabase
        .from('user_profiles')
        .insert(dataWithUserId)
        .select()
        .single()
    }
    
    if (result.error) {
      console.error('Error saving profile:', result.error)
      return NextResponse.json({ 
        error: 'Error saving profile',
        details: result.error
      }, { status: 500 })
    }
    
    if (!result.data) {
      console.error('No data returned from save operation')
      return NextResponse.json({ 
        error: 'No data returned from save operation'
      }, { status: 500 })
    }
    
    console.log('Profile saved successfully:', result.data.id)
    
    return NextResponse.json({ 
      success: true,
      profile: result.data 
    })
  } catch (error) {
    console.error('Unexpected error saving profile:', error)
    return NextResponse.json({ 
      error: 'Unexpected error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 