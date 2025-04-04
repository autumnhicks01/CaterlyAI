"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/app/context/auth-context"
import { useCaterly } from "@/app/context/caterly-context"

export function ProfileLoader({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { setProfile } = useCaterly()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadProfile() {
      if (!user) {
        setIsLoading(false)
        return
      }

      try {
        console.log("ProfileLoader: Loading profile data for user", user.id)
        const response = await fetch("/api/profile/current")
        
        if (!response.ok) {
          throw new Error(`Failed to load profile: ${response.status}`)
        }
        
        const data = await response.json()
        
        if (data.authenticated && data.profile) {
          console.log("ProfileLoader: Profile loaded successfully", data.profile)
          
          // Map API response to our context profile shape
          const contextProfile = {
            id: data.profile.id,
            business_name: data.profile.business_name,
            photos: data.profile.user_input_data?.photo_urls || [],
            menuLink: data.profile.website_url || "",
            managerContact: data.profile.contact_phone || "",
            orderingLink: "",
            focus: data.profile.business_type || "",
            description: data.profile.description || "",
            idealClients: data.profile.ideal_clients || "",
            location: data.profile.full_address || "",
            full_address: data.profile.full_address || "",
            service_radius: data.profile.delivery_radius || 25,
            user_input_data: data.profile.user_input_data || null
          }
          
          setProfile(contextProfile)
        } else {
          console.log("ProfileLoader: No profile found for user")
        }
      } catch (err) {
        console.error("ProfileLoader: Error loading profile", err)
        setError(err instanceof Error ? err.message : "Unknown error loading profile")
      } finally {
        setIsLoading(false)
      }
    }

    loadProfile()
  }, [user, setProfile])

  // Simply render children, this is just for side effects
  return <>{children}</>
} 