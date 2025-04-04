import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { Database } from '@/types/supabase'

export async function POST(request: NextRequest) {
  try {
    // Use the createClient helper from utils/supabase/server instead of creating one here
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
    
    // Parse the request payload
    const payload = await request.json()
    
    // Ensure required fields are present
    if (!payload.business_name) {
      return NextResponse.json({ 
        error: 'Business name is required' 
      }, { status: 400 })
    }
    
    // Check for location coordinates
    if (!payload.user_input_data?.coordinates && !(payload.latitude && payload.longitude)) {
      return NextResponse.json({ 
        error: 'Location coordinates are required' 
      }, { status: 400 })
    }
    
    // Set default service radius if not provided
    if (!payload.delivery_radius) {
      payload.delivery_radius = 10
    }
    
    // Initialize user_input_data if it doesn't exist
    if (!payload.user_input_data) {
      payload.user_input_data = {}
    }
    
    // Handle photo URLs - store them only in user_input_data
    if (payload.photo_urls && Array.isArray(payload.photo_urls)) {
      // Filter out any data URLs or blob URLs - only store actual URLs
      const processedPhotoUrls = payload.photo_urls
        .filter((url: string) => typeof url === 'string')
        .map((url: string) => {
          // Replace blob URLs and data URLs with placeholder
          if (url.startsWith('blob:') || url.startsWith('data:')) {
            return 'https://placehold.co/400x300?text=Image+URL+not+stored'
          }
          return url
        })
        .slice(0, 3) // Limit to 3 photos
      
      // Store in user_input_data
      payload.user_input_data.photo_urls = processedPhotoUrls
      
      // Remove from root level to prevent database errors
      delete payload.photo_urls
    }
    
    // Move coordinates from root level to user_input_data if they exist
    if (payload.latitude !== undefined && payload.longitude !== undefined) {
      payload.user_input_data.coordinates = {
        lat: payload.latitude,
        lng: payload.longitude
      }
      
      // Delete from root level to prevent database errors
      delete payload.latitude
      delete payload.longitude
    }
    
    // Delete any root-level coordinates to prevent database errors
    delete payload.coordinates
    
    const userId = session.user.id
    
    // Check if a profile already exists for this user
    const { data: existingProfile, error: fetchError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', userId)
      .single()
      
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking for existing profile:', fetchError)
      return NextResponse.json({ 
        error: 'Failed to check for existing profile',
        details: fetchError 
      }, { status: 500 })
    }
    
    // If profile exists, use update instead of upsert to avoid duplicate key violation
    let result;
    if (existingProfile) {
      console.log('Updating existing profile for user:', userId)
      result = await supabase
        .from('user_profiles')
        .update({
          ...payload,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
    } else {
      console.log('Creating new profile for user:', userId)
      result = await supabase
        .from('user_profiles')
        .insert({
          ...payload,
          user_id: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
    }
    
    if (result.error) {
      console.error('Error saving profile:', result.error)
      return NextResponse.json({ 
        error: 'Failed to save profile',
        details: result.error 
      }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true,
      data: result.data 
    }, { status: 200 })
  } catch (error) {
    console.error('Unexpected error saving profile:', error)
    return NextResponse.json({ 
      error: 'An unexpected error occurred',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
} 