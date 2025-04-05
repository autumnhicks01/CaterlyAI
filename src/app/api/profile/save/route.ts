import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { workflowManager } from '@/lib/workflows';
import { ContextSetupFn } from '@/lib/workflows/core';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return Response.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const userId = session.user.id;
    const profileData = await req.json();
    
    console.log(`Generating profile for ${profileData.businessName}`);
    
    // Set up context with user ID for the save step
    const contextSetup: ContextSetupFn = (context) => {
      context.setMetadata('userId', userId);
    };
    
    // Execute the profile generation workflow
    const result = await workflowManager.executeWorkflow('profile-generation', profileData, contextSetup);
    
    if (!result.success) {
      console.error('Profile generation workflow failed:', result.error);
      return Response.json(
        { 
          error: 'Failed to generate profile',
          details: result.error?.message
        },
        { status: 500 }
      );
    }
    
    // Get the results from the save profile step
    const saveResults = result.stepResults.get('save-profile')?.data;
    
    if (!saveResults) {
      return Response.json(
        { error: 'Workflow completed but no save results available' },
        { status: 500 }
      );
    }
    
    if (!saveResults.success) {
      return Response.json(
        { 
          error: 'Failed to save profile',
          details: saveResults.error,
          profile: saveResults.structuredProfile
        },
        { status: 500 }
      );
    }
    
    return Response.json({
      success: true,
      profileId: saveResults.profileId,
      profile: saveResults.structuredProfile,
      workflow: {
        name: result.workflowId,
        executionTime: result.duration
      }
    });
  } catch (error) {
    console.error('Profile generation error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 