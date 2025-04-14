import { Suspense } from "react"
import { WaitlistForm } from "@/components/auth/waitlist-form"
import { VideoEmbed } from "@/components/ui/video-embed"

export default function LoginPage() {
  return (
    <div className="container py-12">
      <div className="grid md:grid-cols-2 gap-8 items-start">
        <div className="flex flex-col">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Welcome to CaterlyAI</h1>
            <p className="text-gray-600">Your AI-powered catering assistant</p>
          </div>
          
          <div className="rounded-lg overflow-hidden shadow-lg mb-8">
            <VideoEmbed 
              url="https://www.youtube.com/embed/BxlOxrDLV_4" 
              title="Caterly Introduction" 
            />
          </div>
        </div>
        
        <div className="flex flex-col space-y-8">
          <Suspense fallback={<div className="text-center">Loading waitlist form...</div>}>
            <WaitlistForm />
          </Suspense>
          
          {/* Login temporarily hidden */}
          {/* <Suspense fallback={<div className="text-center">Loading login form...</div>}>
            <LoginForm />
          </Suspense> */}
        </div>
      </div>
    </div>
  )
} 