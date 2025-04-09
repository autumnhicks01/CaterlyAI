'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { toast } from 'react-hot-toast';

interface Profile {
  id: string;
  companyName: string;
  description: string;
  menuLink: string;
  managerContact: string;
  orderingLink: string;
  focus: string;
  idealClients: string;
  specialties: string[] | string;
  photos: string;
  user_id?: string;
}

interface TemplateResponse {
  templates: string[];
  stats: {
    totalTemplates: number;
  }
}

export default function OutreachTestPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [templates, setTemplates] = useState<TemplateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState('wedding');
  const [debugInfo, setDebugInfo] = useState<string>('');
  const supabase = createClientComponentClient();

  // Available campaign categories
  const campaignCategories = [
    { id: 'wedding', name: 'Wedding Venues', color: 'bg-pink-600 hover:bg-pink-700' },
    { id: 'corporate', name: 'Corporate Venues', color: 'bg-blue-600 hover:bg-blue-700' },
    { id: 'education', name: 'Educational Venues', color: 'bg-green-600 hover:bg-green-700' }
  ];

  useEffect(() => {
    async function fetchProfile() {
      setIsProfileLoading(true);
      let debugLog = '===== PROFILE FETCH DEBUGGING =====\n';
      
      try {
        // First try to get the profile from the API route
        debugLog += '1. Attempting to fetch profile from API route\n';
        const apiResponse = await fetch('/api/profile/current');
        debugLog += `2. API response status: ${apiResponse.status}\n`;
        
        if (apiResponse.ok) {
          const apiData = await apiResponse.json();
          debugLog += `3. API data received: ${JSON.stringify(apiData, null, 2)}\n`;
          
          // Check if we have profile data in any format
          if (apiData) {
            debugLog += '4. API data exists\n';
            // Log all keys for debugging
            debugLog += `5. API data keys: ${Object.keys(apiData).join(', ')}\n`;
            
            // Handle nested profile structure
            const profileData = apiData.profile || apiData;
            debugLog += `6. Using ${apiData.profile ? 'nested' : 'direct'} profile data\n`;
            
            // Extract user_input_data if it exists
            const userInputData = profileData.user_input_data || {};
            debugLog += `7. User input data present: ${Object.keys(userInputData).length > 0 ? 'yes' : 'no'}\n`;
            
            // Get specialties as array
            let specialtiesArray: string[] = [];
            const rawSpecialties = profileData.specialties || userInputData.cuisineSpecialties || '';
            
            if (Array.isArray(rawSpecialties)) {
              specialtiesArray = rawSpecialties;
            } else if (typeof rawSpecialties === 'string' && rawSpecialties.trim()) {
              specialtiesArray = rawSpecialties.split(',').map(s => s.trim());
            }
            
            debugLog += `8. Specialties converted to array with ${specialtiesArray.length} items\n`;
            
            // Normalize field names from various possible sources
            const normalizedProfile: Profile = {
              id: profileData.id || '',
              companyName: profileData.business_name || profileData.companyName || userInputData.businessName || '',
              description: profileData.description || userInputData.uniqueSellingPoints || '',
              menuLink: profileData.menuLink || profileData.website_url || userInputData.website || '',
              managerContact: profileData.managerContact || userInputData.managerContact || userInputData.ownerContact || '',
              orderingLink: profileData.orderingLink || profileData.website_url || '',
              focus: profileData.focus || userInputData.cuisineSpecialties || userInputData.serviceTypes || '',
              idealClients: profileData.idealClients || userInputData.idealClients || '',
              specialties: specialtiesArray,
              photos: profileData.photos || (userInputData.photo_urls ? userInputData.photo_urls.join(',') : ''),
              user_id: profileData.user_id || ''
            };
            
            // Add each field value to debug log
            Object.entries(normalizedProfile).forEach(([key, value]) => {
              debugLog += `9. Normalized ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}\n`;
            });
            
            // Check if we have minimal required data
            if (normalizedProfile.companyName || normalizedProfile.description) {
              debugLog += '10. Profile has minimal required data, using it\n';
              setProfile(normalizedProfile);
              setDebugInfo(debugLog);
              setIsProfileLoading(false);
              return;
            } else {
              debugLog += '10. Normalized profile missing required fields, continuing search\n';
            }
          } else {
            debugLog += '4. No API data received despite 200 status\n';
          }
        } else {
          debugLog += `3. Error fetching from profile API: ${apiResponse.status}\n`;
        }

        // Fall back to direct database query if needed
        debugLog += '11. Falling back to direct database query\n';
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user?.id) {
          debugLog += `12. Got authenticated user: ${user.id}\n`;
          
          // Try looking up profile by user_id first
          debugLog += '13. Trying user_profiles table with user_id\n';
          let { data: profileData, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();
           
          if (profileError) {
            debugLog += `14. Error from user_profiles: ${profileError.message} (code: ${profileError.code})\n`;
            
            // Try profiles table as fallback 
            debugLog += '15. Trying profiles table with id=user.id\n';
            const { data: legacyProfile, error: legacyError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single();
              
            if (legacyError) {
              debugLog += `16. Error from profiles table: ${legacyError.message} (code: ${legacyError.code})\n`;
            } else {
              debugLog += '16. Found profile in profiles table\n';
              profileData = legacyProfile;
            }
          } else {
            debugLog += '14. Found profile in user_profiles table\n';
          }
          
          if (profileData) {
            debugLog += `17. Profile data: ${JSON.stringify(profileData, null, 2)}\n`;
            
            // Extract user_input_data if it exists
            const userInputData = profileData.user_input_data || {};
            
            // Get specialties as array
            let specialtiesArray: string[] = [];
            const rawSpecialties = profileData.specialties || userInputData.cuisineSpecialties || '';
            
            if (Array.isArray(rawSpecialties)) {
              specialtiesArray = rawSpecialties;
            } else if (typeof rawSpecialties === 'string' && rawSpecialties.trim()) {
              specialtiesArray = rawSpecialties.split(',').map(s => s.trim());
            }
            
            // Normalize field names
            const normalizedProfile: Profile = {
              id: profileData.id || '',
              companyName: profileData.business_name || profileData.companyName || userInputData.businessName || '',
              description: profileData.description || userInputData.uniqueSellingPoints || '',
              menuLink: profileData.menuLink || profileData.website_url || userInputData.website || '',
              managerContact: profileData.managerContact || userInputData.managerContact || userInputData.ownerContact || '',
              orderingLink: profileData.orderingLink || profileData.website_url || '',
              focus: profileData.focus || userInputData.cuisineSpecialties || userInputData.serviceTypes || '',
              idealClients: profileData.idealClients || userInputData.idealClients || '',
              specialties: specialtiesArray,
              photos: profileData.photos || (userInputData.photo_urls ? userInputData.photo_urls.join(',') : ''),
              user_id: profileData.user_id || ''
            };
            
            // Add each field value to debug log
            Object.entries(normalizedProfile).forEach(([key, value]) => {
              debugLog += `18. DB Normalized ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}\n`;
            });
            
            setProfile(normalizedProfile);
          } else {
            debugLog += '17. No profile found in any table\n';
            setProfile(null);
          }
        } else {
          debugLog += '12. No authenticated user found\n';
          setProfile(null);
        }
      } catch (error: any) {
        debugLog += `Error in profile fetch: ${error.message}\n`;
        console.error('Error in profile fetch:', error);
        setProfile(null);
      } finally {
        // Final status
        debugLog += `FINAL STATUS: Profile ${profile ? 'FOUND' : 'NOT FOUND'}\n`;
        setDebugInfo(debugLog);
        console.log(debugLog);
        setIsProfileLoading(false);
      }
    }

    fetchProfile();
  }, [supabase]);

  const generateTemplates = async (selectedCategory: string) => {
    if (!profile) {
      toast.error('Please enter profile information first');
      return;
    }
    
    setCategory(selectedCategory);
    setIsLoading(true);
    setTemplates(null);
    setError(null);

    try {
      // Log attempt
      console.log(`Generating templates for category: ${selectedCategory}`);
      console.log('Using profile:', profile);

      // API call with retry logic for rate limits
      const maxRetries = 2;
      let retryCount = 0;
      let success = false;

      while (!success && retryCount <= maxRetries) {
        try {
          const response = await fetch('/api/outreach/start', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-csrf-protection': '1'
            },
            body: JSON.stringify({
              category: selectedCategory,
              profile
            })
          });

          if (response.status === 429) {
            // Rate limit encountered
            const retryAfterHeader = response.headers.get('Retry-After') || '60';
            const retryAfter = parseInt(retryAfterHeader, 10);
            const waitTime = retryAfter * 1000;
            
            retryCount++;
            console.log(`Rate limit hit. Retry ${retryCount}/${maxRetries} after ${waitTime}ms`);
            
            // Show toast for rate limit
            toast.error(`API rate limit reached. Waiting ${retryAfter} seconds before retry...`);
            
            if (retryCount <= maxRetries) {
              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue; // Try again
            }
          }

          // Process the response
          const data = await response.json();
          
          if (!response.ok) {
            throw new Error(data.error || `API Error: ${response.status}`);
          }
          
          setTemplates(data.templates as TemplateResponse);
          success = true;
          
          // Show success toast
          toast.success(`Generated ${data.stats.totalTemplates} templates for ${selectedCategory} venues`);
          
        } catch (err) {
          // Handle retry loop errors
          if (retryCount >= maxRetries) {
            throw err; // Let the outer catch handle this
          }
          retryCount++;
        }
      }
    } catch (err: any) {
      console.error('Error generating templates:', err);
      setError(err.message || 'Failed to generate templates');
      toast.error(err.message || 'Failed to generate templates');
    } finally {
      setIsLoading(false);
    }
  };

  const copyTemplateToClipboard = (index: number) => {
    if (templates && templates.templates && templates.templates[index]) {
      navigator.clipboard.writeText(templates.templates[index]);
      toast.success('Template copied to clipboard');
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Outreach Template Generator</h1>
      
      {isProfileLoading ? (
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4">Loading profile...</p>
        </div>
      ) : profile === null ? (
        <div className="mb-8 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <h2 className="text-xl font-semibold mb-2">No Profile Found</h2>
          <p>Please log in or create a profile to generate templates.</p>
          <p className="mt-2 text-sm">You need to provide company information before generating templates.</p>
          
          <details className="mt-4 text-xs">
            <summary className="cursor-pointer">Show Debug Info</summary>
            <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto max-h-96 text-red-500">
              {debugInfo}
            </pre>
          </details>
        </div>
      ) : (
        <div>
          <div className="mb-8 p-4 bg-gray-50 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Profile Information</h2>
            <p><strong>Company:</strong> {profile.companyName}</p>
            <p><strong>Description:</strong> {profile.description}</p>
            <p><strong>Focus:</strong> {profile.focus}</p>
            <p><strong>Ideal Clients:</strong> {profile.idealClients}</p>
            
            <details className="mt-4 text-xs">
              <summary className="cursor-pointer">Show Debug Info</summary>
              <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto max-h-96">
                {debugInfo}
              </pre>
            </details>
          </div>
          
          <div className="mb-6">
            <h3 className="block mb-2 font-medium">Select Campaign Type:</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {campaignCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => generateTemplates(cat.id)}
                  disabled={isLoading}
                  className={`p-4 text-white rounded-lg ${cat.color} disabled:opacity-50 flex flex-col items-center justify-center h-24`}
                >
                  <span className="text-lg font-semibold">{cat.name}</span>
                  <span className="text-sm mt-1">
                    {isLoading && category === cat.id ? 'Generating...' : 'Generate Templates'}
                  </span>
                </button>
              ))}
            </div>
          </div>
          
          {isLoading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-4">Generating templates for {category} venues...</p>
              <p className="text-sm text-gray-500 mt-2">This may take a minute or two.</p>
            </div>
          )}
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
              <h3 className="font-semibold mb-1">Error</h3>
              <p>{error}</p>
              <p className="mt-2 text-sm">
                This may be due to rate limiting. Please try again in a few minutes.
              </p>
            </div>
          )}
          
          {templates && templates.templates && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">
                {category.charAt(0).toUpperCase() + category.slice(1)} Venue Templates ({templates.templates.length})
              </h2>
              
              <div className="space-y-6">
                {templates.templates.map((template, index) => (
                  <div key={index} className="p-4 border rounded-lg bg-white shadow-sm">
                    <div className="flex justify-between mb-2">
                      <h3 className="font-semibold text-lg">Email #{index + 1}</h3>
                      <button 
                        onClick={() => copyTemplateToClipboard(index)}
                        className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="whitespace-pre-wrap bg-gray-50 p-3 rounded">
                      {template}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 