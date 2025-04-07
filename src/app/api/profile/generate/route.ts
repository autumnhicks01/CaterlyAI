import { NextRequest, NextResponse } from 'next/server';
import { getProfileGenerationWorkflow, generateUUID } from '@/lib/mastra';
import { ProfileInput } from '@/workflows/profile-generation/schemas';
import { generateProfile, createFallbackProfile } from '@/agents/profileAgent';

/**
 * API route handler for profile generation
 * Uses the Mastra workflow to generate a catering business profile
 * Falls back to direct agent calls if workflow fails
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[API] Starting profile generation request');
    
    // Parse request body
    const body = await request.json();
    console.log('[API] Request body:', JSON.stringify(body, null, 2));
    
    // Get the workflow
    const workflow = getProfileGenerationWorkflow();
    
    // Check if workflow exists and can be executed
    if (workflow && typeof workflow.execute === 'function') {
      console.log('[API] Using workflow approach for profile generation');
      
      // Create input data for the workflow
      const inputData: ProfileInput = {
        businessProfileData: {
          id: body.id,
          businessName: body.businessName,
          location: body.location,
          serviceRadius: body.serviceRadius,
          yearsInOperation: body.yearsInOperation,
          idealClients: body.idealClients,
          signatureDishesOrCuisines: body.signatureDishesOrCuisines,
          uniqueSellingPoints: body.uniqueSellingPoints,
          brandVoiceAndStyle: body.brandVoiceAndStyle,
          contactInformation: body.contactInformation
        }
      };
      
      console.log('[API] Starting profile generation workflow with data:', inputData);
      
      try {
        // Execute the workflow
        const result = await workflow.execute(inputData);
        
        // Return the result
        console.log('[API] Workflow executed successfully');
        return NextResponse.json({
          success: true,
          result
        });
      } catch (workflowError) {
        console.error('[API] Workflow execution failed:', workflowError);
        console.log('[API] Falling back to direct agent approach');
        
        // Fall back to direct agent approach
        return await handleDirectAgentGeneration(body);
      }
    } else {
      console.log('[API] Workflow not available, using direct agent approach');
      return await handleDirectAgentGeneration(body);
    }
  } catch (error) {
    console.error('[API] Error in profile generation API:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during profile generation'
      },
      { status: 500 }
    );
  }
}

/**
 * Fallback handler using direct agent approach
 */
async function handleDirectAgentGeneration(body: any) {
  try {
    console.log('[API:Direct] Generating profile with direct agent approach');
    
    // Generate profile using the direct agent approach
    const enhancedProfileJson = await generateProfile(body);
    
    // Parse the enhanced profile
    let enhancedProfile;
    try {
      enhancedProfile = typeof enhancedProfileJson === 'string' 
        ? JSON.parse(enhancedProfileJson) 
        : enhancedProfileJson;
    } catch (parseError) {
      console.error('[API:Direct] Error parsing profile:', parseError);
      enhancedProfile = createFallbackProfile(body);
    }
    
    // Create a structured profile in the new format
    const structuredProfile = {
      businessName: body.businessName,
      location: body.location || 'Not specified',
      serviceArea: body.serviceRadius || 'Local area',
      yearsExperience: body.yearsInOperation || 'Established business',
      contactPerson: {
        name: "Contact Manager",
        title: "Owner"
      },
      mostRequestedDishes: Array.isArray(enhancedProfile.sellingPoints) 
        ? enhancedProfile.sellingPoints.slice(0, 3) 
        : ["Signature dishes", "Seasonal specialties", "Custom menu options"],
      overview: enhancedProfile.enhancedDescription || 
        `${body.businessName} is a premier catering service offering exceptional food and service.`,
      whyChooseUs: Array.isArray(enhancedProfile.competitiveAdvantages) 
        ? enhancedProfile.competitiveAdvantages 
        : ["Quality ingredients", "Professional service", "Customizable menus"],
      idealClients: Array.isArray(enhancedProfile.targetAudience) 
        ? enhancedProfile.targetAudience.join(', ') 
        : body.idealClients || "Weddings, corporate events, special celebrations",
      contactInformation: {
        phone: body.contactInformation?.phone || '',
        email: body.contactInformation?.email || '',
        socialMedia: body.contactInformation?.socialMedia || []
      }
    };
    
    // Create metadata
    const metadata = {
      generatedAt: new Date().toISOString(),
      generationTime: 0,
      modelUsed: 'direct-agent-fallback',
      characterCount: JSON.stringify(structuredProfile).length
    };
    
    // Create a result that mimics the workflow output
    const result = {
      structuredProfile,
      enhancedProfile,
      metadata,
      saved: false,
      savedProfile: null
    };
    
    console.log('[API:Direct] Successfully generated profile using direct approach');
    
    return NextResponse.json({
      success: true,
      result,
      method: 'direct-agent'
    });
  } catch (error) {
    console.error('[API:Direct] Error in direct agent generation:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during direct profile generation'
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400' // 24 hours
    }
  });
} 