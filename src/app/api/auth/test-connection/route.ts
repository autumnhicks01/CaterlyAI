import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  const supabase = await createClient()
  
  // Get the current session
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    return NextResponse.json({ 
      authenticated: false,
      message: 'Not authenticated',
      user: null
    }, { status: 401 })
  }
  
  // Test a simple query to saved_leads table for the authenticated user
  const { data: savedLeads, error } = await supabase
    .from('saved_leads')
    .select('id, name')
    .eq('user_id', session.user.id)
    .limit(5)
  
  return NextResponse.json({ 
    authenticated: true,
    user: {
      id: session.user.id,
      email: session.user.email,
    },
    testQuery: {
      success: !error,
      data: savedLeads,
      error: error ? error.message : null
    }
  })
} 