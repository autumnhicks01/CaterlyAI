import { Step } from '@mastra/core/workflows';
import { searchBusinessesWithGooglePlaces } from '@/tools/googlePlaces';
import { businessAgent } from '@/agents/businessAgent';
import { BusinessSearchInput, BusinessSearchResult, EnhancedBusinessResult } from './schemas';
import { stringify, extractJsonFromLlmResponse } from '@/lib/utils';

/**
 * Step to search for businesses using Google Places API
 */
export const searchBusinessesStep = new Step({
  id: 'search-businesses',
  description: 'Search for businesses using Google Places API',
  execute: async ({ context }) => {
    // Get input data from the trigger
    const triggerData = context.getStepResult<BusinessSearchInput>('trigger');
    
    if (!triggerData) {
      throw new Error('No trigger data available');
    }
    
    const { query, location, radius } = triggerData;
    
    console.log(`Searching for businesses with query: "${query}" in ${location}`);
    
    try {
      // Call the Google Places tool
      const result = await searchBusinessesWithGooglePlaces(query, location, radius * 1000); // Convert km to meters
      
      console.log(`Found ${result.businesses.length} businesses matching search criteria`);
      
      // Emit progress event if context has progressEmitter
      if (context.progressEmitter) {
        context.progressEmitter.emit('progress', {
          step: 'search-businesses',
          status: 'completed',
          count: result.businesses.length,
          message: `Found ${result.businesses.length} businesses matching your search criteria`
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error in searchBusinessesStep:', error);
      
      // Emit error event if context has progressEmitter
      if (context.progressEmitter) {
        context.progressEmitter.emit('error', {
          step: 'search-businesses',
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      throw error;
    }
  }
});

/**
 * Step to enhance business details using AI
 */
export const enhanceBusinessesStep = new Step({
  id: 'enhance-businesses',
  description: 'Enhance business information with additional details',
  execute: async ({ context }) => {
    // Get search results from previous step
    const searchResults = context.getStepResult<BusinessSearchResult>('search-businesses');
    
    if (!searchResults || !searchResults.businesses || searchResults.businesses.length === 0) {
      return {
        businesses: [],
        count: 0,
        location: searchResults?.location || '',
        query: searchResults?.query || ''
      };
    }
    
    console.log(`Enhancing ${searchResults.businesses.length} businesses with additional details`);
    
    // Emit start progress event if context has progressEmitter
    if (context.progressEmitter) {
      context.progressEmitter.emit('progress', {
        step: 'enhance-businesses',
        status: 'started',
        count: searchResults.businesses.length,
        message: `Enhancing ${searchResults.businesses.length} businesses with AI...`
      });
    }
    
    try {
      // Use the business agent with streaming for real-time updates
      const enhancedBusinessesStream = await businessAgent.stream([
        {
          role: "user",
          content: `
            Enhance the following business listings with additional details relevant for catering:
            ${stringify(searchResults.businesses)}
            
            For each business:
            1. Add or improve the description focusing on catering potential
            2. Estimate venue capacity if it has event space
            3. Identify the type of events it likely hosts
            4. Note any specific catering requirements or opportunities
            
            Return the enhanced businesses in a structured JSON format.
          `
        }
      ]);
      
      // Collect the streamed response
      let enhancedText = '';
      
      // Process the stream
      for await (const chunk of enhancedBusinessesStream.textStream) {
        enhancedText += chunk;
        
        // Emit streaming event if context has progressEmitter
        if (context.progressEmitter) {
          context.progressEmitter.emit('stream', {
            step: 'enhance-businesses',
            chunk
          });
        }
      }
      
      // Parse the complete response
      const enhancedData = extractJsonFromLlmResponse(enhancedText, {}) || {};
      
      const result: EnhancedBusinessResult = {
        businesses: Array.isArray(enhancedData) ? enhancedData : ((enhancedData as any).businesses || searchResults.businesses),
        count: Array.isArray(enhancedData) ? enhancedData.length : ((enhancedData as any).businesses?.length || searchResults.businesses.length),
        location: searchResults.location,
        query: searchResults.query
      };
      
      // Emit completion event if context has progressEmitter
      if (context.progressEmitter) {
        context.progressEmitter.emit('progress', {
          step: 'enhance-businesses',
          status: 'completed',
          count: result.businesses.length,
          message: `Enhanced ${result.businesses.length} businesses with additional details`
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error in enhanceBusinessesStep:', error);
      
      // Emit error event if context has progressEmitter
      if (context.progressEmitter) {
        context.progressEmitter.emit('error', {
          step: 'enhance-businesses',
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      // Return original businesses if enhancement fails
      return {
        businesses: searchResults.businesses,
        count: searchResults.businesses.length,
        location: searchResults.location,
        query: searchResults.query
      };
    }
  }
});

/**
 * Step to validate and filter businesses for catering relevance
 */
export const validateBusinessesStep = new Step({
  id: 'validate-businesses',
  description: 'Validate and filter businesses for catering relevance',
  execute: async ({ context }) => {
    // Get enhanced businesses from previous step
    const enhancedResults = context.getStepResult<EnhancedBusinessResult>('enhance-businesses');
    
    if (!enhancedResults || !enhancedResults.businesses || enhancedResults.businesses.length === 0) {
      return {
        businesses: [],
        count: 0,
        location: enhancedResults?.location || '',
        query: enhancedResults?.query || ''
      };
    }
    
    console.log(`Validating ${enhancedResults.businesses.length} businesses for catering relevance`);
    
    // Emit progress event if context has progressEmitter
    if (context.progressEmitter) {
      context.progressEmitter.emit('progress', {
        step: 'validate-businesses',
        status: 'started',
        count: enhancedResults.businesses.length,
        message: `Validating ${enhancedResults.businesses.length} businesses for catering relevance...`
      });
    }
    
    try {
      // Filter businesses for catering relevance
      const validatedBusinesses = enhancedResults.businesses.filter(business => {
        // Filter criteria for catering relevance
        // Business must have a name and be of a relevant type
        if (!business.name) {
          return false;
        }
        
        // Check if it has event space or is a relevant business type
        const hasEventSpace = business.hasEventSpace === true;
        const relevantType = business.type && [
          'event_venue', 'banquet_hall', 'conference_center', 'restaurant', 
          'hotel', 'wedding_venue', 'corporate_office', 'event_space'
        ].some(type => business.type?.toLowerCase().includes(type.toLowerCase()) ?? false);
        
        return hasEventSpace || relevantType;
      });
      
      console.log(`Found ${validatedBusinesses.length} relevant businesses for catering`);
      
      const result = {
        businesses: validatedBusinesses,
        count: validatedBusinesses.length,
        location: enhancedResults.location,
        query: enhancedResults.query
      };
      
      // Emit completion event if context has progressEmitter
      if (context.progressEmitter) {
        context.progressEmitter.emit('progress', {
          step: 'validate-businesses',
          status: 'completed',
          count: result.businesses.length,
          message: `Found ${result.businesses.length} relevant businesses for catering`
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error in validateBusinessesStep:', error);
      
      // Emit error event if context has progressEmitter
      if (context.progressEmitter) {
        context.progressEmitter.emit('error', {
          step: 'validate-businesses',
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      // Return original businesses if validation fails
      return enhancedResults;
    }
  }
}); 