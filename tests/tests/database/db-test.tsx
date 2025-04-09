"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { useAuth } from "@/app/context/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function DatabaseTest() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [testData, setTestData] = useState("")
  const [status, setStatus] = useState<{ success?: boolean; message: string }>({
    message: "No operations performed yet"
  })

  // Create direct Supabase client for testing
  const createClient = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    return createBrowserClient(supabaseUrl, supabaseKey)
  }

  // Check if user is authenticated
  useEffect(() => {
    if (!user) {
      setStatus({ message: "Not authenticated. Please log in first." })
      return
    }

    setStatus({ message: `Authenticated as ${user.email}` })
    fetchProfile()
  }, [user])

  // Fetch user profile from database
  const fetchProfile = async () => {
    if (!user) return
    
    setLoading(true)
    setStatus({ message: "Fetching profile data..." })
    
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (error) {
        console.error("Error fetching profile:", error)
        setStatus({ success: false, message: `Error fetching profile: ${error.message}` })
        return
      }
      
      setProfile(data)
      setStatus({ 
        success: true, 
        message: data 
          ? `Successfully fetched profile ID: ${data.id}` 
          : "No profile found for this user"
      })
    } catch (error: any) {
      console.error("Error:", error)
      setStatus({ success: false, message: `Error: ${error.message}` })
    } finally {
      setLoading(false)
    }
  }

  // Write test data to user profile
  const writeTestData = async () => {
    if (!user) return
    
    setLoading(true)
    setStatus({ message: "Writing test data..." })
    
    try {
      const supabase = createClient()
      
      // First check if profile exists
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()
      
      let result
      const timestamp = new Date().toISOString()
      
      if (existingProfile) {
        // Update existing profile with test data
        result = await supabase
          .from('user_profiles')
          .update({
            test_field: testData,
            last_test_timestamp: timestamp
          })
          .eq('id', existingProfile.id)
          .select()
          .single()
      } else {
        // Create new profile with test data
        result = await supabase
          .from('user_profiles')
          .insert({
            user_id: user.id,
            test_field: testData,
            business_name: "Test Business",
            full_address: "Test Address",
            last_test_timestamp: timestamp
          })
          .select()
          .single()
      }
      
      if (result.error) {
        setStatus({ success: false, message: `Write error: ${result.error.message}` })
        return
      }
      
      // Refresh profile data
      fetchProfile()
      
      setStatus({ success: true, message: `Successfully wrote test data at ${timestamp}` })
    } catch (error: any) {
      console.error("Error:", error)
      setStatus({ success: false, message: `Error: ${error.message}` })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Database Operations Test</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* User Status */}
          <div className="p-4 border rounded bg-secondary/10">
            <h3 className="font-medium mb-2">Authentication Status:</h3>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${user ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>{user ? `Authenticated (${user.email})` : 'Not authenticated'}</span>
            </div>
          </div>
          
          {/* Test Operations */}
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">1. Fetch User Profile Data</h3>
              <Button 
                onClick={fetchProfile} 
                disabled={loading || !user}
              >
                Fetch Profile
              </Button>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-medium mb-2">2. Write Test Data</h3>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="test-data">Test Data</Label>
                  <Input
                    id="test-data"
                    value={testData}
                    onChange={(e) => setTestData(e.target.value)}
                    placeholder="Enter test data to write"
                  />
                </div>
                <Button 
                  onClick={writeTestData} 
                  disabled={loading || !user || !testData}
                  className="self-end"
                >
                  Write Data
                </Button>
              </div>
            </div>
          </div>
          
          {/* Status Message */}
          <div className={`p-4 border rounded ${
            status.success === undefined 
              ? 'bg-gray-50' 
              : status.success 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
          }`}>
            <h3 className="font-medium mb-2">Status:</h3>
            <p className={status.success === false ? 'text-red-600' : ''}>{status.message}</p>
          </div>
          
          {/* Profile Data */}
          {profile && (
            <div className="mt-4">
              <h3 className="font-medium mb-2">Profile Data:</h3>
              <pre className="p-4 bg-slate-100 rounded overflow-auto max-h-96 text-xs">
                {JSON.stringify(profile, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
} 