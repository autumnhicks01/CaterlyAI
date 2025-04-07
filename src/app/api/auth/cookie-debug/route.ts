import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    // Get the cookie store - in Next.js 15 this returns a Promise
    const cookieStore = await cookies()
    
    // Set a test cookie
    cookieStore.set('test-cookie', 'value123', {
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/'
    })
    
    // Get all cookies
    const allCookies = cookieStore.getAll()
    
    // Get specific cookie
    const testCookie = cookieStore.get('test-cookie')
    
    return NextResponse.json({
      success: true,
      testCookie,
      allCookies,
      message: 'Cookie operations completed successfully'
    })
  } catch (error) {
    console.error('Cookie debug error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 