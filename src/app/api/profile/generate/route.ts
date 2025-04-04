import { NextRequest, NextResponse } from 'next/server';
import { generateCateringProfile, CateringProfileData } from '@/lib/ai/agents/profileAgent';
import { validateEnv } from '@/lib/env';

/**
 * API route handler for generating a catering business profile
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

    // Parse the request body
    const profileData: CateringProfileData = await request.json();
    
    // Validate the required fields
    if (!profileData.businessName || !profileData.location) {
      return NextResponse.json(
        { error: 'Missing required fields: business name and location are required' },
        { status: 400 }
      );
    }
    
    console.log('Generating profile for:', profileData.businessName);
    
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
    
    console.log('Profile generated successfully');
    console.log(`Generated in ${result.metadata?.generationTime.toFixed(2) || 0}s`);
    
    // Return the generated structured profile with metadata
    return NextResponse.json({
      structuredProfile: result.structuredProfile,
      metadata: result.metadata,
      success: true
    });
  } catch (error) {
    console.error('Unexpected error in profile generation:', error);
    return NextResponse.json(
      { 
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 