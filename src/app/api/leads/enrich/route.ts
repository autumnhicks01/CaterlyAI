import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@/utils/supabase/server';
import { workflowManager } from '@/lib/workflows';

export const maxDuration = 300; // 5 minutes for enrichment process

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return Response.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const body = await req.json();
    const { leadIds } = body;
    
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return Response.json(
        { error: 'Missing or invalid leadIds array' },
        { status: 400 }
      );
    }
    
    console.log(`Starting enrichment for ${leadIds.length} leads using workflow architecture`);
    
    // Execute the lead enrichment workflow
    const result = await workflowManager.executeWorkflow('lead-enrichment', { leadIds });
    
    if (!result.success) {
      console.error('Lead enrichment workflow failed:', result.error);
      return Response.json(
        { 
          error: 'Failed to enrich leads',
          details: result.error?.message
        },
        { status: 500 }
      );
    }
    
    // Get the results from the final update step
    const updateResults = result.stepResults.get('update-leads')?.data;
    
    if (!updateResults) {
      return Response.json(
        { error: 'Workflow completed but no update results available' },
        { status: 500 }
      );
    }
    
    return Response.json({
      success: true,
      message: `${updateResults.successful} leads enriched successfully`,
      failed: updateResults.failed,
      total: updateResults.total,
      workflow: {
        name: result.workflowId,
        executionTime: result.duration
      }
    });
  } catch (error) {
    console.error('Lead enrichment error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 