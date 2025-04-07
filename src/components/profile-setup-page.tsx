"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Script from "next/script"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { useCaterly, useCatering } from "../app/context/caterly-context"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/app/context/auth-context"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { userProfileService } from "@/services/userProfileService"

// Define location type with coordinates
interface Location {
  address: string;
  coordinates: {
    lat: number;
    lng: number;
  } | null;
}

export default function ProfileSetupPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState("basics")
  const [photos, setPhotos] = useState<string[]>([
    "/placeholder.svg?height=300&width=400",
    "/placeholder.svg?height=300&width=400",
    "/placeholder.svg?height=300&width=400",
  ])
  // Business Basics
  const [businessName, setBusinessName] = useState("")
  const [ownerContact, setOwnerContact] = useState("")
  const [location, setLocation] = useState<Location>({ address: "", coordinates: null })
  const [serviceRadius, setServiceRadius] = useState("")
  const [yearsInOperation, setYearsInOperation] = useState("")
  
  // Target Customers & Specialties
  const [idealClients, setIdealClients] = useState("")
  const [cuisineSpecialties, setCuisineSpecialties] = useState("")
  const [uniqueSellingPoints, setUniqueSellingPoints] = useState("")
  
  // Capacity & Services
  const [eventSizes, setEventSizes] = useState("")
  const [serviceTypes, setServiceTypes] = useState("")
  const [customizationOptions, setCustomizationOptions] = useState("")
  
  // Original fields
  const [menuLink, setMenuLink] = useState("")
  const [managerContact, setManagerContact] = useState("")
  const [orderingLink, setOrderingLink] = useState("")
  const [focus, setFocus] = useState("")
  const [generatedProfile, setGeneratedProfile] = useState("")
  const [showPreview, setShowPreview] = useState(false)
  const [profileStrength, setProfileStrength] = useState(0)
  const [generationMetadata, setGenerationMetadata] = useState<{
    characterCount: number;
    generationTime: number;
    modelUsed: string;
  } | null>(null)
  
  // Track if we're editing an existing profile
  const [isEditMode, setIsEditMode] = useState(false)
  const [existingProfileId, setExistingProfileId] = useState<string | null>(null)
  
  // Reference for place autocomplete
  const placeAutocompleteRef = useRef<HTMLDivElement>(null)
  const [placesLoaded, setPlacesLoaded] = useState(false)

  // Add state for saved profile
  const [savedProfile, setSavedProfile] = useState<any>(null);

  useEffect(() => {
    setMounted(true)
    
    // Check if a profile already exists and load it if so
    const checkForExistingProfile = async () => {
      try {
        if (!user) return;
        
        const response = await fetch('/api/profile/current', {
          credentials: 'include' // Include cookies in the request
        });
        if (!response.ok) {
          console.error('Error checking for profile:', await response.text());
          return;
        }
        
        const data = await response.json();
        
        // If there's an authenticated user with a profile, populate the form
        if (data.authenticated && data.profile) {
          setIsEditMode(true);
          setExistingProfileId(data.profile.id);
          
          const profile = data.profile;
          
          // Populate the form fields with the existing data
          setBusinessName(profile.business_name || '');
          setLocation({
            address: profile.full_address || '',
            coordinates: profile.user_input_data?.coordinates || null
          });
          
          if (profile.delivery_radius) {
            setServiceRadius(String(profile.delivery_radius));
          }
          
          if (profile.contact_phone) {
            setOwnerContact(profile.contact_phone);
          }
          
          // Handle photos - first from user_input_data, fallback to root level
          const photoUrls = profile.user_input_data?.photo_urls || profile.photo_urls;
          if (photoUrls && Array.isArray(photoUrls)) {
            const existingPhotos = [...photos];
            photoUrls.forEach((url: string, index: number) => {
              if (index < existingPhotos.length) {
                existingPhotos[index] = url;
              }
            });
            setPhotos(existingPhotos);
          }
          
          if (profile.business_type) {
            setFocus(profile.business_type);
          }
          
          if (profile.website_url) {
            const isOrderingLink = profile.website_url.includes('order') || 
                                  profile.website_url.includes('delivery');
            if (isOrderingLink) {
              setOrderingLink(profile.website_url);
            } else {
              setMenuLink(profile.website_url);
            }
          }
          
          // Handle user_input_data if it exists
          if (profile.user_input_data) {
            const userData = profile.user_input_data;
            
            if (userData.yearsInOperation) setYearsInOperation(userData.yearsInOperation);
            if (userData.idealClients) setIdealClients(userData.idealClients);
            if (userData.cuisineSpecialties) setCuisineSpecialties(userData.cuisineSpecialties);
            if (userData.uniqueSellingPoints) setUniqueSellingPoints(userData.uniqueSellingPoints);
            if (userData.eventSizes) setEventSizes(userData.eventSizes);
            if (userData.serviceTypes) setServiceTypes(userData.serviceTypes);
            if (userData.customizationOptions) setCustomizationOptions(userData.customizationOptions);
            if (userData.managerContact) setManagerContact(userData.managerContact);
          }
          
          console.log('Loaded existing profile data');
        }
      } catch (error) {
        console.error('Error loading existing profile:', error);
      }
    };
    
    checkForExistingProfile();
  }, [user, photos])
  
  // Initialize Google Places once the script loads
  useEffect(() => {
    if (mounted && placesLoaded && placeAutocompleteRef.current) {
      initPlacesAutocomplete()
    }
  }, [mounted, placesLoaded, placeAutocompleteRef.current])
  
  // Function to initialize Google Places Autocomplete
  const initPlacesAutocomplete = async () => {
    try {
      if (window.google && placeAutocompleteRef.current) {
        // Import the places library
        await window.google.maps.importLibrary("places");
        
        // Create the place autocomplete element
        // @ts-ignore
        const placeAutocomplete = new window.google.maps.places.PlaceAutocompleteElement({
          types: ["address", "establishment", "geocode"]
        });
        
        // Set the element id and styling
        placeAutocomplete.id = 'place-autocomplete-input';
        placeAutocomplete.style.width = '100%';
        placeAutocomplete.style.padding = '8px 12px';
        placeAutocomplete.style.borderRadius = '6px';
        placeAutocomplete.style.border = '1px solid rgb(229, 231, 235)';
        placeAutocomplete.style.backgroundColor = 'white';
        
        // Clear any existing content and append the input
        placeAutocompleteRef.current.innerHTML = '';
        placeAutocompleteRef.current.appendChild(placeAutocomplete);
        
        // Add listener for place selection
        // @ts-ignore
        placeAutocomplete.addEventListener('gmp-select', async ({ placePrediction }) => {
          try {
            const place = placePrediction.toPlace();
            
            // Fetch additional fields
            await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] });
            
            console.log('Selected Place:', JSON.stringify(place.toJSON(), null, 2));
            
            if (place.location) {
              // Make sure coordinates are numbers
              const lat = typeof place.location.lat === 'number' ? place.location.lat : parseFloat(place.location.lat);
              const lng = typeof place.location.lng === 'number' ? place.location.lng : parseFloat(place.location.lng);
              
              // Update location state with the selected place
              setLocation({
                address: place.formattedAddress || place.displayName || '',
                coordinates: {
                  lat,
                  lng
                }
              });
              
              console.log('Selected location:', place.formattedAddress || place.displayName);
              console.log('Coordinates:', lat, lng);
            }
          } catch (error) {
            console.error('Error processing place selection:', error);
          }
        });
      }
    } catch (error) {
      console.error('Error initializing Places Autocomplete:', error);
    }
  }

  const handlePhotoChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      
      // Check if file is too large
      if (file.size > 2 * 1024 * 1024) {
        alert("Image is too large. Please choose an image under 2MB.")
        return
      }
      
      // Instead of storing the full data URL, we'll use a placeholder URL
      // This would normally be where you'd upload the image to a storage service
      const newPhotos = [...photos]
      
      // Create a temporary URL for the UI preview
      const temporaryUrl = URL.createObjectURL(file)
      newPhotos[index] = temporaryUrl
      
      // Update the photos state
      setPhotos(newPhotos)
      
      // In a real implementation, you'd upload the image to a storage service here
      // and then use the returned URL instead
    }
  }

  const generateAIProfile = async () => {
    // Calculate profile strength based on filled fields
    const requiredFields = [
      businessName, 
      ownerContact, 
      location.address, 
      cuisineSpecialties, 
      focus
    ];
    
    const optionalFields = [
      menuLink, 
      managerContact, 
      serviceRadius,
      yearsInOperation,
      idealClients,
      uniqueSellingPoints,
      eventSizes,
      serviceTypes,
      customizationOptions,
      orderingLink
    ];
    
    const requiredFilled = requiredFields.filter(Boolean).length;
    const optionalFilled = optionalFields.filter(Boolean).length;
    
    const strength = Math.floor(
      (requiredFilled / requiredFields.length * 70) + 
      (optionalFilled / optionalFields.length * 30)
    );
    
    setProfileStrength(strength);

    try {
      // Show loading state
      setGeneratedProfile("Generating your profile...");
      setShowPreview(true);
      setGenerationMetadata(null);

      // Call our AI Profile Agent via the API
      const response = await fetch('/api/profile/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies in the request
        body: JSON.stringify({
          businessName,
          location: location.address,
          serviceRadius,
          yearsInOperation,
          idealClients,
          signatureDishesOrCuisines: cuisineSpecialties,
          uniqueSellingPoints,
          brandVoiceAndStyle: focus, // Using 'focus' as brand voice
          testimonialsOrAwards: "", // No field for this yet, using empty string
          contactInformation: {
            phone: ownerContact.includes("phone") ? ownerContact.split("phone:")[1]?.trim() || "" : "",
            email: ownerContact.includes("@") ? ownerContact : "",
            website: menuLink || orderingLink || "",
            socialMedia: []
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate profile");
      }

      const data = await response.json();
      
      // Store generation metadata
      if (data.metadata) {
        setGenerationMetadata({
          characterCount: JSON.stringify(data.structuredProfile).length,
          generationTime: data.metadata.generationTime,
          modelUsed: data.metadata.modelUsed
        });
        console.log(`Profile generated in ${data.metadata.generationTime.toFixed(2)}s`);
        console.log(`Model used: ${data.metadata.modelUsed}`);
      }
      
      // Convert the structured profile to a display format for preview
      const structuredProfile = data.structuredProfile;
      const formattedProfile = `${structuredProfile.businessName}

Based in ${structuredProfile.location}, ${structuredProfile.serviceArea}
${structuredProfile.yearsExperience}

Contact: ${structuredProfile.contactPerson.name}, ${structuredProfile.contactPerson.title}

Most Requested Dishes:
${structuredProfile.mostRequestedDishes.map((dish: string) => `- ${dish}`).join('\n')}

Overview:
${structuredProfile.overview}

Why Choose Us:
${structuredProfile.whyChooseUs.map((point: string) => `- ${point}`).join('\n')}

Ideal Clients:
${structuredProfile.idealClients}

${structuredProfile.testimonialsAndAwards.testimonials.length > 0 ? 
  `Testimonials:\n${structuredProfile.testimonialsAndAwards.testimonials.map((t: {quote: string, source: string}) => 
    `"${t.quote}" - ${t.source}`).join('\n')}\n` : ''}
${structuredProfile.testimonialsAndAwards.awards.length > 0 ? 
  `Awards:\n${structuredProfile.testimonialsAndAwards.awards.map((a: string) => `- ${a}`).join('\n')}` : ''}

Contact Information:
Phone: ${structuredProfile.contactInformation.phone}
Email: ${structuredProfile.contactInformation.email}
${structuredProfile.contactInformation.socialMedia.length > 0 ? 
  `Social Media: ${structuredProfile.contactInformation.socialMedia.join(', ')}` : ''}`;
      
      // Store the generated profile
      const profileData = {
        id: Date.now().toString(), // Simple temporary ID
        businessName,
        location: location.address,
        coordinates: location.coordinates,
        serviceRadius,
        profile: formattedProfile,
        structuredProfile: data.structuredProfile,
        createdAt: new Date().toISOString(),
        metadata: {
          ...data.metadata,
          characterCount: JSON.stringify(data.structuredProfile).length,
        }
      };
      
      localStorage.setItem('cateringProfile', JSON.stringify(profileData));
      
      // Show the profile preview
      setGeneratedProfile(formattedProfile);
      
      // Check if the URL has a query param to redirect to the AI profile
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('generate') === 'ai') {
        // First save the profile, then redirect to AI profile
        await saveProfile();
        
        // Set a small timeout to ensure the profile is saved before redirect
        setTimeout(() => {
          const profileIdToRedirect = savedProfile?.profile?.id || existingProfileId;
          if (profileIdToRedirect) {
            console.log("Redirecting to AI profile with ID:", profileIdToRedirect);
            window.location.href = `/marketing/ai-profile/${profileIdToRedirect}`;
          } else {
            // If we don't have a profile ID, go to the profile page
            console.log("No profile ID found, redirecting to profile page");
            router.push('/profile');
          }
        }, 500);
      } else {
        // Otherwise just go to the profile page
        router.push('/profile');
      }
      
    } catch (error) {
      console.error("Error generating profile:", error);
      
      // Reset generation metadata
      setGenerationMetadata(null);
      
      // Fallback to the original generation method if the AI agent fails
    const yearText = yearsInOperation 
      ? `With ${yearsInOperation} years of experience in the industry, `
      : "As an established catering service, ";

    const locationText = serviceRadius
      ? `serving ${location.address} and surrounding areas within a ${serviceRadius} radius`
      : `based in ${location.address}`;

    const specialtiesText = cuisineSpecialties
      ? `specializing in ${cuisineSpecialties}`
      : "offering diverse culinary options";

    const eventText = eventSizes
      ? `We cater to ${eventSizes}, `
      : "We cater to events of all sizes, ";

    const serviceText = serviceTypes
      ? `providing ${serviceTypes}.`
      : "providing a range of service options.";

    const customizationText = customizationOptions
      ? `We pride ourselves on ${customizationOptions}`
      : "We pride ourselves on accommodating our clients' needs";

    const uniqueText = uniqueSellingPoints
      ? `What makes us unique: ${uniqueSellingPoints}`
      : "";

    const targetText = idealClients
      ? `We particularly enjoy working with ${idealClients}.`
      : "";

    const profile = `${businessName} is a premium catering service ${locationText}, ${specialtiesText}. ${yearText}we've built a reputation for excellence in the catering industry. ${focus || ""}

${eventText}${serviceText} ${customizationText}. ${uniqueText} ${targetText}

To discuss your next event, contact ${ownerContact || "us"} ${managerContact ? `or our manager at ${managerContact}` : ""}.

(Note: This profile was generated using the fallback method as the AI service was unavailable.)`;

    setGeneratedProfile(profile);
      
      // Even with the fallback, store the profile
      const profileData = {
        id: Date.now().toString(),
        businessName,
        location: location.address,
        coordinates: location.coordinates,
        serviceRadius,
        profile,
        createdAt: new Date().toISOString(),
      };
      
      localStorage.setItem('cateringProfile', JSON.stringify(profileData));
    }
  };

  const saveProfile = async (data: FormData, navigate = true) => {
    try {
      // Extract "generate=ai" flag from the URL
      const urlParams = new URLSearchParams(window.location.search);
      const generateAI = urlParams.get('generate') === 'ai';
      
      // Clear any existing state
      setLoading(true);
      setSaveError(null);
      setSaveSuccess(null);

      // Convert FormData to JSON
      const profileData = Object.fromEntries(data.entries());
      
      // Create or update the profile
      const response = await fetch('/api/profile', {
        method: profile ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
        credentials: 'include',
      });

      if (!response.ok) {
        // Handle API error
        const errorData = await response.json().catch(() => null);
        throw new Error(
          `API error (${response.status}): ${
            errorData?.error || response.statusText
          }`
        );
      }

      // Get the response data which contains the saved profile
      const savedData = await response.json();
      const savedProfile = savedData.profile;

      console.log("Profile saved successfully:", savedProfile);
      
      setSaveSuccess("Profile saved successfully!");
      setLoading(false);

      // If navigate param is true, proceed with redirection
      if (navigate) {
        // Short delay before redirecting
        await new Promise((resolve) => setTimeout(resolve, 500));
        
        if (generateAI && savedProfile?.id) {
          // Redirect to AI profile page with the profile ID
          window.location.href = `/marketing/ai-profile/${savedProfile.id}`;
        } else {
          // Redirect to profile page
          router.push(`/profile/${savedProfile?.id || ''}`);
        }
      }
      
      return savedProfile;
    } catch (error) {
      console.error('Error saving profile:', error);
      setSaveError(
        error instanceof Error
          ? error.message
          : 'Unknown error occurred while saving profile'
      );
      setLoading(false);
      return null;
    }
  };

  // Handle going back to edit the form
  const handleBackToForm = () => {
    setShowPreview(false);
  };

  // Update handleSave to use our saveProfile function
  const handleSave = () => {
    saveProfile();
  };

  if (!mounted) {
    return null
  }

  return (
    <>
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}&libraries=places&v=beta`}
        onLoad={() => setPlacesLoaded(true)}
        strategy="afterInteractive"
      />
      
      <div className="container mx-auto px-4 py-12 relative">
        {/* Background effects */}
        <div className="absolute -top-20 right-0 w-96 h-96 bg-purple-500/5 rounded-full filter blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-20 -left-20 w-96 h-96 bg-blue-500/5 rounded-full filter blur-3xl animate-pulse-slow animation-delay-700"></div>
        
        <div className="relative">
          <h1 className="text-4xl font-bold mb-2 text-center gradient-text">
            {isEditMode ? "Edit Your Catering Profile" : "Set Up Your Catering Profile"}
          </h1>
          <p className="text-center text-foreground mb-8">
            {isEditMode 
              ? "Update your business information to improve your leads" 
              : "Help us understand your business to generate better leads"}
          </p>

          <div className="max-w-4xl mx-auto">
            {!showPreview ? (
              <Card className="border border-purple-500/10 bg-card shadow-xl overflow-hidden">
                <CardHeader className="border-b border-purple-200/20 bg-purple-50/5">
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 rounded-full bg-purple-500 animate-pulse"></span>
                    <CardTitle className="text-purple-900">Profile Information</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-6 pt-8">
                  <Tabs defaultValue="basics" value={activeTab} onValueChange={setActiveTab} className="mb-8">
                    <TabsList className="grid grid-cols-3 mb-8">
                      <TabsTrigger value="basics">Business Basics</TabsTrigger>
                      <TabsTrigger value="specialties">Target & Specialties</TabsTrigger>
                      <TabsTrigger value="services">Capacity & Services</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="basics" className="space-y-8">
                      <div>
                        <h3 className="text-lg font-medium mb-4 flex items-center text-card-foreground">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          Business Name
                        </h3>
                        <Input
                          placeholder="What is your official business name?"
                          value={businessName}
                          onChange={(e) => setBusinessName(e.target.value)}
                          className="bg-white text-gray-800 border-gray-200 focus:border-purple-500/50 placeholder:text-gray-600"
                        />
                      </div>

                      <div>
                        <h3 className="text-lg font-medium mb-4 flex items-center text-card-foreground">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          Owner or Primary Contact
                        </h3>
                        <Input
                          placeholder="Who is the main point of contact? (Name, role)"
                          value={ownerContact}
                          onChange={(e) => setOwnerContact(e.target.value)}
                          className="bg-white text-gray-800 border-gray-200 focus:border-purple-500/50 placeholder:text-gray-600"
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <Label htmlFor="location" className="text-card-foreground flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Business Location
                          </Label>
                          <div ref={placeAutocompleteRef} className="w-full">
                            {!placesLoaded && (
                              <Input
                                id="location"
                                placeholder="Loading Google Places..."
                                disabled
                                className="bg-white text-gray-800 border-gray-200 focus:border-purple-500/50 placeholder:text-gray-600"
                              />
                            )}
                          </div>
                          {location.coordinates && (
                            <p className="text-xs text-green-600 mt-1">
                              Location coordinates saved: {typeof location.coordinates.lat === 'number' ? location.coordinates.lat.toFixed(6) : location.coordinates.lat}, {typeof location.coordinates.lng === 'number' ? location.coordinates.lng.toFixed(6) : location.coordinates.lng}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="serviceRadius" className="text-card-foreground flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                            Service Radius
                          </Label>
                          <Select 
                            value={serviceRadius} 
                            onValueChange={setServiceRadius}
                          >
                            <SelectTrigger id="serviceRadius" className="bg-white text-gray-800 border-gray-200 focus:border-purple-500/50">
                              <SelectValue placeholder="How far do you travel?" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="5">5 miles</SelectItem>
                              <SelectItem value="10">10 miles</SelectItem>
                              <SelectItem value="15">15 miles</SelectItem>
                              <SelectItem value="25">25 miles</SelectItem>
                              <SelectItem value="50">50 miles</SelectItem>
                              <SelectItem value="100">100+ miles</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-1">
                            This will be used to define your marketing campaign radius
                          </p>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="yearsInOperation" className="text-card-foreground flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Years in Operation
                        </Label>
                        <Input
                          id="yearsInOperation"
                          placeholder="How long have you been in business?"
                          value={yearsInOperation}
                          onChange={(e) => setYearsInOperation(e.target.value)}
                          className="bg-white text-gray-800 border-gray-200 focus:border-purple-500/50 placeholder:text-gray-600"
                        />
                      </div>

                      <div>
                        <h3 className="text-lg font-medium mb-4 flex items-center text-card-foreground">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Upload Catering Photos <span className="text-sm text-gray-500 ml-1">(3)</span>
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {[0, 1, 2].map((index) => (
                            <div key={index} className="relative group">
                              <div className="aspect-video relative overflow-hidden rounded-md border border-gray-200 transition-all duration-300 group-hover:border-purple-500/50 group-hover:shadow-ai-glow">
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"></div>
                                <Image
                                  src={photos[index] || "/placeholder.svg"}
                                  alt={`Catering photo ${index + 1}`}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                              <div className="mt-2">
                                <Input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handlePhotoChange(index, e)}
                                  className="text-sm bg-white text-gray-800 border-gray-200 focus:border-purple-500/50 file:text-gray-700"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="specialties" className="space-y-8">
                      <div>
                        <Label htmlFor="idealClients" className="text-card-foreground flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          Ideal Clients
                        </Label>
                        <Textarea
                          id="idealClients"
                          placeholder="Who do you love serving the most? (e.g., corporate clients, weddings, private parties, etc.)"
                          value={idealClients}
                          onChange={(e) => setIdealClients(e.target.value)}
                          className="bg-white text-gray-800 border-gray-200 focus:border-purple-500/50 min-h-[100px] placeholder:text-gray-600"
                        />
                      </div>

                      <div>
                        <Label htmlFor="cuisineSpecialties" className="text-card-foreground flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          Cuisines & Signature Dishes
                        </Label>
                        <Textarea
                          id="cuisineSpecialties"
                          placeholder="What types of cuisines do you specialize in? Which dish is your most requested or best seller?"
                          value={cuisineSpecialties}
                          onChange={(e) => setCuisineSpecialties(e.target.value)}
                          className="bg-white text-gray-800 border-gray-200 focus:border-purple-500/50 min-h-[100px] placeholder:text-gray-600"
                        />
                      </div>

                      <div>
                        <Label htmlFor="uniqueSellingPoints" className="text-card-foreground flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Unique Selling Points
                        </Label>
                        <Textarea
                          id="uniqueSellingPoints"
                          placeholder="What makes your catering service stand out? (e.g., organic ingredients, fusion cuisine, etc.)"
                          value={uniqueSellingPoints}
                          onChange={(e) => setUniqueSellingPoints(e.target.value)}
                          className="bg-white text-gray-800 border-gray-200 focus:border-purple-500/50 min-h-[100px] placeholder:text-gray-600"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <Label htmlFor="menuLink" className="text-card-foreground flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Menu Link or PDF
                          </Label>
                          <Input
                            id="menuLink"
                            placeholder="https://example.com/menu.pdf"
                            value={menuLink}
                            onChange={(e) => setMenuLink(e.target.value)}
                            className="bg-white text-gray-800 border-gray-200 focus:border-purple-500/50 placeholder:text-gray-600"
                          />
                        </div>

                        <div>
                          <Label htmlFor="managerContact" className="text-card-foreground flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Manager Contact Info
                          </Label>
                          <Input
                            id="managerContact"
                            placeholder="Name, Email, Phone"
                            value={managerContact}
                            onChange={(e) => setManagerContact(e.target.value)}
                            className="bg-white text-gray-800 border-gray-200 focus:border-purple-500/50 placeholder:text-gray-600"
                          />
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="services" className="space-y-8">
                      <div>
                        <Label htmlFor="eventSizes" className="text-card-foreground flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          Event Sizes
                        </Label>
                        <Input
                          id="eventSizes"
                          placeholder="How many guests can you typically serve? (e.g., from small gatherings to large events)"
                          value={eventSizes}
                          onChange={(e) => setEventSizes(e.target.value)}
                          className="bg-white text-gray-800 border-gray-200 focus:border-purple-500/50 placeholder:text-gray-600"
                        />
                      </div>

                      <div>
                        <Label htmlFor="serviceTypes" className="text-card-foreground flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          Type of Service
                        </Label>
                        <Textarea
                          id="serviceTypes"
                          placeholder="Do you offer buffet, plated meals, food stations, drop-off catering, bartending, etc?"
                          value={serviceTypes}
                          onChange={(e) => setServiceTypes(e.target.value)}
                          className="bg-white text-gray-800 border-gray-200 focus:border-purple-500/50 min-h-[100px] placeholder:text-gray-600"
                        />
                      </div>

                      <div>
                        <Label htmlFor="customizationOptions" className="text-card-foreground flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                          </svg>
                          Customization Options
                        </Label>
                        <Textarea
                          id="customizationOptions"
                          placeholder="Are you flexible with menu customizations or dietary restrictions?"
                          value={customizationOptions}
                          onChange={(e) => setCustomizationOptions(e.target.value)}
                          className="bg-white text-gray-800 border-gray-200 focus:border-purple-500/50 min-h-[100px] placeholder:text-gray-600"
                        />
                      </div>

                      <div>
                        <Label htmlFor="orderingLink" className="text-card-foreground flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          Direct Ordering Link
                        </Label>
                        <Input
                          id="orderingLink"
                          placeholder="https://example.com/order"
                          value={orderingLink}
                          onChange={(e) => setOrderingLink(e.target.value)}
                          className="bg-white text-gray-800 border-gray-200 focus:border-purple-500/50 placeholder:text-gray-600"
                        />
                      </div>

                      <div>
                        <Label htmlFor="focus" className="text-card-foreground flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          Additional Information
                        </Label>
                        <Textarea
                          id="focus"
                          placeholder="Any other details you'd like to share about your catering business..."
                          rows={4}
                          value={focus}
                          onChange={(e) => setFocus(e.target.value)}
                          className="bg-white text-gray-800 border-gray-200 focus:border-purple-500/50 min-h-[100px] placeholder:text-gray-600"
                        />
                      </div>
                    </TabsContent>
                  </Tabs>

                  <div className="flex justify-between pt-4">
                    {activeTab !== "basics" && (
                      <Button 
                        onClick={() => {
                          if (activeTab === "specialties") setActiveTab("basics");
                          if (activeTab === "services") setActiveTab("specialties");
                        }}
                        variant="outline"
                        className="border-gray-200 hover:border-purple-500/50 hover:bg-purple-50/10 text-gray-800"
                      >
                        <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m15 18-6-6 6-6"/>
                        </svg>
                        Previous
                      </Button>
                    )}
                    
                    {activeTab !== "services" ? (
                      <Button 
                        onClick={() => {
                          // Save current step data before moving to next tab
                          const currentStepData = {
                            user_input_data: {
                              // Get existing user input data from local state
                              yearsInOperation,
                              idealClients,
                              cuisineSpecialties,
                              uniqueSellingPoints,
                              eventSizes,
                              serviceTypes,
                              customizationOptions,
                              managerContact,
                              
                              // If on basics tab, save those fields
                              ...(activeTab === "basics" ? {
                                businessName,
                                ownerContact,
                                location: location.address,
                                coordinates: location.coordinates,
                                serviceRadius,
                                yearsInOperation
                              } : {}),
                              // If on specialties tab, save those fields
                              ...(activeTab === "specialties" ? {
                                idealClients,
                                cuisineSpecialties,
                                uniqueSellingPoints
                              } : {})
                            }
                          };
                          
                          // Save data to Supabase
                          userProfileService.updateUserInputData(currentStepData.user_input_data)
                            .then(result => {
                              console.log(`Saved ${activeTab} data:`, result);
                              // Move to the next tab after saving
                              if (activeTab === "basics") setActiveTab("specialties");
                              if (activeTab === "specialties") setActiveTab("services");
                            })
                            .catch(err => {
                              console.error(`Error saving ${activeTab} data:`, err);
                              // Still move to the next tab even if save fails
                              if (activeTab === "basics") setActiveTab("specialties");
                              if (activeTab === "specialties") setActiveTab("services");
                            });
                        }}
                        className="ml-auto bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-ai-glow transition-all duration-300"
                      >
                        <span className="mr-2">Next</span>
                        <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m9 18 6-6-6-6"/>
                        </svg>
                      </Button>
                    ) : (
                      <Button 
                        onClick={handleSave}
                        className="ml-auto bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-ai-glow transition-all duration-300"
                      >
                        {isEditMode ? "Update Profile" : "Save Profile"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-8">
                {/* Preview card */}
                <Card className="border border-purple-500/10 bg-card shadow-xl overflow-hidden h-fit">
                  <CardHeader className="border-b border-purple-200/20 bg-purple-50/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></span>
                        <CardTitle className="text-blue-900">AI-Generated Profile Preview</CardTitle>
                      </div>
                      <Button variant="ghost" size="sm" onClick={handleBackToForm}>
                        <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m15 18-6-6 6-6"/>
                        </svg>
                        Edit Profile
                      </Button>
                    </div>
                    
                    {/* Generation metadata display */}
                    {generationMetadata && (
                      <div className="mt-2 text-xs text-gray-500 flex gap-3">
                        <span>{generationMetadata.characterCount} characters</span>
                        <span>·</span>
                        <span>Generated in {generationMetadata.generationTime.toFixed(1)}s</span>
                        <span>·</span>
                        <span>Using {generationMetadata.modelUsed}</span>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="p-6 pt-8">
                    <div className="space-y-8">
                      {/* Business header */}
                      <div className="flex flex-col md:flex-row gap-6 items-start">
                        <div className="aspect-square w-24 h-24 relative rounded-md overflow-hidden border border-gray-200 flex-shrink-0">
                          <Image
                            src={photos[0] || "/placeholder.svg"}
                            alt="Business logo"
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="space-y-4 flex-1">
                          <div>
                            <h2 className="text-2xl font-bold text-card-foreground">Savory Celebrations Catering</h2>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-muted-foreground text-sm">
                              <div className="flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-1 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span>Based in Dallas, TX, serving events throughout the DFW metro area</span>
                              </div>
                              <div className="flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-1 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>10 years in the catering industry</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-start">
                            <div className="aspect-square w-12 h-12 relative rounded-full overflow-hidden border border-gray-200 flex-shrink-0 mr-3">
                              <Image
                                src={photos[1] || "/placeholder.svg"}
                                alt="Contact person"
                                fill
                                className="object-cover"
                              />
                            </div>
                            <div>
                              <h4 className="font-medium text-card-foreground">Contact Person:</h4>
                              <p className="text-muted-foreground">Maria Ramirez, Head Chef & Owner</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Most requested dishes */}
                      <div>
                        <h3 className="text-lg font-medium mb-2 text-card-foreground">Most Requested Dishes:</h3>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {["Signature Tex‐Mex Enchiladas", "Roasted Citrus Chicken", "Southwest Salad Bar"].map((cuisine, i) => (
                            <span 
                              key={i} 
                              className="px-3 py-1 rounded-full text-sm bg-gradient-to-r from-purple-100 to-blue-100 text-purple-800 border border-purple-200/50"
                            >
                              {cuisine.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      {/* Overview */}
                      <div>
                        <h3 className="text-lg font-medium mb-2 text-card-foreground">Overview:</h3>
                        <p className="text-card-foreground leading-relaxed">
                          Savory Celebrations Catering has been delighting the Dallas‐Fort Worth area with flavorful, handcrafted dishes for the past decade. 
                          Led by Head Chef Maria Ramirez—a culinary expert inspired by her Mexican‐American heritage—our team specializes in bold Tex‐Mex flavors 
                          infused with modern twists. Whether you're planning a corporate luncheon, a vibrant wedding reception, or an intimate private party, 
                          we offer fully customizable menus to suit your taste and event style.
                        </p>
                      </div>
                      
                      {/* Why Choose Us */}
                      <div>
                        <h3 className="text-lg font-medium mb-2 text-card-foreground">Why Choose Us:</h3>
                        <div className="space-y-2">
                          {[
                            "Authentic Flavor Profiles: We source fresh, locally grown produce to create mouthwatering sauces and marinades.",
                            "Flexible Service Options: From buffet‐style setups and plated dinners to live cooking stations, we accommodate gatherings of all sizes—from cozy family reunions to large corporate galas.",
                            "Friendly, Professional Staff: Our dedicated event coordinators and serving team go above and beyond to ensure every detail is handled with care."
                          ].map((point, i) => (
                            <div key={i} className="flex items-start">
                              <div className="w-5 h-5 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs mr-2 mt-0.5 flex-shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                              </div>
                              <p className="text-card-foreground">{point}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Ideal Clients */}
                      <div>
                        <h3 className="text-lg font-medium mb-2 text-card-foreground">Ideal Clients:</h3>
                        <p className="text-card-foreground">
                          We love bringing our sizzling Tex‐Mex flair to weddings, private celebrations, and corporate events. 
                          Our classic comfort foods with a modern twist are especially popular with families and trendsetters alike.
                        </p>
                      </div>
                      
                      {/* Customer Reviews & Awards */}
                      <div>
                        <h3 className="text-lg font-medium mb-2 text-card-foreground">Customer Reviews & Awards:</h3>
                        <div className="space-y-3">
                          <div className="p-4 bg-gradient-to-r from-purple-50/30 to-blue-50/30 rounded-lg border border-purple-100/30">
                            <p className="text-card-foreground italic">
                              "Our go‐to caterer for every office party—we can't get enough!"
                            </p>
                            <p className="text-sm text-muted-foreground mt-2">— Hillcrest Financial</p>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 flex items-center justify-center text-white flex-shrink-0">
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                              </svg>
                            </div>
                            <p className="text-card-foreground">Voted "Best Fusion Catering" by Dallas Gourmet Magazine, 2024</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* How to Connect */}
                      <div>
                        <h3 className="text-lg font-medium mb-2 text-card-foreground">How to Connect:</h3>
                        <p className="text-card-foreground mb-3">
                          Ready to book or have questions? Contact Maria directly at (123) 456‐7890 or email info@savorycelebrations.com. 
                          Check out our latest event photos and behind‐the‐scenes kitchen snapshots on Instagram (@SavoryCelebrationsDFW).
                        </p>
                        <div className="flex flex-wrap gap-3">
                          <div className="flex items-center text-card-foreground bg-white/10 px-3 py-2 rounded-md border border-purple-200/20">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <span>(123) 456‐7890</span>
                          </div>
                          <div className="flex items-center text-card-foreground bg-white/10 px-3 py-2 rounded-md border border-purple-200/20">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span>info@savorycelebrations.com</span>
                          </div>
                          <div className="flex items-center text-card-foreground bg-white/10 px-3 py-2 rounded-md border border-purple-200/20">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span>@SavoryCelebrationsDFW</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Gallery preview */}
                      {photos.filter(Boolean).length > 0 && (
                        <div>
                          <h3 className="text-lg font-medium mb-2 text-card-foreground">Gallery Preview:</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                            {photos.map((photo, index) => (
                              photo && (
                                <div key={index} className="aspect-video relative rounded-md overflow-hidden border border-gray-200">
                                  <Image
                                    src={photo}
                                    alt={`Gallery image ${index + 1}`}
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                              )
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="border-t border-purple-200/20 bg-purple-50/5 p-6">
                    <Button 
                      onClick={handleSave}
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-ai-glow transition-all duration-300"
                      size="lg"
                    >
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        width="24" 
                        height="24" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        className="h-4 w-4 mr-2"
                      >
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                        <polyline points="17 21 17 13 7 13 7 21"></polyline>
                        <polyline points="7 3 7 8 15 8"></polyline>
                      </svg>
                      Save & Continue
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

