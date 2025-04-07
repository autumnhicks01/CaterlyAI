"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Spinner } from "@/components/ui/spinner"

// This is just a placeholder page that redirects to the main AI profile page with the profile ID
export default function AIProfileLandingPage() {
  const router = useRouter()

  useEffect(() => {
    // Get profile id from local storage if available
    const profileId = typeof window !== 'undefined' ? localStorage.getItem('profileId') : null
    
    // Redirect to AI profile page if we have a profile ID
    if (profileId) {
      router.push(`/marketing/ai-profile/${profileId}`)
    } else {
      // Otherwise redirect to profile setup
      router.push('/profile/setup')
    }
  }, [router])

  return (
    <div className="flex justify-center items-center h-96">
      <Spinner size="lg" className="text-purple-500" />
    </div>
  )
} 