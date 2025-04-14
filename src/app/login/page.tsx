import { Suspense } from "react"
import { LoginForm } from "@/components/auth/login-form"
import { WaitlistForm } from "@/components/auth/waitlist-form"

// Remove client component for real-time debugging
// import { ClientDebugInfo } from '@/components/auth/client-debug-info'

export default function LoginPage() {
  return (
    <div className="container flex flex-col items-center justify-center min-h-[80vh] py-12 space-y-8">
      <div className="w-full max-w-3xl">
        <h1 className="text-3xl font-bold text-center mb-6">Smart Catering Solutions</h1>
        
        {/* YouTube Video Embed */}
        <div className="mb-8 relative w-full overflow-hidden" style={{ paddingBottom: '56.25%' }}>
          <iframe
            className="absolute top-0 left-0 w-full h-full rounded-lg"
            src="https://www.youtube.com/embed/BxlOxrDLV_4"
            title="Catering AI Demo"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      </div>
      
      <Suspense fallback={<div className="text-center">Loading waitlist form...</div>}>
        <WaitlistForm />
      </Suspense>
      
      <div className="w-full max-w-md mt-8">
        <details className="group">
          <summary className="flex w-full justify-between rounded-lg bg-gray-100 px-4 py-3 text-left text-sm font-medium text-gray-900 hover:bg-gray-200 cursor-pointer">
            <span>Already have an account? Login here</span>
            <span className="transition-transform group-open:rotate-180">
              ▼
            </span>
          </summary>
          <div className="pt-4">
            <Suspense fallback={<div className="text-center">Loading login form...</div>}>
              <LoginForm />
            </Suspense>
          </div>
        </details>
      </div>
      
      {/* Remove debug component that displays auth state in dev */}
      {/* {process.env.NODE_ENV !== 'production' && (
        <div className="mt-8 p-4 border rounded bg-black/5 w-full max-w-md text-xs">
          <ClientDebugInfo />
        </div>
      )} */}
    </div>
  )
} 