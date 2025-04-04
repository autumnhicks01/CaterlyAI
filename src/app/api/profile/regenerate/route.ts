import { NextRequest, NextResponse } from 'next/server';
import { generateCateringProfile, CateringProfileData } from '@/lib/ai/agents/profileAgent';
import { validateEnv } from '@/lib/env';
import { createClient } from '@/utils/supabase/server';

/**
 * API route handler for regenerating a catering business profile
 * 
 * This endpoint accepts POST requests with catering business data
 * and returns an AI-generated structured business profile
 */
export async function POST(request: NextRequest) {
  try {
    // Validate that required environment variables are set
    if (!validateEnv()) {
      return NextResponse.json(
        { error: 'Server environment is not properly configured.' },
        { status: 500 }
      );
    }

    // Authenticate the user using Supabase's built-in session handling
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Get user from session for additional security
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    // Parse the request body
    const profileData: CateringProfileData = await request.json();
    
    // Validate and sanitize the required fields
    if (!profileData.businessName || !profileData.businessName.trim()) {
      profileData.businessName = "Catering Business";
    }
    
    if (!profileData.location || !profileData.location.trim()) {
      profileData.location = "Local Area";
    }
    
    // Ensure contact information exists
    if (!profileData.contactInformation) {
      profileData.contactInformation = {
        phone: "",
        email: "",
        website: "",
        socialMedia: []
      };
    }
    
    // If social media is not an array, convert it
    if (!Array.isArray(profileData.contactInformation.socialMedia)) {
      profileData.contactInformation.socialMedia = profileData.contactInformation.socialMedia 
        ? [String(profileData.contactInformation.socialMedia)] 
        : [];
    }
    
    console.log('Regenerating profile for:', profileData.businessName);
    
    // Generate the catering profile using our AI agent
    const result = await generateCateringProfile(profileData);
    
    // Check if there was an error during generation
    if (result.error) {
      console.error('Error generating profile:', result.error);
      return NextResponse.json(
        { error: 'Failed to generate profile', details: result.error },
        { status: 500 }
      );
    }
    
    // Add metadata to the generated profile
    const now = new Date();
    const metadata = {
      ...result.metadata,
      generatedAt: now.toISOString(),
      characterCount: JSON.stringify(result.structuredProfile).length
    };
    
    // Save the regenerated profile to the database
    const { data: updatedProfile, error: dbError } = await supabase
      .from('user_profiles')
      .update({
        ai_profile_data: {
          structuredProfile: result.structuredProfile,
          metadata
        },
        updated_at: now.toISOString()
      })
      .eq('user_id', user.id)
      .select()
      .single();
      
    if (dbError) {
      console.error('Error saving regenerated profile to database:', dbError);
      return NextResponse.json(
        { 
          error: 'Profile generated but failed to save to database',
          details: dbError.message,
          structuredProfile: result.structuredProfile,
          metadata
        },
        { status: 500 }
      );
    }
    
    console.log('Profile regenerated and saved successfully');
    
    // Return the generated structured profile with metadata
    return NextResponse.json({
      structuredProfile: result.structuredProfile,
      metadata,
      success: true
    });
  } catch (error) {
    console.error('Unexpected error in profile regeneration:', error);
    return NextResponse.json(
      { 
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 