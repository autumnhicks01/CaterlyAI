"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/app/context/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function AuthContextDebug() {
  const { user, session, signOut } = useAuth()
  const [timeStamp, setTimeStamp] = useState(new Date().toISOString())
  
  useEffect(() => {
    // Refresh timestamp every 3 seconds to see if session updates
    const interval = setInterval(() => {
      setTimeStamp(new Date().toISOString())
    }, 3000)
    
    return () => clearInterval(interval)
  }, [])
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Auth Context State</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Last updated: {timeStamp}
          </div>
          
          <div className="space-y-2">
            <h3 className="font-semibold">User</h3>
            {user ? (
              <pre className="bg-slate-100 p-2 rounded text-xs overflow-auto max-h-40">
                {JSON.stringify({
                  id: user.id,
                  email: user.email,
                  role: user.role,
                  aud: user.aud,
                  confirmed_at: user.confirmed_at,
                }, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-red-500">No user authenticated</p>
            )}
          </div>
          
          <div className="space-y-2">
            <h3 className="font-semibold">Session</h3>
            {session ? (
              <pre className="bg-slate-100 p-2 rounded text-xs overflow-auto max-h-40">
                {JSON.stringify({
                  access_token: session.access_token ? `${session.access_token.substring(0, 15)}...` : null,
                  refresh_token: session.refresh_token ? `${session.refresh_token.substring(0, 15)}...` : null,
                  expires_at: session.expires_at,
                  expires_in: session.expires_in,
                }, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-red-500">No active session</p>
            )}
          </div>
          
          <div className="pt-4">
            {user && session && (
              <Button 
                variant="destructive" 
                onClick={() => signOut()}
              >
                Sign Out
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 