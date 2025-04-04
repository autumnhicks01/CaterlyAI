import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  try {
    const cookieStore = cookies()
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable");
      throw new Error("Supabase URL not configured");
    }
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable");
      throw new Error("Supabase anon key not configured");
    }
    
    console.log("Creating Supabase client with URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
    
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set({ name, value, ...options })
            } catch (error) {
              // This can fail in middleware as cookies is readonly
              console.warn("Failed to set cookie:", name, error);
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set({ name, value: '', ...options })
            } catch (error) {
              // This can fail in middleware as cookies is readonly
              console.warn("Failed to remove cookie:", name, error);
            }
          },
        },
      }
    )
  } catch (error) {
    console.error("Error creating Supabase client:", error);
    throw error;
  }
} 