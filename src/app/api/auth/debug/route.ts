import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    // Get cookie information for debugging
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()
    
    // Return basic debug information about the session
    return NextResponse.json({
      authenticated: !!session,
      timestamp: new Date().toISOString(),
      hasUser: !!session?.user,
      userEmail: session?.user?.email || null,
      userId: session?.user?.id || null,
      cookieCount: allCookies.length,
      cookieNames: allCookies.map(c => c.name),
      environment: process.env.NODE_ENV || 'unknown'
    }, { status: 200 })
  } catch (error) {
    console.error('Auth debug error:', error)
    return NextResponse.json({ 
      error: 'Failed to check auth status',
      errorDetails: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
} 