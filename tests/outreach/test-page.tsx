'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Check if Supabase environment variables are available
const hasSupabaseConfig = supabaseUrl && supabaseKey;
console.log("Has Supabase config:", hasSupabaseConfig);

const categories = ['wedding', 'corporate', 'education'];

// Fallback profile if everything fails
const FALLBACK_PROFILE = {
  companyName: "Mon Macaron",
  description: "Mon Macaron, nestled in the heart of Raleigh, NC, is a distinguished catering service renowned for its exquisite French macarons, available in over 100 flavors and colors. With five years of expertise, we offer gluten-free options and customized dessert bars, perfect for weddings, corporate events, and more.",
  menuLink: "https://monmacaron.example.com/menu",
  managerContact: "Contact Manager, 9195384198",
  orderingLink: "https://monmacaron.example.com/order",
  focus: "Extensive variety of macaron flavors and colors",
  idealClients: "Brides-to-be seeking unique wedding desserts, Corporate event planners looking for memorable catering, Parents organizing school graduations with a sweet touch",
  specialties: [
    "Over 100 flavors and colors of French macarons",
    "Gluten-free options available", 
    "Exquisite dessert bars for events"
  ],
  photos: []
};

export default function OutreachTestPage() {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [templates, setTemplates] = useState<Record<string, string[]>>({});
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [useFallbackProfile, setUseFallbackProfile] = useState(false);
  
  // Try to get the user session when component mounts
  useEffect(() => {
    async function getUserSession() {
      if (!hasSupabaseConfig) {
        console.warn("Missing Supabase config");
        return;
      }
      
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
          console.error("Auth error:", error);
          return;
        }
        
        if (user) {
          console.log("Found authenticated user:", user.id);
          setUserId(user.id);
          // Fetch profile when we have the user ID
          fetchProfile(user.id);
        } else {
          console.log("No authenticated user");
          setError("No authenticated user. You can continue with the fallback profile.");
          setUseFallbackProfile(true);
        }
      } catch (err) {
        console.error("Error getting user session:", err);
        setError("Error getting user session. You can continue with the fallback profile.");
        setUseFallbackProfile(true);
      }
    }
    
    getUserSession();
  }, []);

  // Use fallback profile when needed
  useEffect(() => {
    if (useFallbackProfile) {
      setProfile(FALLBACK_PROFILE);
      console.log("Using fallback profile");
    }
  }, [useFallbackProfile]);

  // Function to fetch user profile
  const fetchProfile = async (userIdToFetch?: string) => {
    try {
      setError(null);
      
      if (!hasSupabaseConfig) {
        setError("Missing Supabase configuration. Using fallback profile.");
        setUseFallbackProfile(true);
        return null;
      }
      
      const id = userIdToFetch || userId;
      if (!id) {
        setError("User ID not available. Using fallback profile.");
        setUseFallbackProfile(true);
        return null;
      }
      
      // Get profile by user ID
      console.log("Fetching profile for user ID:", id);
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', id)
        .single();
      
      if (error) {
        console.error("Error fetching profile:", error);
        setError(`Could not fetch your profile: ${error.message}. Using fallback profile.`);
        setUseFallbackProfile(true);
        return null;
      }
      
      if (!data) {
        setError("No profile found for your user ID. Using fallback profile.");
        setUseFallbackProfile(true);
        return null;
      }
      
      console.log("Found profile:", data);

      // Extract AI profile data from the jsonb field if available
      let aiProfileData = {};
      try {
        if (data.ai_profile_data) {
          if (typeof data.ai_profile_data === 'string') {
            aiProfileData = JSON.parse(data.ai_profile_data);
          } else {
            aiProfileData = data.ai_profile_data;
          }
          console.log("Found AI profile data");
        }
      } catch (e) {
        console.error("Error parsing AI profile data:", e);
      }
      
      // Cast to any to avoid TypeScript errors
      const structuredProfile = (aiProfileData as any)?.structuredProfile || {};
      
      // Build the profile data
      const formattedProfile = {
        companyName: structuredProfile.businessName || data.business_name || data.company_name || 'Your Catering Company',
        description: structuredProfile.overview || data.business_description || data.description || 'We specialize in catering services',
        menuLink: data.menu_url || data.website || 'example.com/menu',
        managerContact: structuredProfile.contactInformation?.phone 
          ? `${structuredProfile.contactPerson?.name || 'Manager'}, ${structuredProfile.contactInformation.phone}`
          : `${data.first_name || 'Manager'} ${data.last_name || ''}, ${data.phone || 'No phone'}`,
        orderingLink: data.ordering_url || data.website || 'example.com/order',
        focus: structuredProfile.whyChooseUs?.[0] || data.business_focus || data.target_audience || 'Events and gatherings',
        idealClients: structuredProfile.idealClients || data.ideal_clients || 
                      (Array.isArray(data.target_categories) ? data.target_categories.join(', ') : 'Corporate events'),
        specialties: structuredProfile.mostRequestedDishes || 
                   (Array.isArray(data.specialties) ? data.specialties : 
                   (data.specialties ? [data.specialties] : ['Custom menu design'])),
        photos: Array.isArray(data.photo_urls) ? data.photo_urls : 
               (data.photo_urls ? [data.photo_urls] : [])
      };
      
      setProfile(formattedProfile);
      return formattedProfile;
    } catch (err: any) {
      console.error("Profile fetch error:", err);
      setError(`Error fetching profile: ${err.message || "Unknown error"}. Using fallback profile.`);
      setUseFallbackProfile(true);
      return null;
    }
  };

  // Function to generate templates for a category using API
  const generateTemplates = async (category: string) => {
    try {
      setError(null);
      setLoading(prev => ({ ...prev, [category]: true }));
      
      // Make sure we have a profile
      let profileData = profile || FALLBACK_PROFILE;
      
      // Call the production API endpoint
      console.log(`Generating templates for ${category} using direct profile`);
      const response = await fetch('/api/outreach/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category,
          profile: profileData,
          testMode: true
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Server error (${response.status})`;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If parsing fails, use the raw text
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to generate templates');
      }
      
      // Update state with the templates
      setTemplates(prev => ({
        ...prev,
        [category]: data.templates[category] || []
      }));
      
    } catch (err: any) {
      console.error(`Error generating templates for ${category}:`, err);
      setError(`Error generating templates for ${category}: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(prev => ({ ...prev, [category]: false }));
    }
  };

  // Generate all templates
  const generateAllTemplates = async () => {
    setError(null);
    
    // Make sure we have a profile
    let profileData = profile || FALLBACK_PROFILE;
    
    // Generate templates for each category
    for (const category of categories) {
      try {
        setLoading(prev => ({ ...prev, [category]: true }));
        
        // Call the production API endpoint with the direct profile data
        const response = await fetch('/api/outreach/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            category,
            profile: profileData,
            testMode: true
          }),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = `Server error (${response.status})`;
          
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
            errorMessage = errorText || errorMessage;
          }
          
          throw new Error(errorMessage);
        }
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to generate templates');
        }
        
        // Update state with the templates
        setTemplates(prev => ({
          ...prev,
          [category]: data.templates[category] || []
        }));
      } catch (err: any) {
        console.error(`Error generating templates for ${category}:`, err);
        setError(`Error generating templates for ${category}: ${err.message || "Unknown error"}`);
      } finally {
        setLoading(prev => ({ ...prev, [category]: false }));
      }
    }
  };

  // Use fallback profile button handler
  const handleUseFallback = () => {
    setUseFallbackProfile(true);
    setProfile(FALLBACK_PROFILE);
    setError(null);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Outreach Template Test Page</h1>
      
      {/* Profile Section */}
      <div className="mb-8 p-4 border rounded-lg bg-gray-50">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">User Profile</h2>
          <div className="flex gap-2">
            <button 
              onClick={() => fetchProfile()} 
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              {profile ? 'Refresh Profile' : 'Load Profile'}
            </button>
            <button 
              onClick={handleUseFallback} 
              className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
            >
              Use Fallback Profile
            </button>
          </div>
        </div>
        
        {profile ? (
          <div className="grid grid-cols-2 gap-4">
            <div><strong>Company:</strong> {profile.companyName}</div>
            <div><strong>Contact:</strong> {profile.managerContact}</div>
            <div className="col-span-2"><strong>Description:</strong> {profile.description}</div>
            <div><strong>Menu Link:</strong> {profile.menuLink}</div>
            <div><strong>Ordering Link:</strong> {profile.orderingLink}</div>
            <div><strong>Focus:</strong> {profile.focus}</div>
            <div><strong>Ideal Clients:</strong> {profile.idealClients}</div>
            <div className="col-span-2">
              <strong>Specialties:</strong> {profile.specialties?.join(', ')}
            </div>
          </div>
        ) : (
          <p className="text-gray-500 italic">No profile loaded yet</p>
        )}
      </div>
      
      {/* Action buttons */}
      <div className="mb-6 flex gap-4">
        <button 
          onClick={generateAllTemplates} 
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          disabled={!profile && !useFallbackProfile || Object.values(loading).some(Boolean)}
        >
          Generate All Templates
        </button>
      </div>
      
      {/* Error display */}
      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded text-red-800">
          {error}
        </div>
      )}
      
      {/* Templates section */}
      <div className="grid grid-cols-1 gap-8">
        {categories.map(category => (
          <div key={category} className="border rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold capitalize">{category} Templates</h2>
              <button 
                onClick={() => generateTemplates(category)} 
                className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
                disabled={!profile && !useFallbackProfile || loading[category]}
              >
                {loading[category] ? 'Generating...' : 'Generate'}
              </button>
            </div>
            
            {templates[category]?.length > 0 ? (
              <div className="space-y-4">
                {templates[category].map((template, idx) => (
                  <div key={idx} className="border p-3 rounded bg-white">
                    <div className="font-medium mb-2">Email {idx + 1}</div>
                    <pre className="whitespace-pre-wrap text-sm">{template}</pre>
                  </div>
                ))}
              </div>
            ) : loading[category] ? (
              <div className="text-center p-8">
                <div className="animate-pulse">
                  <div className="h-2 bg-slate-200 rounded mb-2.5"></div>
                  <div className="h-2 bg-slate-200 rounded mb-2.5"></div>
                  <div className="h-2 bg-slate-200 rounded mb-2.5"></div>
                  <div className="h-2 bg-slate-200 rounded"></div>
                </div>
                <p className="mt-4 text-gray-500">Generating templates...</p>
              </div>
            ) : (
              <p className="text-gray-500 italic text-center p-8">
                No templates generated yet. Click the Generate button to start.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 