import { useState } from 'react';
import { CateringProfileData } from '@/lib/ai/agents/profileAgent';

interface UseProfileGeneratorReturn {
  generateProfile: (data: CateringProfileData) => Promise<string>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to handle generating a catering business profile
 * 
 * This hook provides a function to call the profile generation API,
 * along with loading and error states.
 */
export function useProfileGenerator(): UseProfileGeneratorReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Call the profile generation API with the given data
   */
  const generateProfile = async (data: CateringProfileData): Promise<string> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/profile/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate profile');
      }
      
      return result.companyProfile;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return '';
    } finally {
      setIsLoading(false);
    }
  };

  return {
    generateProfile,
    isLoading,
    error,
  };
} 