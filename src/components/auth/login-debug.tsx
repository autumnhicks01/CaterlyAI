"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginDebug() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setDebugInfo(null)

    try {
      // Create the Supabase client directly to bypass context issues
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      
      setDebugInfo(prev => ({ ...prev, supabaseUrl, supabaseKey: supabaseKey.substring(0, 10) + '...' }))
      
      if (!supabaseUrl || !supabaseKey) {
        setDebugInfo(prev => ({ ...prev, error: 'Missing environment variables' }))
        setIsLoading(false)
        return
      }

      const supabase = createBrowserClient(supabaseUrl, supabaseKey)
      
      // Attempt to sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) {
        setDebugInfo(prev => ({ ...prev, error: error.message }))
        setIsLoading(false)
        return
      }
      
      // Check if we got a session
      const { data: sessionData } = await supabase.auth.getSession()
      setDebugInfo(prev => ({ 
        ...prev, 
        success: true,
        session: sessionData.session ? 'Valid session' : 'No session',
        user: data.user ? {
          id: data.user.id,
          email: data.user.email,
          lastSignIn: data.user.last_sign_in_at
        } : null
      }))
      
      // Wait a moment to show debug info before redirecting
      setTimeout(() => {
        if (sessionData.session) {
          router.push('/')
          router.refresh()
        }
      }, 3000)
    } catch (error: any) {
      setDebugInfo({ catchError: error.message })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">Debug Login</h1>
        <p className="text-gray-500">Testing direct Supabase authentication</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Testing Login..." : "Test Login"}
        </Button>
      </form>
      
      {debugInfo && (
        <div className="mt-4 p-4 border rounded bg-gray-50">
          <h3 className="text-sm font-semibold mb-2">Debug Information:</h3>
          <pre className="text-xs overflow-auto max-h-40">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
} 