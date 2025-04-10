'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Session } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'
import { type Database } from '@/types/supabase'

// Create the Supabase client for the browser
const createClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createBrowserClient<Database>(
    supabaseUrl, 
    supabaseKey
  )
}

// Define the context type
type AuthContextType = {
  user: User | null
  session: Session | null
  isLoading: boolean
  signUp: (email: string, password: string) => Promise<{ error: any }>
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: any }>
}

// Create the auth context
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Provider component to wrap app
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Get the current session and user
    const getInitialSession = async () => {
      setIsLoading(true)
      
      try {
        const { data: { session } } = await supabase.auth.getSession()
        console.log('Auth Provider: Initial session check:', !!session)
        
        setSession(session)
        setUser(session?.user ?? null)
      } catch (error) {
        console.error('Auth Provider: Error getting initial session:', error)
      } finally {
        setIsLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth Provider: Auth state change event:', event)
        setSession(session)
        setUser(session?.user ?? null)
        setIsLoading(false)
      }
    )

    // Check for persisted auth state in localStorage
    const checkLocalStorage = () => {
      try {
        const storedAuth = localStorage.getItem('supabase_auth_state')
        if (storedAuth) {
          const authState = JSON.parse(storedAuth)
          console.log('Auth Provider: Found stored auth state:', authState.hasSession)
        }
      } catch (e) {
        console.error('Auth Provider: Error reading from localStorage', e)
      }
    }
    
    checkLocalStorage()

    // Cleanup subscription on unmount
    return () => subscription.unsubscribe()
  }, [])

  // Sign up with email and password
  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })
    
    return { error }
  }

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    console.log('Attempting signIn with:', { email });
    try {
      // Sign in with password - remove the forced signOut
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      console.log('Sign in response:', {
        success: !error,
        error: error?.message,
        hasUser: !!data.user,
        hasSession: !!data.session,
        sessionExpiresAt: data.session?.expires_at
      });
      
      if (!error) {
        // Update the user state immediately upon successful login
        setUser(data.user);
        setSession(data.session);
        
        // Persist session in localStorage as a fallback mechanism
        if (data.session) {
          try {
            localStorage.setItem('supabase_auth_state', JSON.stringify({
              hasSession: true,
              timestamp: Date.now()
            }));
          } catch (e) {
            console.error('Failed to store auth state in localStorage:', e);
          }
        }
      }
      
      return { data, error };
    } catch (error) {
      console.error('Sign in error:', error);
      return { error };
    }
  }

  // Sign out
  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  // Reset password
  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    
    return { error }
  }

  const value = {
    user,
    session,
    isLoading,
    signUp,
    signIn,
    signOut,
    resetPassword,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Custom hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 