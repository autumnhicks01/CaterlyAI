"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { userProfileService, UserProfile } from "@/services/userProfileService"
import { Badge } from "@/components/ui/badge"
import { Sparkles, MapPin, Clock } from 'lucide-react'
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { generateProfile } from "@/agents/profileAgent"
import AIFlyerGenerator from "@/components/marketing/ai-flyer-generator"

// Type definitions
export interface StructuredProfile {
  businessName: string;
  location: string;
  serviceArea: string;
  yearsExperience: string;
  contactPerson: {
    name: string;
    title: string;
  };
  mostRequestedDishes: string[];
  overview: string;
  whyChooseUs: string[];
  idealClients: string;
  testimonialsAndAwards: {
    testimonials: Array<{ quote: string; source: string }>;
    awards: string[];
  };
  contactInformation: {
    phone: string;
    email: string;
    socialMedia: string[];
  };
}

export interface ProfileResponse {
  tagline: string;
  enhancedDescription: string;
  sellingPoints: string[];
  targetAudience: string[];
  marketingRecommendations: string[];
  competitiveAdvantages: string[];
  idealClients: Array<{
    type: string;
    description: string;
    approach: string;
  }>;
  metadata?: {
    generatedAt?: string;
    generationTime?: number;
    characterCount?: number;
    modelUsed?: string;
  };
}

// Function to get authenticated user data
async function getAuthenticatedUser() {
  try {
    const response = await fetch('/api/auth/session', {
      credentials: 'include'
    });
    
    if (!response.ok) {
      return { user: null, session: null };
    }
    
    const sessionData = await response.json();
    return {
      user: sessionData.user || null,
      session: sessionData.session || null
    };
  } catch (error) {
    console.error('Error getting authenticated user:', error);
    return { user: null, session: null };
  }
}

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
  const [generating, setGenerating] = useState(false)
  const [aiProfile, setAiProfile] = useState<ProfileResponse | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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

  // Function to automatically generate an AI profile if none exists
  const autoGenerateAIProfile = async (profileData: UserProfile) => {
    try {
      // Show generating state
      setGenerating(true);
      setError(null);
      setSuccess("Auto-generating AI profile for your business...");
      
      // Get user input data or use empty object if none exists
      const userData = profileData.user_input_data 
        ? (typeof profileData.user_input_data === 'string' 
            ? JSON.parse(profileData.user_input_data) 
            : profileData.user_input_data as Record<string, any>) 
        : {};
      
      console.log("[AUTO GENERATE] Using profile data:", profileData);
      console.log("[AUTO GENERATE] User data available:", Object.keys(userData).length > 0);
      
      // Format data for the AI profile generation
      const inputData = {
        id: profileData.id, // Include profile ID for database updates
        businessName: userData.businessName || profileData.business_name || "Your Catering Business",
        location: userData.location || profileData.full_address || "Your location",
        serviceRadius: userData.serviceRadius 
          ? `${userData.serviceRadius} miles` 
          : (profileData.delivery_radius?.toString() || "Local area"),
        yearsInOperation: userData.yearsInOperation 
          ? userData.yearsInOperation.toString() 
          : "Established business",
        idealClients: userData.idealClients || "Weddings, corporate events, special celebrations",
        signatureDishesOrCuisines: userData.cuisineSpecialties || "Diverse cuisine options",
        uniqueSellingPoints: userData.uniqueSellingPoints || 
          `Quality ingredients, professional service, and customized menus for ${
            userData.businessName || profileData.business_name || "your catering business"
          }`,
        brandVoiceAndStyle: "Professional, friendly, and client-focused",
        testimonialsOrAwards: "Known for excellent service and delicious cuisine",
        contactInformation: {
          phone: userData.ownerContact?.includes('@') ? "" : (userData.ownerContact || profileData.contact_phone || ""),
          email: userData.managerContact 
            ? userData.managerContact.split(',')[1]?.trim() || "" 
            : (userData.ownerContact?.includes('@') ? userData.ownerContact : ""),
          website: userData.websiteUrl || profileData.website_url || "",
          socialMedia: []
        }
      };
      
      console.log("[AUTO GENERATE] Generating profile with data:", JSON.stringify(inputData, null, 2));
      
      try {
        // Use the direct approach that was working before
        const aiProfileJson = await generateProfile(inputData);
        console.log("[AUTO GENERATE] Raw response from generateProfile:", aiProfileJson);
        
        // Parse the AI-generated profile
        let aiProfile: ProfileResponse;
        try {
          if (typeof aiProfileJson === 'string') {
            // Log the raw string for debugging
            console.log("[AUTO GENERATE] Parsing string response:", aiProfileJson);
            
            // Check if the response is already a valid JSON object
            if (aiProfileJson.startsWith('{') && aiProfileJson.endsWith('}')) {
              aiProfile = JSON.parse(aiProfileJson);
            } else {
              // Check if we might be receiving a completion with the JSON embedded
              const jsonStart = aiProfileJson.indexOf('{');
              const jsonEnd = aiProfileJson.lastIndexOf('}');
              
              if (jsonStart >= 0 && jsonEnd > jsonStart) {
                const jsonString = aiProfileJson.substring(jsonStart, jsonEnd + 1);
                console.log("[AUTO GENERATE] Extracted JSON from response:", jsonString);
                aiProfile = JSON.parse(jsonString);
              } else {
                throw new Error("No valid JSON found in response");
              }
            }
          } else {
            // If it's already an object, use it directly
            console.log("[AUTO GENERATE] Using non-string response:", aiProfileJson);
            aiProfile = aiProfileJson;
          }
          
          // Validate that the parsed object has the expected properties
          if (!aiProfile || typeof aiProfile !== 'object') {
            throw new Error("Parsed result is not an object");
          }
          
          // Check for required fields and provide defaults if missing
          const validatedProfile: ProfileResponse = {
            tagline: aiProfile.tagline || "Premier Catering for Every Occasion",
            enhancedDescription: aiProfile.enhancedDescription || `${inputData.businessName} provides quality catering services.`,
            sellingPoints: Array.isArray(aiProfile.sellingPoints) ? aiProfile.sellingPoints : ["Quality ingredients", "Professional service", "Custom menus"],
            targetAudience: Array.isArray(aiProfile.targetAudience) ? aiProfile.targetAudience : ["Event planners", "Corporate clients", "Private events"],
            marketingRecommendations: Array.isArray(aiProfile.marketingRecommendations) ? aiProfile.marketingRecommendations : [],
            competitiveAdvantages: Array.isArray(aiProfile.competitiveAdvantages) ? aiProfile.competitiveAdvantages : [],
            idealClients: Array.isArray(aiProfile.idealClients) ? aiProfile.idealClients : []
          };
          
          aiProfile = validatedProfile;
        } catch (parseError: any) {
          console.error("[AUTO GENERATE] Error parsing AI profile:", parseError);
          console.error("[AUTO GENERATE] Problematic response:", aiProfileJson);
          throw new Error(`Failed to parse AI profile response: ${parseError.message}`);
        }
        
        console.log("[AUTO GENERATE] Profile generated successfully:", aiProfile);
        
        // Create a structured profile from the AI response
        const structuredProfile: StructuredProfile = {
          businessName: inputData.businessName,
          location: inputData.location,
          serviceArea: inputData.serviceRadius,
          yearsExperience: inputData.yearsInOperation,
          contactPerson: {
            name: "Contact Manager",
            title: "Owner"
          },
          mostRequestedDishes: Array.isArray(aiProfile.sellingPoints) 
            ? aiProfile.sellingPoints.slice(0, 3) 
            : ["Signature dishes", "Seasonal specialties", "Custom menu options"],
          overview: aiProfile.enhancedDescription || 
            `${inputData.businessName} is a premier catering service offering exceptional food and service.`,
          whyChooseUs: Array.isArray(aiProfile.competitiveAdvantages) 
            ? aiProfile.competitiveAdvantages 
            : ["Quality ingredients", "Professional service", "Customizable menus"],
          idealClients: Array.isArray(aiProfile.targetAudience) 
            ? aiProfile.targetAudience.join(', ') 
            : inputData.idealClients,
          testimonialsAndAwards: {
            testimonials: [
              {
                quote: aiProfile.tagline || "Exceptional catering for memorable events",
                source: "Business Motto"
              }
            ],
            awards: []
          },
          contactInformation: {
            phone: inputData.contactInformation.phone || '',
            email: inputData.contactInformation.email || '',
            socialMedia: inputData.contactInformation.socialMedia || []
          }
        };
        
        setStructured(structuredProfile);
        setAiProfile(aiProfile);
        
        // Save the generated profile to the database
        const updateResponse = await fetch(`/api/profile/${profileData.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ai_profile_data: {
              generatedProfile: aiProfile,
              structuredProfile: structuredProfile
            }
          }),
          credentials: 'include',
        });
        
        if (!updateResponse.ok) {
          console.warn("Failed to save AI profile to database, but will display it anyway");
        } else {
          console.log("AI profile saved successfully to database");
        }
        
        setSuccess("AI profile generated successfully!");
      } catch (error) {
        console.error("[AUTO GENERATE] Error:", error);
        setError(`Failed to generate AI profile: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    } catch (error) {
      console.error("[AUTO GENERATE] Outer error:", error);
      setError(`Error in auto-generation: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true)
        console.log("Fetching profile with ID:", profileId);
        
        // Check if we should force regeneration
        const url = new URL(window.location.href);
        const forceRegenerate = url.searchParams.get('forceRegenerate') === 'true';
        
        // First try to fetch directly using the ID
        if (profileId) {
          // Make a direct API call to get the profile by ID
          const response = await fetch(`/api/profile/${profileId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log("Profile data retrieved by ID:", JSON.stringify(data.profile, null, 2));
            setProfile(data.profile);
            
            // Handle photos and AI data extraction
            processProfileData(data.profile, forceRegenerate);
            return;
          } else {
            console.log("Couldn't fetch profile by ID, falling back to user profile");
          }
        }
        
        // Fallback to getting the user's own profile
        const profileData = await userProfileService.getUserProfile();
        
        if (profileData) {
          console.log("Profile data retrieved from user profile:", JSON.stringify(profileData, null, 2));
          setProfile(profileData);
          
          // Handle photos and AI data extraction
          processProfileData(profileData, forceRegenerate);
        } else {
          console.log("No profile data returned from userProfileService");
          setError("Profile not found. Please complete your profile setup first.");
        }
      } catch (err) {
        console.error("Error loading profile:", err)
        setError("Failed to load profile. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    // Helper function to process profile data (extract photos and AI data)
    const processProfileData = (profileData: UserProfile, forceRegenerate: boolean = false) => {
      // Get photo URLs
      if (profileData.user_input_data && 
          profileData.user_input_data.photo_urls && 
          Array.isArray(profileData.user_input_data.photo_urls)) {
        console.log("Photo URLs found:", profileData.user_input_data.photo_urls);
        setPhotos(profileData.user_input_data.photo_urls)
      } else if ('photo_urls' in profileData && 
          Array.isArray((profileData as any).photo_urls) && 
          (profileData as any).photo_urls.length > 0) {
        console.log("Photo URLs found:", (profileData as any).photo_urls);
        setPhotos((profileData as any).photo_urls);
      } else {
        console.log("No photo URLs found in profile");
      }
      
      // If we have the force regenerate flag, skip extraction and go straight to generation
      if (forceRegenerate) {
        console.log("Force regenerate flag detected, triggering profile generation");
        autoGenerateAIProfile(profileData);
        return;
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
          
          // Also extract the generated profile data if available
          if (aiData.generatedProfile) {
            setAiProfile(aiData.generatedProfile);
          }
        } else {
          console.log("No structuredProfile could be extracted from ai_profile_data");
          
          // Only regenerate if we're missing key profile data
          const hasMinimalData = 
            aiData && (
              (aiData.structuredProfile && Object.keys(aiData.structuredProfile).length > 0) ||
              (aiData.generatedProfile && Object.keys(aiData.generatedProfile).length > 0) ||
              (aiData.enhancedDescription || aiData.tagline || aiData.sellingPoints)
            );
            
          if (hasMinimalData) {
            console.log("Found partial data - will use what we have without regenerating");
            // We have some data but it's not in the expected format - attempt to normalize
            try {
              const constructedProfile = {
                businessName: profileData.business_name || '',
                location: profileData.full_address || '',
                serviceArea: profileData.delivery_radius ? profileData.delivery_radius + ' miles' : 'Local area',
                yearsExperience: 'Established business',
                contactPerson: {
                  name: 'Contact Manager',
                  title: 'Owner'
                },
                mostRequestedDishes: [],
                overview: aiData.enhancedDescription || aiData.description || '',
                whyChooseUs: aiData.sellingPoints || aiData.competitiveAdvantages || [],
                idealClients: aiData.targetAudience ? (Array.isArray(aiData.targetAudience) ? aiData.targetAudience.join(', ') : aiData.targetAudience) : '',
                testimonialsAndAwards: {
                  testimonials: aiData.tagline ? [{
                    quote: aiData.tagline,
                    source: 'Business Motto'
                  }] : [],
                  awards: []
                },
                contactInformation: {
                  phone: profileData.contact_phone || '',
                  email: '',
                  socialMedia: []
                }
              };
              
              setStructured(normalizeStructuredProfile(constructedProfile));
            } catch (err) {
              console.error("Failed to construct profile from partial data:", err);
              // Still don't auto-generate in this case - better to show incomplete data than regenerate
            }
          } else if (profileData) {
            console.log("No valid AI profile data found. Initiating automatic generation.");
            autoGenerateAIProfile(profileData);
          } else {
            setError("AI profile data exists but no structured profile found");
          }
        }
      } else {
        console.log("No ai_profile_data found in profile");
        
        // If profile exists but no AI profile data, automatically generate one
        if (profileData) {
          console.log("Profile exists but no AI profile data. Initiating automatic generation.");
          autoGenerateAIProfile(profileData);
        } else {
          setError("No AI profile data found. Please generate a profile first.");
        }
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

  // Function to handle generate button click
  const handleGenerateClick = () => {
    if (profile) {
      autoGenerateAIProfile(profile);
    } else {
      setError("No profile data available. Please create a profile first.");
    }
  };

  // Function to handle regenerate button click
  const handleRegenerateClick = () => {
    if (profile) {
      autoGenerateAIProfile(profile);
    } else {
      setError("No profile data available. Please create a profile first.");
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <Spinner size="lg" className="text-purple-500" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600">Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{error}</p>
              <Button onClick={() => router.push("/profile/setup")} className="mt-4">
                Complete Your Profile
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!profile || !structured) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                AI Enhanced Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <h2 className="text-2xl font-bold mb-4">Generate Your AI Enhanced Profile</h2>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Let our AI create a professional and compelling profile for your catering business based on your profile information.
                </p>
                
                {error && (
                  <Alert className="mb-6 bg-red-50 border-red-200 max-w-md mx-auto">
                    <AlertDescription className="text-red-800">
                      {error}
                    </AlertDescription>
                  </Alert>
                )}
                
                <Button 
                  onClick={handleGenerateClick}
                  disabled={generating}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-ai-glow transition-all duration-300"
                >
                  {generating ? (
                    <>
                      <Spinner className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : "Generate AI Profile"}
                </Button>
              </div>
            </CardContent>
          </Card>
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
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {success && (
          <Alert className="mb-4 bg-green-50 border-green-200">
            <AlertDescription className="text-green-800">
              {success}
            </AlertDescription>
          </Alert>
        )}
        
        <Card className="mb-8 overflow-hidden border border-purple-500/20 bg-card/50 backdrop-blur-sm">
          <CardHeader className="border-b border-purple-500/10 bg-purple-50/10">
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                AI Enhanced Profile
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRegenerateClick}
                disabled={generating}
              >
                {generating ? "Generating..." : "Regenerate"}
              </Button>
            </div>
            
            {aiProfile && aiProfile.metadata && (
              <div className="mt-2 text-xs text-muted-foreground flex gap-3">
                {aiProfile.metadata.generationTime !== undefined && 
                  <span>Generated in {aiProfile.metadata.generationTime.toFixed(1)}s</span>}
                {aiProfile.metadata.characterCount && <span>· {aiProfile.metadata.characterCount} characters</span>}
                {aiProfile.metadata.modelUsed && <span>· Using {aiProfile.metadata.modelUsed}</span>}
              </div>
            )}
          </CardHeader>
          
          <CardContent className="p-6">
            <div className="space-y-6">
              {/* Business header */}
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="aspect-square w-24 h-24 relative rounded-md overflow-hidden border border-border flex-shrink-0">
                  <Image
                    src={primaryPhoto}
                    alt="Business logo"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="space-y-4 flex-1">
                  <div>
                    <h2 className="text-2xl font-bold">{businessNameString || profile.business_name || 'Your Business'}</h2>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-muted-foreground text-sm">
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 mr-1 text-purple-600" />
                        <span>{locationString || profile.full_address || 'Location not specified'}</span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-1 text-blue-600" />
                        <span>{yearsExperienceString || 'Established business'}</span>
                      </div>
                    </div>
                  </div>
                  
                  {structured.contactPerson && (
                    <div className="flex items-start">
                      <div className="aspect-square w-12 h-12 relative rounded-full overflow-hidden border border-border flex-shrink-0 mr-3">
                        <Image
                          src={secondaryPhoto}
                          alt="Contact person"
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div>
                        <h4 className="font-medium">Contact Person:</h4>
                        <p className="text-muted-foreground">
                          {structured.contactPerson.name}, {structured.contactPerson.title}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Most requested dishes */}
              {hasDishes ? (
                <div>
                  <h3 className="text-lg font-medium mb-2">Most Requested Dishes:</h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {mostRequestedDishes.map((cuisine, i) => (
                      <span 
                        key={i} 
                        className="px-3 py-1 rounded-full text-sm bg-gradient-to-r from-purple-100/50 to-blue-100/50 text-purple-800 border border-purple-200/50"
                      >
                        {getStringValue(cuisine)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  This business hasn't specified any signature dishes yet.
                  {userData?.cuisineSpecialties ? ` They specialize in ${userData.cuisineSpecialties}.` : ''}
                </p>
              )}
              
              {/* Overview */}
              {structured.overview && (
                <div>
                  <h3 className="text-lg font-medium mb-2">Overview:</h3>
                  <p className="leading-relaxed">{getStringValue(structured.overview)}</p>
                </div>
              )}
              
              {/* Why Choose Us */}
              {hasSellingPoints ? (
                <div>
                  <h3 className="text-lg font-medium mb-2">Why Choose Us:</h3>
                  <div className="space-y-2">
                    {whyChooseUs.map((point, i) => (
                      <div key={i} className="flex items-start">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs mr-2 mt-0.5 flex-shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        </div>
                        <p>{getStringValue(point)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  No specific selling points have been added yet.
                  {userData?.uniqueSellingPoints ? 
                  ` Their unique qualities include: ${userData.uniqueSellingPoints}` : ''}
                </p>
              )}
              
              {/* Ideal Clients */}
              <div>
                <h3 className="text-lg font-medium mb-2">Ideal Clients:</h3>
                <p>{getStringValue(structured.idealClients) || 
                 userData?.idealClients || 
                 'All types of clients and events'}</p>
              </div>
              
              {/* Testimonials & Awards */}
              {structured.testimonialsAndAwards && (
                <div>
                  <h3 className="text-lg font-medium mb-2">Testimonials & Awards:</h3>
                  <div className="space-y-3">
                    {structured.testimonialsAndAwards.testimonials && 
                     structured.testimonialsAndAwards.testimonials.map((testimonial, i) => (
                      <div key={i} className="p-4 bg-gradient-to-r from-purple-50/30 to-blue-50/30 rounded-lg border border-purple-100/30">
                        <p className="italic">"{getStringValue(testimonial.quote)}"</p>
                        <p className="text-sm text-muted-foreground mt-2">— {getStringValue(testimonial.source)}</p>
                      </div>
                    ))}
                    
                    {structured.testimonialsAndAwards.awards && 
                     structured.testimonialsAndAwards.awards.length > 0 && (
                      <div className="space-y-2 mt-3">
                        {structured.testimonialsAndAwards.awards.map((award, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 flex items-center justify-center text-white flex-shrink-0">
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                              </svg>
                            </div>
                            <p>{getStringValue(award)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Contact Information */}
              {structured.contactInformation && (
                <div>
                  <h3 className="text-lg font-medium mb-2">Contact Information:</h3>
                  <div className="space-y-1">
                    {structured.contactInformation.phone && (
                      <p className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {structured.contactInformation.phone}
                      </p>
                    )}
                    {structured.contactInformation.email && (
                      <p className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        {structured.contactInformation.email}
                      </p>
                    )}
                    {structured.contactInformation.socialMedia && 
                     structured.contactInformation.socialMedia.map((social, i) => (
                      <p key={i} className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        {social}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* AI Flyer Generator */}
        {aiProfile && (
          <div className="mb-8">
            <AIFlyerGenerator 
              profileId={profileId}
              profileData={profile}
              aiProfileData={aiProfile}
            />
          </div>
        )}
        
        <div className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={() => router.push(`/profile/${profileId}`)}
            className="border-gray-200 hover:border-purple-500/50"
          >
            <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            Back to Profile
          </Button>
          
          <Button 
            onClick={() => router.push('/campaign/setup')}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-ai-glow transition-all duration-300"
          >
            Create Campaign
            <svg className="w-4 h-4 ml-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </Button>
        </div>
      </div>
    </div>
  )
}