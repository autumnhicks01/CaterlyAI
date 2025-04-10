'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/app/context/auth-context'
import { useCaterly } from '@/app/context/caterly-context'

export function ClientDebugInfo() {
  const { user: authUser, session, isLoading } = useAuth()
  const { user: caterlyUser } = useCaterly()
  const [apiStatus, setApiStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkAuthStatus() {
      try {
        const response = await fetch('/api/auth/debug')
        const data = await response.json()
        setApiStatus(data)
      } catch (error) {
        setApiStatus({ error: 'Failed to fetch auth status' })
      } finally {
        setLoading(false)
      }
    }

    checkAuthStatus()
  }, [])

  return (
    <div className="text-xs font-mono">
      <h3 className="font-bold mb-2">Auth Debug Info</h3>
      <div className="grid grid-cols-2 gap-1">
        <div className="font-semibold">Auth Context:</div>
        <div>{authUser ? '✅ User Logged In' : (isLoading ? '⏳ Loading...' : '❌ No User')}</div>
        
        <div className="font-semibold">Caterly Context:</div>
        <div>{caterlyUser ? '✅ User Set' : '❌ No User'}</div>
        
        <div className="font-semibold">User Email:</div>
        <div>{authUser?.email || 'None'}</div>
        
        <div className="font-semibold">Session:</div>
        <div>{session ? '✅ Valid' : '❌ None'}</div>
      </div>

      <h3 className="font-bold mt-4 mb-2">API Auth Status</h3>
      {loading ? (
        <div>Loading API status...</div>
      ) : (
        <pre className="bg-gray-100 p-2 rounded overflow-auto max-h-40 text-[10px]">
          {JSON.stringify(apiStatus, null, 2)}
        </pre>
      )}
    </div>
  )
} 