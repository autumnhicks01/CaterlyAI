import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  const supabase = createClient()
  
  const { data: { session } } = await supabase.auth.getSession()
  
  return NextResponse.json({ 
    session,
    user: session?.user || null 
  })
} 