import { NextResponse } from 'next/server';
import { templateCache } from '@/agents/outreachAgent';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase for auth checks
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; // Use service role for server
const supabase = createClient(supabaseUrl, supabaseKey);

// Access the cache from outreachAgent
// This is a simplified version for demo. In production, we would
// either need to expose the cache or store cached templates in a database

export async function POST(request: Request) {
  try {
    // Check for CSRF token and session cookies
    const hasCSRFHeader = request.headers.get('x-csrf-protection') === '1';
    console.log('Has CSRF header:', hasCSRFHeader);

    // Get the session from the cookie - server-side auth only
    const { data: { session } } = await supabase.auth.getSession();

    // In development mode, allow requests without session for testing
    const isDev = process.env.NODE_ENV === 'development';
    if ((!session || !session.user) && !isDev) {
      console.log('API: No session found in outreach/cached-status');
      return NextResponse.json(
        { error: 'Unauthorized - not authenticated' },
        { status: 401 }
      );
    }

    // Log the session info
    if (session && session.user) {
      console.log(`API: Session found in cached-status for user: ${session.user.id}`);
    } else if (isDev) {
      console.log('API: Development mode - proceeding without session');
    }

    const body = await request.json();
    const { category } = body;

    if (!category) {
      return NextResponse.json(
        { error: 'Category is required' },
        { status: 400 }
      );
    }

    // Normalize category for consistent caching
    const normalizedCategory = category.toLowerCase().trim();
    
    // Check if this category exists in cache and hasn't expired
    const cacheKey = `category:${normalizedCategory}`;
    const cacheEntry = templateCache[cacheKey];
    const isCacheValid = cacheEntry && (Date.now() - cacheEntry.timestamp < 6 * 60 * 60 * 1000);
    
    return NextResponse.json({
      cached: !!isCacheValid,
      category: normalizedCategory
    });
  } catch (error) {
    console.error('Error checking cache status:', error);
    return NextResponse.json(
      { error: 'Failed to check cache status' },
      { status: 500 }
    );
  }
} 