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
import { ArrowLeft } from 'lucide-react'
import { StructuredProfile } from "@/lib/ai/agents/profileAgent"
import { createClient } from "@/utils/supabase/client"
import { getAuthenticatedUser } from "@/utils/supabase/auth"

export default function AIProfilePage() {
  const router = useRouter()
  const params = useParams()
  const profileId = params.id as string
  
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [structured, setStructured] = useState<StructuredProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [photos, setPhotos] = useState<string[]>([])
  const [savedSuccessfully, setSavedSuccessfully] = useState(false)

  // Helper function to safely convert values to strings
  const getStringValue = (value: any): string => {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'object') {
      // If we encounter [object Object], handle it better
      if (Object.prototype.toString.call(value) === '[object Object]') {
        // If it's an address-like object with these properties, format it
        if ('address' in value || 'city' in value || 'state' in value || 'zip' in value || 'service_radius' in value) {
          const parts = [];
          if (value.address) parts.push(value.address);
          if (value.city) parts.push(value.city);
          if (value.state) parts.push(value.state);
          if (value.zip) parts.push(value.zip);
          return parts.join(', ');
        }
        
        // Try to find any string property we can use
        for (const key in value) {
          if (typeof value[key] === 'string' && value[key].trim().length > 0) {
            return value[key];
          }
        }
        
        // If we can't extract a reasonable string, return a more friendly message
        return 'Details not available';
      }
      
      // For other objects like arrays, stringify them more intelligently
      try {
        if (Array.isArray(value)) {
          return value.map(item => getStringValue(item)).join(', ');
        }
        return JSON.stringify(value);
      } catch (e) {
        return 'Invalid data';
      }
    }
    return String(value);
  }

  // Normalize an array property, ensuring it's an actual array
  const normalizeArray = (data: any): any[] => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        // If we can't parse it, treat the string as a single item
        return [data];
      }
    }
    // If it's some other type, wrap it in an array
    return [data];
  };

  // Type-safe function to create a default StructuredProfile
  const createDefaultStructuredProfile = (): StructuredProfile => {
    return {
      businessName: '',
      location: '',
      serviceArea: '',
      yearsExperience: '',
      contactPerson: {
        name: '',
        title: ''
      },
      mostRequestedDishes: [],
      overview: '',
      whyChooseUs: [],
      idealClients: '',
      testimonialsAndAwards: {
        testimonials: [],
        awards: []
      },
      contactInformation: {
        phone: '',
        email: '',
        socialMedia: []
      }
    };
  };

  // Function to ensure all array properties in the structured profile are actual arrays
  const normalizeStructuredProfile = (profile: any): StructuredProfile => {
    // Start with a complete default profile
    const normalized = createDefaultStructuredProfile();
    
    // Copy over all properties from the input profile
    if (profile) {
      // Make sure we're working with a proper object
      const profileObj = typeof profile === 'string' ? 
        JSON.parse(profile) : profile;
      
      // Try to extract businessName from different potential locations
      normalized.businessName = extractPropertySafely(profileObj, ['businessName', 'business_name', 'name'], '');
      
      // Copy simple string properties with proper fallbacks
      normalized.location = extractPropertySafely(profileObj, ['location', 'full_address', 'address'], '');
      normalized.serviceArea = extractPropertySafely(profileObj, ['serviceArea', 'service_area', 'delivery_radius'], '');
      normalized.yearsExperience = extractPropertySafely(profileObj, ['yearsExperience', 'years_experience', 'years'], '');
      normalized.overview = extractPropertySafely(profileObj, ['overview', 'description', 'about'], '');
      normalized.idealClients = extractPropertySafely(profileObj, ['idealClients', 'target_audience', 'target_market', 'clients'], '');
      
      // Handle contactPerson object
      if (profileObj.contactPerson) {
        normalized.contactPerson.name = extractPropertySafely(profileObj.contactPerson, ['name'], '');
        normalized.contactPerson.title = extractPropertySafely(profileObj.contactPerson, ['title', 'role', 'position'], '');
      } else {
        // Try to find contact info in other places
        normalized.contactPerson.name = extractPropertySafely(profileObj, ['contact_name', 'owner_name', 'manager'], '');
        normalized.contactPerson.title = extractPropertySafely(profileObj, ['contact_title', 'owner_title', 'position'], '');
      }
      
      // Handle array properties - ensure we get arrays even if data is malformed
      normalized.mostRequestedDishes = normalizeArray(
        extractPropertySafely(profileObj, ['mostRequestedDishes', 'dishes', 'menu_items', 'specialties'], [])
      );
      
      normalized.whyChooseUs = normalizeArray(
        extractPropertySafely(profileObj, ['whyChooseUs', 'selling_points', 'benefits', 'advantages'], [])
      );
      
      // Handle nested testimonials and awards
      if (profileObj.testimonialsAndAwards) {
        // Handle testimonials
        const testimonials = normalizeArray(
          extractPropertySafely(profileObj.testimonialsAndAwards, ['testimonials', 'reviews'], [])
        );
        
        normalized.testimonialsAndAwards.testimonials = testimonials.map(t => {
          // Handle if t is already an object with quote/source
          if (typeof t === 'object' && t !== null) {
            return {
              quote: extractPropertySafely(t, ['quote', 'text', 'content'], ''),
              source: extractPropertySafely(t, ['source', 'author', 'name'], '')
            };
          }
          // If t is just a string, assume it's the quote with no source
          return {
            quote: String(t || ''),
            source: 'Customer'
          };
        });
        
        // Handle awards
        normalized.testimonialsAndAwards.awards = normalizeArray(
          extractPropertySafely(profileObj.testimonialsAndAwards, ['awards', 'achievements', 'recognition'], [])
        ).map(award => String(award || ''));
      }
      
      // Handle contact information
      if (profileObj.contactInformation) {
        normalized.contactInformation.phone = extractPropertySafely(profileObj.contactInformation, ['phone', 'telephone', 'cell'], '');
        normalized.contactInformation.email = extractPropertySafely(profileObj.contactInformation, ['email', 'mail'], '');
        
        // Handle social media
        normalized.contactInformation.socialMedia = normalizeArray(
          extractPropertySafely(profileObj.contactInformation, ['socialMedia', 'social', 'profiles'], [])
        ).map(social => String(social || ''));
      } else {
        // Try to find contact info directly on the profile
        normalized.contactInformation.phone = extractPropertySafely(profileObj, ['phone', 'telephone', 'contact_phone'], '');
        normalized.contactInformation.email = extractPropertySafely(profileObj, ['email', 'mail', 'contact_email'], '');
        normalized.contactInformation.socialMedia = normalizeArray(
          extractPropertySafely(profileObj, ['social_media', 'social', 'website'], [])
        ).map(social => String(social || ''));
      }
    }
    
    return normalized;
  };
  
  // Helper function to safely extract properties from an object,
  // trying multiple possible property names
  const extractPropertySafely = (obj: any, propertyNames: string[], defaultValue: any): any => {
    if (!obj || typeof obj !== 'object') {
      return defaultValue;
    }
    
    for (const name of propertyNames) {
      if (obj[name] !== undefined && obj[name] !== null) {
        return obj[name];
      }
    }
    
    return defaultValue;
  };

  // Function to save structured profile to the database
  const saveStructuredProfileToDatabase = async () => {
    if (!profile || !structured) return;

    try {
      // Get authenticated user securely
      const { user, session } = await getAuthenticatedUser();
      
      if (!user || !session) {
        console.error("No active session found");
        return;
      }

      // Get metadata if it exists
      const aiData = profile.ai_profile_data as Record<string, any> || {};
      const existingMetadata = aiData.metadata || {};

      // Make a PATCH request to the profile/ai-data endpoint
      const response = await fetch('/api/profile/ai-data', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          structuredProfile: structured,
          metadata: {
            generatedAt: new Date().toISOString(),
            characterCount: JSON.stringify(structured).length,
            generationTime: existingMetadata.generationTime || 0,
            modelUsed: existingMetadata.modelUsed || 'gpt-4'
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error saving structured profile:", errorData);
        return;
      }

      const result = await response.json();
      console.log("Structured profile saved successfully:", result);
      setSavedSuccessfully(true);
    } catch (error) {
      console.error("Error saving structured profile:", error);
    }
  }

  // Function to extract structured profile from potentially different formats
  const extractStructuredProfile = (aiData: any): StructuredProfile | null => {
    // If aiData is null or undefined
    if (!aiData) return null;
    
    // Handle case where structuredProfile might be a string
    if (aiData.structuredProfile) {
      // If it's a string (JSON), parse it
      if (typeof aiData.structuredProfile === 'string') {
        try {
          return JSON.parse(aiData.structuredProfile);
        } catch (error) {
          console.error("Failed to parse structuredProfile string:", error);
          return null;
        }
      }
      
      // If it's already an object
      if (typeof aiData.structuredProfile === 'object') {
        return aiData.structuredProfile as StructuredProfile;
      }
    }
    
    // Handle case where the entire aiData might be the structured profile
    if ('businessName' in aiData && 'location' in aiData && 'overview' in aiData) {
      return aiData as StructuredProfile;
    }
    
    return null;
  };

  // Function to directly regenerate the AI profile
  const regenerateAIProfile = async () => {
    try {
      if (!profile) {
        console.error("No profile data available for regeneration");
        setError("Profile data is missing. Please try returning to your profile page first.");
        return;
      }

      // Show loading state
      setLoading(true);
      setError(null);

      // Get user input data from the profile and cast it to the right type
      const userData = profile.user_input_data ? 
        (profile.user_input_data as Record<string, any>) : {};
      
      // Log available profile data for debugging
      console.log("Profile data available for regeneration:", {
        id: profile.id,
        business_name: profile.business_name,
        full_address: profile.full_address,
        hasUserData: !!profile.user_input_data,
        coordinates: userData.coordinates ? 'present' : 'missing',
      });
      
      // Extract cuisine specialties from userData or use a default
      const cuisineSpecialties = userData.cuisineSpecialties || 
        "Diverse cuisine options customized to client preferences";
      
      // Extract unique selling points from userData or use defaults based on business name
      const uniqueSellingPoints = userData.uniqueSellingPoints || 
        `Quality ingredients, professional service, and customized menus for ${profile.business_name || "your catering needs"}`;
      
      // Check for valid location data
      const location = userData.location || profile.full_address || "Your location";
      if (!location || location === "Your location") {
        console.warn("No specific location found in profile. This may affect AI profile quality.");
      }
      
      // Extract necessary data and ensure all fields have values
      const requestData = {
        businessName: userData.businessName || profile.business_name || "Your Catering Business",
        location: location,
        serviceRadius: userData.serviceRadius || profile.delivery_radius?.toString() || "Local area",
        yearsInOperation: userData.yearsInOperation || "Established catering service",
        idealClients: userData.idealClients || "Weddings, corporate events, special celebrations, and private parties",
        signatureDishesOrCuisines: cuisineSpecialties,
        uniqueSellingPoints: uniqueSellingPoints,
        brandVoiceAndStyle: userData.focus || "Professional, friendly, and client-focused", 
        testimonialsOrAwards: userData.testimonials || "Known for excellent service and delicious cuisine",
        contactInformation: {
          phone: userData.contactPhone || profile.contact_phone || "Your contact number",
          email: (userData.ownerContact && userData.ownerContact.includes("@")) ? 
            userData.ownerContact : (userData.email || "Your email"),
          website: userData.websiteUrl || profile.website_url || "Your website",
          socialMedia: Array.isArray(userData.socialMedia) ? userData.socialMedia : []
        }
      };

      console.log("Regenerating AI profile with data:", requestData);

      // Ensure the user is authenticated before making the API call
      const { user, session } = await getAuthenticatedUser();
      
      if (!user || !session) {
        setError("Authentication required. Please log in again.");
        setLoading(false);
        return;
      }

      // Call our regenerate endpoint with credentials to ensure cookies are sent
      const response = await fetch('/api/profile/regenerate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies in the request
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to regenerate profile");
      }

      const data = await response.json();
      console.log("AI profile regenerated successfully:", data);

      // Reload the current page to show the updated profile
      window.location.reload();
    } catch (error) {
      console.error("Error regenerating profile:", error);
      setError(error instanceof Error ? error.message : "Failed to regenerate profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true)
        console.log("Fetching profile...");
        const profileData = await userProfileService.getUserProfile()
        
        if (profileData) {
          console.log("Profile data retrieved:", JSON.stringify(profileData, null, 2));
          setProfile(profileData)
          
          // Get photo URLs
          if (profileData.photo_urls && Array.isArray(profileData.photo_urls)) {
            console.log("Photo URLs found:", profileData.photo_urls);
            setPhotos(profileData.photo_urls)
          } else {
            console.log("No photo URLs found in profile");
          }
          
          // Extract the structured profile from AI data
          if (profileData.ai_profile_data) {
            console.log("AI profile data found");
            // Log the actual data for debugging
            console.log("AI profile data type:", typeof profileData.ai_profile_data);
            console.log("Raw AI profile data:", JSON.stringify(profileData.ai_profile_data, null, 2));
            
            // Handle different possible formats of ai_profile_data
            let aiData: any;
            
            // If ai_profile_data is a string, try to parse it
            if (typeof profileData.ai_profile_data === 'string') {
              try {
                aiData = JSON.parse(profileData.ai_profile_data);
                console.log("Parsed ai_profile_data from string:", aiData);
              } catch (error) {
                console.error("Failed to parse ai_profile_data string:", error);
                setError("Failed to parse AI profile data");
                setLoading(false);
                return;
              }
            } else {
              // Otherwise treat it as an object
              aiData = profileData.ai_profile_data as Record<string, any>;
            }
            
            // Extract structured profile using our helper function
            const structuredProfile = extractStructuredProfile(aiData);
            
            if (structuredProfile) {
              console.log("Structured profile extracted successfully");
              
              // Normalize the profile to ensure arrays are handled correctly
              const normalizedProfile = normalizeStructuredProfile(structuredProfile);
              console.log("Normalized structured profile:", JSON.stringify(normalizedProfile, null, 2));
              
              // Log the normalized arrays
              console.log("Normalized mostRequestedDishes:", normalizedProfile.mostRequestedDishes);
              console.log("Normalized whyChooseUs:", normalizedProfile.whyChooseUs);
              
              setStructured(normalizedProfile);
            } else {
              console.log("No structuredProfile could be extracted from ai_profile_data");
              setError("AI profile data exists but no structured profile found");
            }
          } else {
            console.log("No ai_profile_data found in profile");
            setError("No AI profile data found")
          }
        } else {
          console.log("No profile data returned from userProfileService");
          setError("Profile not found")
        }
      } catch (err) {
        console.error("Error loading profile:", err)
        setError("Failed to load profile. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    if (profileId) {
      fetchProfile()
    }
  }, [profileId])

  // Save the structured profile if it exists but isn't saved yet
  useEffect(() => {
    if (structured && profile && !savedSuccessfully) {
      saveStructuredProfileToDatabase();
    }
  }, [structured, profile, savedSuccessfully]);

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
      <div className="container mx-auto px-4 py-12 relative">
        <div className="max-w-4xl mx-auto">
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600">Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{error}</p>
              {error.includes('Authentication') && (
                <p className="mt-2 text-sm">Your session may have expired. Please log in again to continue.</p>
              )}
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button onClick={() => router.push(`/profile/${profileId}`)}>
                Return to Profile
              </Button>
              {error.includes('Authentication') && (
                <Button variant="outline" onClick={() => router.push('/login?redirect=' + encodeURIComponent(`/profile/${profileId}/ai-profile`))}>
                  Log In Again
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>
      </div>
    )
  }

  if (!profile || !structured) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No AI-Enhanced Profile Found</h1>
          <p className="mb-6">You haven't generated an AI profile yet.</p>
          <Button onClick={() => router.push(`/profile/${profileId}`)}>
            Generate AI Profile
          </Button>
        </div>
      </div>
    )
  }

  // Check if we have photos
  const hasPhotos = photos.length > 0
  const primaryPhoto = hasPhotos ? photos[0] : '/placeholder.svg'
  const secondaryPhoto = hasPhotos && photos.length > 1 ? photos[1] : '/placeholder.svg'

  // Get AI metadata if available
  const aiData = profile.ai_profile_data as Record<string, any> || {}
  const metadata = aiData.metadata || null

  // Extract user input data for fallbacks
  const userData = profile.user_input_data ? 
    (profile.user_input_data as Record<string, any>) : {};

  // Get contact information from profile if available
  const contactPhone = profile.contact_phone || '';
  // Extract contact email from user_input_data or AI generated data
  const contactEmail = userData.email || (structured.contactInformation?.email || '');
  const websiteUrl = profile.website_url || '';
  // Get social media links from user input data if available
  const socialMediaLinks = userData.socialMedia && Array.isArray(userData.socialMedia) 
    ? userData.socialMedia 
    : [];

  // Safely extract location and serviceArea as strings
  const locationString = getStringValue(structured.location || '');
  const serviceAreaString = getStringValue(structured.serviceArea || '');
  const businessNameString = getStringValue(structured.businessName || '');
  const yearsExperienceString = getStringValue(structured.yearsExperience || '');

  // Safely extract dishes and selling points, ensuring they're arrays
  const mostRequestedDishes = Array.isArray(structured.mostRequestedDishes) ? structured.mostRequestedDishes : [];
  const whyChooseUs = Array.isArray(structured.whyChooseUs) ? structured.whyChooseUs : [];
  const hasDishes = mostRequestedDishes.length > 0;
  const hasSellingPoints = whyChooseUs.length > 0;

  return (
    <div className="container mx-auto px-4 py-12 relative">
      {/* Background effects */}
      <div className="absolute -top-20 right-0 w-96 h-96 bg-purple-500/5 rounded-full filter blur-3xl animate-pulse-slow"></div>
      <div className="absolute bottom-20 -left-20 w-96 h-96 bg-blue-500/5 rounded-full filter blur-3xl animate-pulse-slow animation-delay-700"></div>
      
      <div className="relative max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Link href={`/profile/${profileId}`} className="flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Profile
          </Link>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={regenerateAIProfile}
            disabled={loading}
            className="text-xs"
          >
            {loading ? (
              <>
                <svg className="w-3 h-3 mr-1 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Regenerating...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                </svg>
                Regenerate
              </>
            )}
          </Button>
        </div>
        
        <Card className="border border-purple-500/10 bg-card shadow-xl overflow-hidden mt-8">
          <CardHeader className="border-b border-purple-200/20 bg-purple-50/5">
            <div className="flex justify-between items-center">
              <CardTitle className="text-purple-900">
                {businessNameString || profile.business_name || 'Your Business'}
              </CardTitle>
              <div className="flex items-center gap-2">
                {profile.created_at && (
                  <span className="text-sm text-gray-500">
                    {new Date(profile.created_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            <div className="text-sm text-gray-600">
              {locationString || profile.full_address || 'Location not specified'}
              {serviceAreaString ? `, ${serviceAreaString}` : ''}
            </div>
            {metadata && (
              <div className="mt-2 flex items-center gap-2">
                {metadata.generationTime && (
                  <Badge variant="outline" className="text-xs font-normal bg-gray-50/50">
                    Generated in {parseFloat(metadata.generationTime.toString()).toFixed(1)}s
                  </Badge>
                )}
                {metadata.modelUsed && (
                  <Badge variant="outline" className="text-xs font-normal bg-gray-50/50">
                    {metadata.modelUsed}
                  </Badge>
                )}
              </div>
            )}
            {error && (
              <div className="mt-2 text-sm text-red-500">
                Error: {error}
              </div>
            )}
          </CardHeader>
          
          <CardContent className="p-6 pt-8">
            <div className="space-y-8">
              {/* Business header */}
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="aspect-square w-24 h-24 relative rounded-md overflow-hidden border border-gray-200 flex-shrink-0">
                  <Image
                    src={primaryPhoto}
                    alt={businessNameString || "Business logo"}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="space-y-4 flex-1">
                  <div>
                    <h2 className="text-2xl font-bold text-card-foreground">
                      {businessNameString || profile.business_name || 'Your Business'}
                    </h2>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-muted-foreground text-sm">
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-1 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>
                          {locationString || profile.full_address || 'Location not specified'}
                          {serviceAreaString ? `, ${serviceAreaString}` : ''}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-1 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>{yearsExperienceString || 'Established business'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="aspect-square w-12 h-12 relative rounded-full overflow-hidden border border-gray-200 flex-shrink-0 mr-3">
                      <Image
                        src={secondaryPhoto}
                        alt="Contact person"
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <h4 className="font-medium text-card-foreground">Contact Person:</h4>
                      <p className="text-muted-foreground">
                        {structured.contactPerson && structured.contactPerson.name 
                          ? getStringValue(structured.contactPerson.name) 
                          : 'Contact Manager'}
                        {structured.contactPerson && structured.contactPerson.title 
                          ? `, ${getStringValue(structured.contactPerson.title)}` 
                          : ''}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Most requested dishes */}
              <div>
                <h3 className="text-lg font-medium mb-2 text-card-foreground">Most Requested Dishes:</h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  {hasDishes ? (
                    mostRequestedDishes.map((cuisine, i) => (
                      <span 
                        key={i} 
                        className="px-3 py-1 rounded-full text-sm bg-gradient-to-r from-purple-100 to-blue-100 text-purple-800 border border-purple-200/50"
                      >
                        {getStringValue(cuisine)}
                      </span>
                    ))
                  ) : (
                    <p className="text-muted-foreground">
                      This business hasn't specified any signature dishes yet.
                      {userData?.cuisineSpecialties ? ` They specialize in ${userData.cuisineSpecialties}.` : ''}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Overview */}
              <div>
                <h3 className="text-lg font-medium mb-2 text-card-foreground">Overview:</h3>
                <p className="text-card-foreground leading-relaxed">
                  {getStringValue(structured.overview) || 
                   `${profile.business_name || 'This business'} offers catering services` + 
                   (profile.full_address ? ` in ${profile.full_address}` : '') + 
                   '. Contact them for more information about their services.'}
                </p>
              </div>
              
              {/* Why Choose Us */}
              <div>
                <h3 className="text-lg font-medium mb-2 text-card-foreground">Why Choose Us:</h3>
                <div className="space-y-2">
                  {hasSellingPoints ? (
                    whyChooseUs.map((point, i) => (
                      <div key={i} className="flex items-start">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs mr-2 mt-0.5 flex-shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        </div>
                        <p className="text-card-foreground">{getStringValue(point)}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">
                      No specific selling points have been added yet.
                      {userData?.uniqueSellingPoints ? 
                      ` Their unique qualities include: ${userData.uniqueSellingPoints}` : ''}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Ideal Clients */}
              <div>
                <h3 className="text-lg font-medium mb-2 text-card-foreground">Ideal Clients:</h3>
                <p className="text-card-foreground">
                  {getStringValue(structured.idealClients) || 
                   userData?.idealClients || 
                   'All types of clients and events'}
                </p>
              </div>
              
              {/* Customer Reviews & Awards */}
              {structured.testimonialsAndAwards && 
                ((structured.testimonialsAndAwards.testimonials && structured.testimonialsAndAwards.testimonials.length > 0) || 
                 (structured.testimonialsAndAwards.awards && structured.testimonialsAndAwards.awards.length > 0)) && (
                <div>
                  <h3 className="text-lg font-medium mb-2 text-card-foreground">Customer Reviews & Awards:</h3>
                  <div className="space-y-3">
                    {structured.testimonialsAndAwards.testimonials && 
                      structured.testimonialsAndAwards.testimonials.map((testimonial, i) => (
                        <div key={i} className="p-4 bg-gradient-to-r from-purple-50/30 to-blue-50/30 rounded-lg border border-purple-100/30">
                          <p className="text-card-foreground italic">
                            "{getStringValue(testimonial.quote)}"
                          </p>
                          <p className="text-sm text-muted-foreground mt-2">— {getStringValue(testimonial.source)}</p>
                        </div>
                      ))
                    }
                    
                    {structured.testimonialsAndAwards.awards && 
                      structured.testimonialsAndAwards.awards.map((award, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 flex items-center justify-center text-white flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                            </svg>
                          </div>
                          <p className="text-card-foreground">{getStringValue(award)}</p>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
              
              {/* How to Connect */}
              <div>
                <h3 className="text-lg font-medium mb-2 text-card-foreground">How to Connect:</h3>
                <p className="text-card-foreground mb-3">
                  Ready to book or have questions? Contact us using the information below:
                </p>
                <div className="flex flex-wrap gap-3">
                  {/* Phone - Use profile contact_phone as fallback */}
                  {(structured.contactInformation?.phone || contactPhone) && (
                    <div className="flex items-center text-card-foreground bg-white/10 px-3 py-2 rounded-md border border-purple-200/20">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span>{getStringValue(structured.contactInformation?.phone || contactPhone)}</span>
                    </div>
                  )}
                  
                  {/* Email - Use profile contact_email as fallback */}
                  {(structured.contactInformation?.email || contactEmail) && (
                    <div className="flex items-center text-card-foreground bg-white/10 px-3 py-2 rounded-md border border-purple-200/20">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span>{getStringValue(structured.contactInformation?.email || contactEmail)}</span>
                    </div>
                  )}
                  
                  {/* Website URL - Use profile website_url as fallback */}
                  {websiteUrl && (
                    <div className="flex items-center text-card-foreground bg-white/10 px-3 py-2 rounded-md border border-purple-200/20">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      <span>{getStringValue(websiteUrl)}</span>
                    </div>
                  )}
                  
                  {/* Social Media - Combine both sources */}
                  {(() => {
                    // Combine social media links from both sources without duplicates
                    const allSocialLinks = [
                      ...(structured.contactInformation?.socialMedia || []),
                      ...(socialMediaLinks || [])
                    ];
                    
                    // Filter out empty strings and remove duplicates
                    const uniqueSocialLinks = [...new Set(allSocialLinks.filter(link => link))];
                    
                    return uniqueSocialLinks.map((social, i) => (
                      <div key={i} className="flex items-center text-card-foreground bg-white/10 px-3 py-2 rounded-md border border-purple-200/20">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>{getStringValue(social)}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </CardContent>
          
          <CardFooter className="bg-gray-50 dark:bg-gray-900/20 border-t border-gray-100 dark:border-gray-800 p-4">
            <div className="flex justify-between items-center w-full">
              <div className="text-sm text-gray-500">
                Enhanced with AI
                {metadata?.characterCount && ` • ${metadata.characterCount} characters`}
              </div>
              <Link href="/campaign/setup">
                <Button>
                  Continue to Campaign Setup
                </Button>
              </Link>
            </div>
          </CardFooter>
        </Card>

        {/* Photo Gallery */}
        {hasPhotos && (
          <div className="mt-8">
            <h3 className="text-lg font-medium mb-4 text-card-foreground">Photo Gallery</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {photos.map((photo, index) => (
                <div key={index} className="aspect-video relative rounded-md overflow-hidden border border-gray-200">
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