import { createClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function POST() {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const userId = session.user.id;
    const supabase = createClient();
    
    // Get the existing profile first
    const { data: existingProfile, error: fetchError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', userId)
      .single();
    
    if (fetchError && fetchError.code !== 'PGRST116') { // Not found error is ok
      console.error('Error fetching user profile:', fetchError);
      return NextResponse.json(
        { error: 'Error fetching user profile' },
        { status: 500 }
      );
    }
    
    if (existingProfile) {
      // If a profile exists, reset the address fields
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          full_address: '',
          user_input_data: null,
          ai_profile_data: null
        })
        .eq('user_id', userId);
      
      if (updateError) {
        console.error('Error resetting user profile:', updateError);
        return NextResponse.json(
          { error: 'Error resetting user profile' },
          { status: 500 }
        );
      }
      
      return NextResponse.json({ 
        success: true, 
        message: 'Profile has been reset' 
      });
    } else {
      // If no profile, return success (nothing to reset)
      return NextResponse.json({ 
        success: true, 
        message: 'No profile found to reset' 
      });
    }
  } catch (error) {
    console.error('Profile reset error:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
} 