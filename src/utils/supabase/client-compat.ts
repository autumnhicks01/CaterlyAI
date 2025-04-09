import { createClient as createBrowserClient } from '@supabase/supabase-js'
import { type Database } from '@/types/supabase'

/**
 * Compatibility layer for Supabase client
 * Works in both App Router (server components) and Pages Router
 */
export async function createClient() {
  // Use environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  // Create a browser client that works in both contexts
  return createBrowserClient<Database>(supabaseUrl, supabaseKey)
} 