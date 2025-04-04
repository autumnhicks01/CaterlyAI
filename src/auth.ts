import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase-server';
import { type Session } from '@supabase/supabase-js';

export async function auth(): Promise<{ user: { id: string } | null, session: Session | null }> {
  try {
    const cookieStore = cookies();
    const supabase = createClient();
    
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return { user: null, session: null };
    }
    
    // Securely verify the user with getUser()
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { user: null, session: null };
    }
    
    return {
      user: { id: user.id },
      session
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return { user: null, session: null };
  }
} 