import { createClient } from '@/utils/supabase/server';

interface UserProfile {
  user_id: string;
  business_name?: string | null;
  full_address?: string | null;
  service_radius?: number | null;
  delivery_radius?: number | null;
  years_in_operation?: number | null;
  ideal_clients?: string | null;
  signature_dishes?: string | null;
  unique_selling_points?: string | null;
  brand_voice?: string | null;
  testimonials?: string | null;
  contact_info?: string | null;
  business_type?: string | null;
  contact_phone?: string | null;
  website_url?: string | null;
  photo_urls?: string[] | null;
  user_input_data?: any;
  ai_profile_data?: any;
  created_at?: string | null;
  updated_at?: string | null;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
  
  return data;
}

export function parseLocationString(location: string): { city: string; state: string } {
  if (!location || typeof location !== 'string') {
    console.error("Invalid location provided:", location);
    return { city: '', state: '' };
  }
  
  console.log("Parsing location:", location);
  
  try {
    // Normalize the input
    const cleanedLocation = location.trim();
    const parts = cleanedLocation.split(',').map(part => part.trim());
    
    // Check if it's a USA address (has USA or US at the end)
    const hasCountry = parts[parts.length - 1]?.match(/^(USA|US|United States)$/i);
    const addressParts = hasCountry ? parts.slice(0, -1) : parts;
    
    // Case 1: Street, City, State ZIP [Country]
    // e.g. "5249 Capital Blvd, Raleigh, NC 27616, USA"
    if (addressParts.length >= 3) {
      // Assume second-to-last part contains city
      const cityPart = addressParts[addressParts.length - 2];
      
      // Assume last part contains "State ZIP" or just "State"
      const stateZipPart = addressParts[addressParts.length - 1];
      
      // Try to extract state from "State ZIP" format
      const stateZipMatch = stateZipPart.match(/^([A-Z]{2})\s+\d+/);
      const stateOnly = stateZipPart.match(/^([A-Z]{2})$/);
      
      const state = stateZipMatch ? stateZipMatch[1] : (stateOnly ? stateOnly[1] : stateZipPart);
      
      console.log(`Parsed multi-part address: City=${cityPart}, State=${state}`);
      return { city: cityPart, state };
    }
    
    // Case 2: City, State ZIP [Country]
    // e.g. "Raleigh, NC 27616"
    else if (addressParts.length === 2) {
      const cityPart = addressParts[0];
      const stateZipPart = addressParts[1];
      
      // Try to extract state from "State ZIP" format
      const stateZipMatch = stateZipPart.match(/^([A-Z]{2})\s+\d+/);
      const stateOnly = stateZipPart.match(/^([A-Z]{2})$/);
      
      const state = stateZipMatch ? stateZipMatch[1] : (stateOnly ? stateOnly[1] : stateZipPart);
      
      console.log(`Parsed two-part address: City=${cityPart}, State=${state}`);
      return { city: cityPart, state };
    }
    
    // Fallback: try to find state code pattern in any part
    for (const part of addressParts) {
      const stateMatch = part.match(/\b([A-Z]{2})\b/);
      if (stateMatch) {
        // If we found a state, assume the previous part is the city
        const stateIndex = addressParts.indexOf(part);
        if (stateIndex > 0) {
          const cityPart = addressParts[stateIndex - 1];
          console.log(`Found state pattern: City=${cityPart}, State=${stateMatch[1]}`);
          return { city: cityPart, state: stateMatch[1] };
        }
      }
    }
    
    // Last resort: Try to directly geocode this location without parsing
    console.log(`Could not parse location traditionally: ${location}`);
    return { city: location, state: '' };
  } catch (error) {
    console.error("Error parsing location:", error, "for location:", location);
    return { city: location, state: '' };
  }
}