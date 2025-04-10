import { Suspense } from "react"
import { LoginForm } from "@/components/auth/login-form"

// Add a client component for real-time debugging
import { ClientDebugInfo } from '@/components/auth/client-debug-info'

export default function LoginPage() {
  return (
    <div className="container flex flex-col items-center justify-center min-h-[80vh] py-12">
      {/* Add a hidden debug element for Vercel deployment - helps with debugging */}
      <div className="hidden">
        <div id="login-page-loaded" data-timestamp={Date.now()}>Login page loaded</div>
      </div>
      
      <Suspense fallback={<div className="text-center">Loading login form...</div>}>
        <LoginForm />
      </Suspense>
      
      {/* Debug component that displays auth state in dev - hidden in production */}
      {process.env.NODE_ENV !== 'production' && (
        <div className="mt-8 p-4 border rounded bg-black/5 w-full max-w-md text-xs">
          <ClientDebugInfo />
        </div>
      )}
    </div>
  )
} 