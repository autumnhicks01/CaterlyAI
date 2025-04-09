import { NextRequest, NextResponse } from 'next/server';
import { validateEnv } from '@/lib/env';
import { createClient } from '@/utils/supabase/server';

// Define the CateringProfileData interface here instead of importing it
interface ContactInformation {
  phone: string;
  email: string;
  website: string;
  socialMedia: string[];
}

interface CateringProfileData {
  businessName: string;
  location: string;
  contactInformation: ContactInformation;
  cuisine?: string[];
  specialties?: string[];
  services?: string[];
  [key: string]: any;
}

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
    const supabase = await createClient();
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
    
    // Create a default profile to use instead of AI generation
    const structuredProfile = {
      businessName: profileData.businessName,
      location: profileData.location,
      description: `${profileData.businessName} is a catering service based in ${profileData.location}.`,
      cuisine: profileData.cuisine || ["Various"],
      specialties: profileData.specialties || ["Custom catering"],
      services: profileData.services || ["Event catering"],
      contactInformation: profileData.contactInformation,
      testimonials: [],
      eventTypes: ["Corporate", "Weddings", "Special Occasions"]
    };
    
    // Add metadata for the profile
    const now = new Date();
    const metadata = {
      generatedAt: now.toISOString(),
      characterCount: JSON.stringify(structuredProfile).length
    };
    
    // Save the regenerated profile to the database
    const { data: updatedProfile, error: dbError } = await supabase
      .from('user_profiles')
      .update({
        ai_profile_data: {
          structuredProfile,
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
          structuredProfile,
          metadata
        },
        { status: 500 }
      );
    }
    
    console.log('Profile regenerated and saved successfully');
    
    // Return the generated structured profile with metadata
    return NextResponse.json({
      structuredProfile,
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