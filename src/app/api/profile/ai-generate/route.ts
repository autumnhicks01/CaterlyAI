import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { modelConfig } from '@/lib/mastra/config';

/**
 * API route for generating AI profiles on the server
 * This avoids browser environment issues with Mastra and OpenAI API keys
 */
export async function POST(request: NextRequest) {
  try {
    // Extract profile data from the request
    const { profileData } = await request.json();
    
    if (!profileData) {
      return NextResponse.json(
        { error: "Missing profile data" },
        { status: 400 }
      );
    }
    
    // Get OpenAI API key from environment (server-side safe)
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error("OpenAI API key is not defined in environment variables");
      return NextResponse.json(
        { error: "API configuration error" },
        { status: 500 }
      );
    }
    
    // Generate the profile
    console.log(`Generating enhanced profile for: "${profileData.businessName}"`);
    
    const instructions = `
      You are an expert business profiler and marketing strategist specializing in the catering industry.
      
      Your task is to analyze business information and create comprehensive, compelling profiles
      that highlight the unique selling points and competitive advantages of catering businesses.
      
      For each business profile:
      1. Create a catchy, memorable tagline that encapsulates the business's unique value proposition
      2. Write an enhanced business description that highlights what makes them special
      3. Identify key selling points that would appeal to potential clients
      4. Define target audience segments with demographic and psychographic details
      5. Provide actionable marketing recommendations tailored to the business
      6. Articulate their competitive advantages in the local market
      7. Create detailed ideal client profiles with specific approach strategies
      
      Focus on being specific, practical, and tailored to the catering business context.
      Avoid generic marketing language and instead highlight unique aspects of each business.
      When information is missing, make reasonable assumptions based on the industry and available details.
    `;
    
    const prompt = `
      Create a compelling business profile for a catering company based on the following information:
      ${JSON.stringify(profileData, null, 2)}
      
      Please generate the following:
      1. A catchy business tagline
      2. An enhanced business description that highlights unique aspects
      3. Key selling points (at least 5)
      4. Target audience segments (at least 3)
      5. Marketing recommendations (at least 3)
      6. Competitive advantages (at least 3)
      7. Ideal client profiles (at least 3 different types with description and approach)
      
      Return the enhanced profile in a structured JSON format with these exact fields:
      {
        "tagline": "string",
        "enhancedDescription": "string", 
        "sellingPoints": ["string", "string", ...],
        "targetAudience": ["string", "string", ...],
        "marketingRecommendations": ["string", "string", ...],
        "competitiveAdvantages": ["string", "string", ...],
        "idealClients": [
          {
            "type": "string",
            "description": "string",
            "approach": "string"
          },
          ...
        ]
      }
    `;
    
    // Use direct fetch to the OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelConfig.profileGeneration.modelName,
        messages: [
          { role: "system", content: instructions },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 4000
      })
    });
    
    if (!response.ok) {
      console.error("OpenAI API error:", response.status, response.statusText);
      const errorData = await response.json().catch(() => ({}));
      console.error("Error details:", errorData);
      return NextResponse.json(
        { error: "Failed to generate profile with OpenAI" },
        { status: 500 }
      );
    }
    
    const data = await response.json();
    const enhancedProfileJson = data.choices[0].message.content;
    
    // Parse the response
    let enhancedProfile;
    try {
      enhancedProfile = JSON.parse(enhancedProfileJson);
    } catch (error) {
      console.error("Error parsing OpenAI response:", error);
      return NextResponse.json(
        { error: "Failed to parse AI-generated profile" },
        { status: 500 }
      );
    }
    
    // If profileId is provided, save the profile to the database
    if (profileData.id) {
      try {
        // Set up Supabase client (properly awaiting)
        const supabase = await createClient();
        
        // Get the metadata about the generation
        const metadata = {
          generatedAt: new Date().toISOString(),
          modelUsed: modelConfig.profileGeneration.modelName,
          characterCount: enhancedProfileJson.length,
        };
        
        // Save to database
        const { data: savedProfile, error } = await supabase
          .from('profiles')
          .update({
            ai_profile_data: enhancedProfile,
            ai_profile_metadata: metadata
          })
          .eq('id', profileData.id)
          .select()
          .single();
        
        if (error) {
          console.error("Database error:", error);
          // Return the generated profile even if saving failed
          return NextResponse.json({
            enhancedProfile,
            error: "Generated profile successfully but failed to save to database",
            metadata
          });
        }
        
        // Return the saved profile
        return NextResponse.json({
          enhancedProfile,
          savedProfile,
          metadata
        });
      } catch (error) {
        console.error("Error saving profile:", error);
        // Return the generated profile even if saving failed
        return NextResponse.json({
          enhancedProfile,
          error: "Generated profile successfully but failed to save to database"
        });
      }
    }
    
    // Return the generated profile
    return NextResponse.json({ enhancedProfile });
  } catch (error) {
    console.error("Error in AI profile generation API:", error);
    return NextResponse.json(
      { error: "Failed to generate profile" },
      { status: 500 }
    );
  }
} 