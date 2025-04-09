import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return Response.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Initialize Supabase client
    const supabase = await createClient();
    const userId = session.user.id;
    
    console.log(`Fetching saved leads for user: ${userId}`);
    
    // Fetch all saved leads for the user
    const { data, error } = await supabase
      .from('saved_leads')
      .select('*')
      .eq('user_id', userId) // Filter by user_id to only show the user's leads
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching saved leads:', error);
      return Response.json(
        { error: 'Failed to fetch leads: ' + error.message },
        { status: 500 }
      );
    }
    
    console.log(`Found ${data?.length || 0} leads for user ${userId}`);
    
    // Process leads to include lead score from enrichment_data if available
    const processedLeads = data.map(lead => {
      // Get lead score from enrichment_data if available
      let leadScore = null;
      let leadScoreLabel = null;
      
      if (lead.enrichment_data && lead.enrichment_data.leadScore) {
        leadScore = lead.enrichment_data.leadScore.score;
        leadScoreLabel = lead.enrichment_data.leadScore.potential;
      }
      
      return {
        ...lead,
        lead_score: leadScore,
        lead_score_label: leadScoreLabel
      };
    });
    
    return Response.json({
      leads: processedLeads,
      count: processedLeads.length
    });
  } catch (error) {
    console.error('Saved leads fetch error:', error);
    return Response.json(
      { error: String(error) },
      { status: 500 }
    );
  }
} 