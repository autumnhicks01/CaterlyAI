import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateFlyer } from '@/agents/profileAgent';

/**
 * API route for generating marketing flyers for catering businesses
 * Using the three-step AI process (marketer, copy editor, Flux LoRA)
 */
export async function POST(request: NextRequest) {
  try {
    // Extract profile data from the request
    const { profileData, profileId } = await request.json();
    
    if (!profileData) {
      return NextResponse.json(
        { error: "Missing profile data" },
        { status: 400 }
      );
    }
    
    // Log the profile data for debugging
    console.log(`Generating marketing flyer for: "${profileData.businessName || profileData.business_name}"`);
    
    // Check if OpenAI API key is available
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error("OpenAI API key is not defined in environment variables");
      return NextResponse.json(
        { error: "API configuration error" },
        { status: 500 }
      );
    }
    
    try {
      // Generate the flyer with streaming support
      const result = await generateFlyer(profileData, true);
      
      // Return the stream response - result will always be a ReadableStream with streaming=true
      return new NextResponse(result as ReadableStream);
    } catch (error: any) {
      throw new Error(`Flyer generation error: ${error.message}`);
    }
  } catch (error: any) {
    console.error("Error generating flyer:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate flyer" },
      { status: 500 }
    );
  }
}

/**
 * Non-streaming version for clients that don't support streams
 */
export async function GET(request: NextRequest) {
  try {
    // Extract profile ID from the query string
    const profileId = request.nextUrl.searchParams.get('profileId');
    
    if (!profileId) {
      return NextResponse.json(
        { error: "Missing profile ID" },
        { status: 400 }
      );
    }
    
    // Get the profile data from Supabase - createClient() now returns a Promise
    const supabase = await createClient();
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', profileId)
      .single();
    
    if (profileError || !profileData) {
      console.error("Error fetching profile:", profileError);
      return NextResponse.json(
        { error: "Failed to fetch profile data" },
        { status: 404 }
      );
    }
    
    // Check if OpenAI API key is available
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error("OpenAI API key is not defined in environment variables");
      return NextResponse.json(
        { error: "API configuration error" },
        { status: 500 }
      );
    }
    
    // Get the AI profile data from the user profile
    let aiProfileData = profileData.ai_profile_data;
    
    // If it's a string, parse it
    if (typeof aiProfileData === 'string') {
      try {
        aiProfileData = JSON.parse(aiProfileData);
      } catch (e) {
        console.error("Error parsing AI profile data:", e);
        return NextResponse.json(
          { error: "Invalid AI profile data format" },
          { status: 500 }
        );
      }
    }
    
    // If no AI profile data, return an error
    if (!aiProfileData || !aiProfileData.generatedProfile) {
      return NextResponse.json(
        { error: "No AI profile data available. Generate an AI profile first." },
        { status: 404 }
      );
    }
    
    // Generate the flyer (without streaming)
    const result = await generateFlyer({
      ...profileData,
      ...aiProfileData.generatedProfile
    }, false);
    
    // With streaming=false, result is always a string that can be parsed as JSON
    const parsedResult = JSON.parse(result as string);
    
    // Return the result
    return NextResponse.json({ result: parsedResult });
  } catch (error: any) {
    console.error("Error generating flyer:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate flyer" },
      { status: 500 }
    );
  }
} 