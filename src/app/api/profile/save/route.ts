import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { workflowManager } from '@/workflows/workflowManager';

/**
 * POST handler for profile save API
 * 
 * This endpoint saves a business profile and generates an enhanced version using AI
 */
export async function POST(req: NextRequest) {
  // Authenticate the user session
  const session = await auth();
  
  if (!session || !session.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }
  
  try {
    // Get profile data from request body
    const profileData = await req.json();
    
    // Validate required fields
    if (!profileData.businessName) {
      return NextResponse.json(
        { error: "Business name is required" },
        { status: 400 }
      );
    }
    
    // Add user ID to the profile data
    const dataWithUserId = {
      ...profileData,
      userId: session.user.id
    };
    
    // Execute the profile generation workflow
    const result = await workflowManager.executeWorkflow('profile-generation', dataWithUserId);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Profile generation failed" },
        { status: 500 }
      );
    }
    
    // Return success response with profile ID
    return NextResponse.json({
      message: `Profile for "${profileData.businessName}" created successfully`,
      profileId: result.data?.profileId,
      success: true
    });
    
  } catch (error) {
    console.error("Error in profile save API:", error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error occurred" },
      { status: 500 }
    );
  }
} 