import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'

export default async function ProfileRedirect() {
  // Get the current session
  const supabase = createClient()
  const { data: { session }, error } = await supabase.auth.getSession()
  
  if (error || !session) {
    // Redirect to login if not authenticated
    redirect('/login')
  }
  
  // Get the user's profile ID
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('user_id', session.user.id)
    .single()
  
  if (profileError || !profile) {
    // Redirect to profile setup if profile doesn't exist
    redirect('/profile/setup')
  }
  
  // Redirect to the user's specific profile page
  redirect(`/profile/${profile.id}`)
} 