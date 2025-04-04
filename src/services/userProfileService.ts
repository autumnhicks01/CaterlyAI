// userProfileService.ts
// Client-side service for interacting with the profile API endpoints

export interface UserProfile {
  id?: string;
  user_id?: string;
  business_name?: string | null;
  full_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  delivery_radius?: number | null;
  service_radius?: number | null;
  business_type?: string | null;
  contact_phone?: string | null;
  website_url?: string | null;
  photo_urls?: string[] | null;
  user_input_data?: any;
  ai_profile_data?: any;
  created_at?: string | null;
  updated_at?: string | null;
}

/**
 * Gets the current user's profile with full details
 * This uses /api/profile which returns all profile data
 */
async function getUserProfile(): Promise<UserProfile | null> {
  try {
    const response = await fetch('/api/profile', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error fetching user profile:', errorData);
      return null;
    }

    const data = await response.json();
    return data.profile;
  } catch (error) {
    console.error('Unexpected error fetching user profile:', error);
    return null;
  }
}

/**
 * Gets the current user's essential profile data
 * This uses /api/profile/current which returns limited profile fields
 * with focus on location and coordinates
 */
async function getCurrentProfile(): Promise<{authenticated: boolean, profile: UserProfile | null}> {
  try {
    const response = await fetch('/api/profile/current', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error fetching current profile:', errorData);
      return { authenticated: false, profile: null };
    }

    const data = await response.json();
    return {
      authenticated: data.authenticated || false,
      profile: data.profile
    };
  } catch (error) {
    console.error('Unexpected error fetching current profile:', error);
    return { authenticated: false, profile: null };
  }
}

/**
 * Saves or updates a user profile
 * Handles coordinates appropriately by ensuring they're formatted correctly
 */
async function saveProfile(profileData: Partial<UserProfile>): Promise<UserProfile | null> {
  try {
    // Ensure coordinates are properly handled
    const payload = { ...profileData };
    
    // Ensure user_input_data exists
    if (!payload.user_input_data) {
      payload.user_input_data = {};
    }
    
    // If coordinates exist in user_input_data, use those
    if (payload.user_input_data.coordinates) {
      console.log('Using coordinates from user_input_data:', 
        payload.user_input_data.coordinates.lat, 
        payload.user_input_data.coordinates.lng);
    } 
    // Otherwise, if we have latitude/longitude at root level, add them to user_input_data
    else if (payload.latitude !== undefined && payload.longitude !== undefined) {
      payload.user_input_data.coordinates = {
        lat: payload.latitude,
        lng: payload.longitude
      };
      console.log('Added coordinates to user_input_data from root level fields');
    }
    
    // Remove any root level latitude/longitude to avoid DB errors
    delete payload.latitude;
    delete payload.longitude;
    
    const response = await fetch('/api/profile/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error saving profile:', errorData);
      return null;
    }

    const data = await response.json();
    return data.profile;
  } catch (error) {
    console.error('Unexpected error saving profile:', error);
    return null;
  }
}

/**
 * Updates only the user input data portion of the profile
 */
async function updateUserInputData(inputData: any): Promise<UserProfile | null> {
  try {
    const response = await fetch('/api/profile/user-input', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(inputData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error updating user input data:', errorData);
      return null;
    }

    const data = await response.json();
    return data.profile;
  } catch (error) {
    console.error('Unexpected error updating user input data:', error);
    return null;
  }
}

/**
 * Updates only the AI data portion of the profile
 */
async function updateAIProfileData(aiData: any): Promise<UserProfile | null> {
  try {
    const response = await fetch('/api/profile/ai-data', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(aiData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error updating AI profile data:', errorData);
      return null;
    }

    const data = await response.json();
    return data.profile;
  } catch (error) {
    console.error('Unexpected error updating AI profile data:', error);
    return null;
  }
}

/**
 * Resets the user's profile data
 */
async function resetProfile(): Promise<boolean> {
  try {
    const response = await fetch('/api/profile/reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error resetting profile:', errorData);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Unexpected error resetting profile:', error);
    return false;
  }
}

export const userProfileService = {
  getUserProfile,
  getCurrentProfile,
  saveProfile,
  updateUserInputData,
  updateAIProfileData,
  resetProfile
};
