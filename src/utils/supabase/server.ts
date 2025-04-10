import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { type Database } from '@/types/supabase'

// This function now needs to be async since cookies() returns a Promise
export async function createClient() {
  // Await the cookies() function since it returns a Promise in Next.js 15
  const cookieStore = await cookies()
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  // Create the client with type safety
  return createServerClient<Database>(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value
        },
        set(name, value, options) {
          cookieStore.set({
            name,
            value,
            ...options,
            path: '/'
          })
        },
        remove(name, options) {
          cookieStore.set({
            name,
            value: '',
            ...options,
            path: '/',
            maxAge: 0
          })
        },
      },
    }
  )
} 