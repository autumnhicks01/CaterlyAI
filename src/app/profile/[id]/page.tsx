"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { userProfileService, UserProfile } from "@/services/userProfileService"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Building2, User, MapPin, Clock, ArrowRight } from 'lucide-react'
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircleIcon } from "lucide-react"

// Extended UserProfile type to handle optional photo_urls
type ExtendedUserProfile = UserProfile & {
  photo_urls?: string[]
}

export default function ProfilePage() {
  const router = useRouter()
  const params = useParams()
  const profileId = params.id as string
  
  const [profile, setProfile] = useState<ExtendedUserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [photos, setPhotos] = useState<string[]>([])
  const [isResetting, setIsResetting] = useState(false)
  const [resetMessage, setResetMessage] = useState<string | null>(null)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true)
        const profileData = await userProfileService.getUserProfile()
        
        if (profileData) {
          setProfile(profileData as ExtendedUserProfile)
          
          // First check user_input_data for photos
          if (profileData.user_input_data && 
              profileData.user_input_data.photo_urls && 
              Array.isArray(profileData.user_input_data.photo_urls)) {
            setPhotos(profileData.user_input_data.photo_urls);
            console.log("Found photos in user_input_data:", profileData.user_input_data.photo_urls);
          }
          // Fallback to deprecated photo_urls on root level
          else if ('photo_urls' in profileData && 
              Array.isArray((profileData as any).photo_urls) && 
              (profileData as any).photo_urls.length > 0) {
            setPhotos((profileData as any).photo_urls);
            console.log("Found photos in root photo_urls:", (profileData as any).photo_urls);
          } else {
            console.log("No photos found in profile");
          }
          
          // Debug: log if we have coordinates in user_input_data
          if (profileData.user_input_data) {
            const userData = profileData.user_input_data as any;
            if (userData.coordinates) {
              console.log("Profile has coordinates:", JSON.stringify(userData.coordinates, null, 2));
            } else {
              console.log("Profile has no coordinates in user_input_data");
            }
          }
        } else {
          setError("Profile not found")
        }
      } catch (err) {
        setError("Failed to load profile. Please try again.")
        console.error("Error loading profile:", err)
      } finally {
        setLoading(false)
      }
    }

    if (profileId) {
      fetchProfile()
    }
  }, [profileId])

  // Function to reset the profile directly
  const handleResetProfile = async () => {
    try {
      setIsResetting(true)
      setResetMessage(null)

      const response = await fetch('/api/profile/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset profile')
      }

      setResetMessage('Profile successfully reset! Redirecting to setup page...')
      
      // After 2 seconds, redirect to profile setup
      setTimeout(() => {
        router.push('/profile/setup')
      }, 2000)
    } catch (error) {
      console.error('Error resetting profile:', error)
      setResetMessage(error instanceof Error ? error.message : 'An error occurred during profile reset')
    } finally {
      setIsResetting(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600">Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{error}</p>
            </CardContent>
            <CardFooter>
              <Button onClick={() => router.push("/profile/setup")}>
                Create a Profile
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No Profile Found</h1>
          <p className="mb-6">You haven't created a profile yet.</p>
          <Button onClick={() => router.push("/profile/setup")}>
            Create Profile
          </Button>
        </div>
      </div>
    )
  }
  
  // Check if we have photos
  const hasPhotos = photos.length > 0
  const primaryPhoto = hasPhotos ? photos[0] : '/placeholder.svg'

  // Check if we have AI profile data
  const hasAIProfile = profile.ai_profile_data && 
                     typeof profile.ai_profile_data === 'object' &&
                     'structuredProfile' in profile.ai_profile_data;

  // Safely access user input data properties
  const userInputData = typeof profile.user_input_data === 'object' ? profile.user_input_data : {};
  const serviceRadius = userInputData && 'service_radius' in userInputData ? 
    String(userInputData.service_radius) : null;
  const yearsInBusiness = userInputData && 'years_in_business' in userInputData ? 
    String(userInputData.years_in_business) : null;

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        {resetMessage && (
          <Alert className="mb-4 bg-green-50 border-green-200">
            <CheckCircleIcon className="h-4 w-4 text-green-600" />
            <AlertDescription className="ml-2 text-green-800">
              {resetMessage}
            </AlertDescription>
          </Alert>
        )}
        
        <Card className="mb-8 overflow-hidden">
          <CardHeader className="pb-0">
            <div className="flex justify-between items-center">
              <CardTitle>{profile.business_name || 'Your Business'}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => router.push("/profile/setup")}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="pt-4">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="md:w-1/3">
                <div className="aspect-square w-full relative rounded-md overflow-hidden border border-gray-200">
                  <Image
                    src={primaryPhoto}
                    alt="Business logo"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
              
              <div className="md:w-2/3 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center text-gray-600">
                    <Building2 className="w-4 h-4 mr-2" />
                    <span className="font-medium">Business Information</span>
                  </div>
                  <div className="pl-6">
                    <p><strong>Name:</strong> {profile.business_name}</p>
                    <p><strong>Type:</strong> {profile.business_type || 'Catering'}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center text-gray-600">
                    <MapPin className="w-4 h-4 mr-2" />
                    <span className="font-medium">Location</span>
                  </div>
                  <div className="pl-6">
                    <p>{profile.full_address}</p>
                    {serviceRadius && (
                      <p><strong>Service Radius:</strong> {serviceRadius}</p>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center text-gray-600">
                    <User className="w-4 h-4 mr-2" />
                    <span className="font-medium">Contact</span>
                  </div>
                  <div className="pl-6">
                    <p><strong>Phone:</strong> {profile.contact_phone || 'Not specified'}</p>
                    <p><strong>Website:</strong> {profile.website_url || 'Not specified'}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center text-gray-600">
                    <Clock className="w-4 h-4 mr-2" />
                    <span className="font-medium">Experience</span>
                  </div>
                  <div className="pl-6">
                    <p>{yearsInBusiness || 'Not specified'}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
          
          <CardFooter className="bg-gray-50 border-t flex justify-between py-4">
            <div className="text-sm text-gray-500">
              {profile.created_at && `Created on ${new Date(profile.created_at).toLocaleDateString()}`}
            </div>
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="text-orange-600 border-orange-200 hover:bg-orange-50"
                onClick={handleResetProfile}
                disabled={isResetting}
              >
                {isResetting ? "Resetting..." : "Reset Profile"}
              </Button>
              <Link href="/profile/account">
                <Button variant="outline" size="sm">
                  Account Settings
                </Button>
              </Link>
            </div>
          </CardFooter>
        </Card>
        
        {/* AI Profile Card */}
        <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-100">
          <CardHeader>
            <CardTitle className="text-purple-800">AI-Enhanced Business Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-gray-700">
              {hasAIProfile ? (
                <p>Your AI-enhanced profile is ready! This professional profile showcases your business
                in a way that highlights your unique offerings and attracts ideal clients.</p>
              ) : (
                <p>Generate an AI-enhanced profile to showcase your business in a professional way that 
                highlights your unique selling points and attracts your ideal clients.</p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            {hasAIProfile ? (
              <Link href={`/profile/${profileId}/ai-profile`}>
                <Button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                  View AI-Enhanced Profile
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Button 
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                onClick={() => {
                  // Redirect to the setup page with generate=ai parameter
                  router.push(`/profile/setup?generate=ai`)
                }}
              >
                Generate AI Profile
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </CardFooter>
        </Card>
        
        {/* Photo Gallery */}
        {hasPhotos && (
          <div className="mt-8">
            <h3 className="text-lg font-medium mb-4">Photo Gallery</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {photos.map((photo, index) => (
                <div key={index} className="aspect-square relative rounded-md overflow-hidden border border-gray-200">
                  <Image
                    src={photo}
                    alt={`Gallery image ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 