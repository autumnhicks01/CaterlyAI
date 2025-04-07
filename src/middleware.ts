import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { Database } from '@/types/supabase'

export async function middleware(req: NextRequest) {
  try {
    const res = NextResponse.next()
    
    // Create a Supabase client configured to use cookies
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookieOptions: {
          name: 'sb-auth-token',
          maxAge: 60 * 60 * 24 * 7, // 7 days 
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/'
        },
        cookies: {
          get: (name) => {
            const cookies = req.cookies.getAll();
            const cookie = cookies.find(cookie => cookie.name === name);
            return cookie?.value;
          },
          set: (name, value, options) => {
            // Ensure cookie options are consistent
            res.cookies.set({
              name,
              value,
              ...options,
              path: options.path || '/'
            });
          },
          remove: (name, options) => {
            res.cookies.delete({
              name,
              path: options?.path || '/',
              ...options,
            });
          },
        },
      }
    )
    
    // Get the session
    const { data: { session } } = await supabase.auth.getSession()
    
    // Validate the session exists
    let isAuthenticated = false;
    if (session) {
      isAuthenticated = true;
    }
    
    return handleAuthFlow(req, res, isAuthenticated);
  } catch (error) {
    console.error('Middleware error:', error)
    // Return next response to avoid blocking the request
    return NextResponse.next()
  }
}

function handleAuthFlow(req: NextRequest, res: NextResponse, isAuthenticated: boolean) {
  // Define protected paths that require authentication
  const protectedPaths = ['/profile', '/leads', '/campaign']
  
  // Skip middleware for test routes
  if (req.nextUrl.pathname.startsWith('/tests/') || req.nextUrl.pathname.startsWith('/_tests')) {
    return res
  }
  
  // Check if the requested path is protected
  const isProtectedPath = protectedPaths.some(path => req.nextUrl.pathname.startsWith(path))
  
  // Redirect unauthenticated users to login if they try to access protected routes
  if (isProtectedPath && !isAuthenticated) {
    const redirectUrl = new URL('/login', req.url)
    redirectUrl.searchParams.set('redirect', req.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }
  
  // Redirect authenticated users away from auth pages
  if (isAuthenticated && (req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/signup')) {
    return NextResponse.redirect(new URL('/profile', req.url))
  }
  
  return res
}

// Define which routes this middleware should run on
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|tests/|login|signup|favicon.ico|.*\\.png$).*)',
  ],
} 