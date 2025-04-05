import { z } from 'zod';
import { Step } from '../core';
import { Business, businessSchema } from '../schemas/common';

/**
 * Input schema for business search step
 */
export const searchInputSchema = z.object({
  query: z.string().describe('Search query for businesses'),
  location: z.string().describe('Location to search in (city, address)'),
  radius: z.number().optional().default(25).describe('Search radius in miles')
});

export type SearchInput = z.infer<typeof searchInputSchema>;

/**
 * Step to search for businesses using Google Places API
 */
export const searchBusinessesStep = new Step({
  id: 'search-businesses',
  description: 'Search for businesses using Google Places API',
  inputSchema: searchInputSchema,
  execute: async ({ input }) => {
    if (!input) {
      throw new Error('No search input provided');
    }
    
    console.log(`Searching for businesses with query: "${input.query}" in ${input.location}`);
    
    try {
      // Import the GooglePlacesClient dynamically to avoid circular dependencies
      const { GooglePlacesClient } = await import('@/lib/googleplaces');
      
      const apiKey = process.env.GOOGLE_PLACES_API_KEY;
      if (!apiKey) {
        throw new Error('Google Places API key not configured');
      }
      
      // Convert miles to meters for the API
      const radiusInMeters = (input.radius || 25) * 1609.34;
      
      const client = new GooglePlacesClient(apiKey);
      const results = await client.searchPlaces(
        input.query,
        input.location,
        radiusInMeters
      );
      
      console.log(`Found ${results.length} businesses matching search criteria`);
      
      // Validate results against our schema
      const businesses = results.map(business => {
        try {
          return businessSchema.parse(business);
        } catch (error) {
          console.warn(`Failed to validate business data for ${business.name}:`, error);
          // Return a basic validated version with required fields
          return businessSchema.parse({
            name: business.name || 'Unknown Business',
            address: business.address || 'Unknown Address',
            type: business.type || 'business',
            contact: business.contact || {}
          });
        }
      });
      
      return {
        businesses,
        count: businesses.length,
        query: input.query,
        location: input.location
      };
    } catch (error) {
      console.error('Error in searchBusinessesStep:', error);
      throw error;
    }
  }
});

/**
 * Step to filter businesses based on relevance to catering
 */
export const filterBusinessesStep = new Step({
  id: 'filter-businesses',
  description: 'Filter businesses based on relevance to catering opportunities',
  execute: async ({ context }) => {
    const searchResults = context.getStepResult<{
      businesses: Business[];
      count: number;
      query: string;
      location: string;
    }>('search-businesses');
    
    if (!searchResults || !searchResults.businesses || searchResults.businesses.length === 0) {
      return {
        businesses: [],
        count: 0,
        query: searchResults?.query || '',
        location: searchResults?.location || ''
      };
    }
    
    console.log(`Filtering ${searchResults.businesses.length} businesses for catering relevance`);
    
    // Define business types that are likely to need catering services
    const relevantTypes = [
      'event_venue',
      'wedding_venue',
      'banquet_hall',
      'conference_center',
      'hotel',
      'community_center',
      'corporate_office',
      'museum',
      'gallery',
      'university',
      'college',
      'event_space',
      'meeting_room',
      'convention_center'
    ];
    
    // Keywords in name or type that suggest relevance
    const relevantKeywords = [
      'event', 'venue', 'wedding', 'conference', 'meeting', 'banquet',
      'hall', 'center', 'space', 'party', 'celebration', 'reception'
    ];
    
    // Filter businesses based on type and name
    const filteredBusinesses = searchResults.businesses.filter(business => {
      // If the business has a type that's in our relevant types list
      if (business.type && relevantTypes.some(type => 
        business.type?.toLowerCase().includes(type.toLowerCase())
      )) {
        return true;
      }
      
      // If the business name contains any of our relevant keywords
      if (business.name && relevantKeywords.some(keyword => 
        business.name.toLowerCase().includes(keyword.toLowerCase())
      )) {
        return true;
      }
      
      // If the business description contains any of our relevant keywords
      if (business.description && relevantKeywords.some(keyword => 
        business.description?.toLowerCase().includes(keyword.toLowerCase())
      )) {
        return true;
      }
      
      // By default, include the business
      return true;
    });
    
    console.log(`Filtered down to ${filteredBusinesses.length} relevant businesses`);
    
    return {
      businesses: filteredBusinesses,
      count: filteredBusinesses.length,
      query: searchResults.query,
      location: searchResults.location
    };
  }
});

/**
 * Step to enhance businesses with additional details
 */
export const enhanceBusinessesStep = new Step({
  id: 'enhance-businesses',
  description: 'Enhance businesses with additional details using OpenAI',
  execute: async ({ context }) => {
    const { businesses, count, query, location } = context.getStepResult<{
      businesses: Business[];
      count: number;
      query: string;
      location: string;
    }>('filter-businesses') || { businesses: [], count: 0, query: '', location: '' };
    
    if (!businesses || businesses.length === 0) {
      return { businesses: [], count: 0, query, location };
    }
    
    console.log(`Enhancing ${businesses.length} businesses with additional details`);
    
    // Import the OpenAI enrichment tool
    const { openAIEnrichmentTool } = await import('@/lib/ai/tools/openAITool');
    
    // Enhance each business with OpenAI (in smaller batches to avoid rate limits)
    const batchSize = 5;
    const enhancedBusinesses = [];
    
    for (let i = 0; i < businesses.length; i += batchSize) {
      const batch = businesses.slice(i, i + batchSize);
      console.log(`Processing batch ${i / batchSize + 1} (${batch.length} businesses)`);
      
      const batchPromises = batch.map(async (business) => {
        try {
          // Skip enhancement if we don't have basic info
          if (!business.name || !business.address) {
            console.warn(`Skipping enhancement for business with missing data: ${business.name || 'Unknown'}`);
            return business;
          }
          
          // Use the OpenAI enrichment tool to get additional details
          const enrichmentResult = await openAIEnrichmentTool.execute({
            name: business.name,
            address: business.address,
            phone: business.contact?.phone || '',
            website: business.contact?.website || ''
          });
          
          // Merge the enrichment data with the business
          const enrichedBusiness: Business = {
            ...business,
            description: enrichmentResult.description || business.description,
            hasEventSpace: enrichmentResult.hasEventSpace || false,
            contact: {
              ...business.contact,
              phone: business.contact?.phone || enrichmentResult.phone || '',
              website: business.contact?.website || enrichmentResult.website || '',
              email: business.contact?.email || enrichmentResult.email || ''
            }
          };
          
          return enrichedBusiness;
        } catch (error) {
          console.error(`Error enhancing business ${business.name}:`, error);
          return business;
        }
      });
      
      // Wait for all businesses in this batch to be enhanced
      const batchResults = await Promise.all(batchPromises);
      enhancedBusinesses.push(...batchResults);
      
      // Add a small delay between batches to avoid rate limits
      if (i + batchSize < businesses.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`Successfully enhanced ${enhancedBusinesses.length} businesses`);
    
    return {
      businesses: enhancedBusinesses,
      count: enhancedBusinesses.length,
      query,
      location
    };
  }
}); 