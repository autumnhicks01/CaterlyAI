"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { useCaterly, useCatering } from "../app/context/caterly-context"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"

// Define venue categories
const venueCategories = [
  { id: "wedding-venue", label: "Wedding Venues", keywords: ["wedding", "bride", "groom", "ceremony"] },
  { id: "churches", label: "Churches", keywords: ["church", "religious", "ceremony", "worship"] },
  { id: "schools", label: "Schools", keywords: ["school", "education", "university", "college", "campus"] },
  { id: "event-venue", label: "Event Venues", keywords: ["event", "celebration", "venue", "hall", "party", "gathering"] },
  { id: "golf-courses", label: "Golf Courses", keywords: ["golf", "course"] },
  { id: "country-clubs", label: "Country Clubs", keywords: ["country club", "club", "member"] },
  { id: "hotels", label: "Hotels", keywords: ["hotel", "resort", "lodging"] },
  { id: "restaurants", label: "Restaurants", keywords: ["restaurant", "dining", "eatery"] },
  { id: "community-centers", label: "Community Centers", keywords: ["community", "center", "hall"] },
  { id: "corporate-offices", label: "Corporate Offices", keywords: ["corporate", "office", "business", "company"] }
]

export default function CampaignSetupPage() {
  const router = useRouter()
  const { setCampaign, profile } = useCaterly()

  const [campaignName, setCampaignName] = useState("Wedding Summer Special")
  
  // Location & Radius settings from profile only
  const [radius, setRadius] = useState("25")
  
  // Categories
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [autoSelectedCategories, setAutoSelectedCategories] = useState<string[]>([])
  const [hasCategorySuggestions, setHasCategorySuggestions] = useState(false)
  
  // Load initial values from profile
  useEffect(() => {
    if (profile) {
      console.log("CampaignSetup: Profile data loaded:", {
        location: profile.location,
        full_address: profile.full_address,
        service_radius: profile.service_radius,
        user_input_data: profile.user_input_data
      });
      
      // Set default radius from profile if available
      if (profile.service_radius) {
        setRadius(profile.service_radius.toString());
      }
      
      // Extract ideal customer type from profile and auto-select categories
      if (profile.idealClients) {
        // Auto-select categories based on profile information
        const idealClientsLower = profile.idealClients.toLowerCase();
        const detectedCategories: string[] = [];
        
        venueCategories.forEach(category => {
          const keywordMatch = category.keywords.some(keyword => 
            idealClientsLower.includes(keyword.toLowerCase())
          );
          
          if (keywordMatch) {
            detectedCategories.push(category.id);
          }
        });
        
        if (detectedCategories.length > 0) {
          setSelectedCategories(detectedCategories);
          setAutoSelectedCategories(detectedCategories);
          setHasCategorySuggestions(true);
        }
      }
    }
  }, [profile]);
  
  // Handle category selection
  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(current => 
      current.includes(categoryId) 
        ? current.filter(id => id !== categoryId)
        : [...current, categoryId]
    );
  };

  const handleContinue = () => {
    // Extract coordinates from profile.user_input_data if available
    let coordinates = null;
    if (profile?.user_input_data && 
        typeof profile.user_input_data === 'object' && 
        'coordinates' in profile.user_input_data && 
        profile.user_input_data.coordinates) {
      coordinates = profile.user_input_data.coordinates;
      console.log("CampaignSetup: Found coordinates in profile:", coordinates);
    } else {
      console.log("CampaignSetup: No coordinates found in profile:", profile?.user_input_data);
    }

    // Set campaign data with all necessary information
    const campaignData = {
      name: campaignName,
      eventType: "any",
      location: profile?.full_address || profile?.location || "",
      radius: Number.parseInt(radius),
      targetCategories: selectedCategories,
      coordinates: coordinates
    };
    
    console.log("CampaignSetup: Setting campaign data:", campaignData);
    setCampaign(campaignData);

    router.push("/leads/discovery");
  }

  return (
    <div className="container mx-auto px-4 py-12 relative">
      {/* Background effects */}
      <div className="absolute -top-20 right-0 w-96 h-96 bg-purple-500/5 rounded-full filter blur-3xl animate-pulse-slow"></div>
      <div className="absolute bottom-20 -left-20 w-96 h-96 bg-blue-500/5 rounded-full filter blur-3xl animate-pulse-slow animation-delay-700"></div>
      
      <div className="relative">
        <h1 className="text-4xl font-bold mb-2 text-center gradient-text">Start Your Lead Engine</h1>
        <p className="text-center text-gray-800 dark:text-gray-200 mb-8">Configure your campaign to discover targeted leads for your catering business</p>

        <div className="max-w-4xl mx-auto">
          <Card className="border border-purple-500/10 bg-card shadow-xl overflow-hidden">
            <CardHeader className="border-b border-purple-200/20 bg-purple-50/5">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></span>
                <CardTitle className="text-gray-900 dark:text-gray-100">Campaign Setup</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 pt-8">
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-medium mb-4 flex items-center text-gray-900 dark:text-gray-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Campaign Name
                  </h3>
                  <Input
                    id="campaignName"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="Summer Wedding Special"
                    className="bg-white text-gray-800 border-gray-200 focus:border-purple-500/50 placeholder:text-gray-600"
                  />
                </div>

                {/* Confirm Location & Radius */}
                <div>
                  <h3 className="text-lg font-medium mb-4 flex items-center text-gray-900 dark:text-gray-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Confirm Location & Radius
                  </h3>
                  
                  <Alert className="mb-4 bg-blue-500/10 border-blue-500/20 text-gray-800 dark:text-gray-200">
                    <InfoIcon className="h-4 w-4 text-blue-500" />
                    <AlertDescription className="ml-2">
                      We have your location set to {profile?.location || "[Your Location]"} and a {radius} mile radius from your company profile. Would you like to keep these, or make any changes?
                      {profile?.user_input_data?.coordinates && (
                        <div className="mt-2 text-xs text-blue-600">
                          Coordinates: Lat {profile.user_input_data.coordinates.lat.toFixed(6)}, Lng {profile.user_input_data.coordinates.lng.toFixed(6)}
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="location" className="text-gray-900 dark:text-gray-100 flex items-center mb-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Location (from your profile)
                      </Label>
                      <Input
                        id="location"
                        value={profile?.location || ""}
                        disabled
                        className="bg-gray-100 text-gray-800 border-gray-200 cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <Label htmlFor="radius" className="text-gray-900 dark:text-gray-100 flex items-center mb-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        Radius (miles)
                      </Label>
                      <Select value={radius} onValueChange={setRadius}>
                        <SelectTrigger id="radius" className="bg-white text-gray-800 border-gray-200 focus:border-purple-500/50">
                          <SelectValue placeholder="Select radius" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10 miles</SelectItem>
                          <SelectItem value="25">25 miles</SelectItem>
                          <SelectItem value="50">50 miles</SelectItem>
                          <SelectItem value="100">100 miles</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Lead Category */}
                <div>
                  <h3 className="text-lg font-medium mb-4 flex items-center text-gray-900 dark:text-gray-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Lead Category
                  </h3>
                  
                  <Alert className="mb-4 bg-purple-500/10 border-purple-500/20 text-gray-800 dark:text-gray-200">
                    <InfoIcon className="h-4 w-4 text-purple-500" />
                    <AlertDescription className="ml-2">
                      Based on your customer profile, your ideal clients are {profile?.idealClients || "wedding venues, on-site catering events, golf courses"}. Is there any other category you'd like to target specifically?
                    </AlertDescription>
                  </Alert>
                  
                  <div>
                    <h4 className="text-base font-medium mb-3 text-gray-900 dark:text-gray-100">Which types of businesses would you like to include in this search? (Select all that apply.)</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {venueCategories.map((category) => (
                        <div
                          key={category.id}
                          className={`flex items-center space-x-2 p-3 rounded-md border transition-colors ${
                            selectedCategories.includes(category.id)
                              ? "border-purple-400/30 bg-purple-400/10"
                              : "border-gray-200/20 bg-white/5"
                          }`}
                        >
                          <Checkbox
                            id={category.id}
                            checked={selectedCategories.includes(category.id)}
                            onCheckedChange={() => toggleCategory(category.id)}
                            className={selectedCategories.includes(category.id) ? "data-[state=checked]:bg-purple-600" : ""}
                          />
                          <Label
                            htmlFor={category.id}
                            className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer"
                          >
                            {category.label}
                            {autoSelectedCategories.includes(category.id) && (
                              <Badge className="ml-2 text-xs bg-blue-500/20 text-blue-300" variant="secondary">
                                Auto-selected
                              </Badge>
                            )}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t border-purple-200/20 bg-purple-50/5 p-6">
              <Button 
                onClick={handleContinue} 
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-ai-glow transition-all duration-300"
                size="lg"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="w-5 h-5 mr-2 text-white" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Discover Leads
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}

