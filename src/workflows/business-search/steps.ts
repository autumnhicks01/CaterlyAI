import { Step } from '@mastra/core/workflows';
import { searchBusinessesWithGooglePlaces } from '@/tools/googlePlaces';
import { businessAgent, enhanceBusinessBatch, enhanceBusinessesWithStreaming } from '@/agents/businessAgent';
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
      if (context['progressEmitter']) {
        (context['progressEmitter'] as any).emit('progress', {
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
      if (context['progressEmitter']) {
        (context['progressEmitter'] as any).emit('error', {
          step: 'search-businesses',
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      throw error;
    }
  }
});

/**
 * Step to enhance business details using AI with parallel processing
 */
export const enhanceBusinessesStep = new Step({
  id: 'enhance-businesses',
  description: 'Enhance business information with additional details using parallel processing',
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
    
    const businesses = searchResults.businesses;
    console.log(`Enhancing ${businesses.length} businesses with additional details using parallel processing`);
    
    // Check if context has a progressEmitter before using it
    if (context['progressEmitter']) {
      (context['progressEmitter'] as any).emit('progress', {
        step: 'enhance-businesses',
        status: 'started',
        count: businesses.length,
        message: `Enhancing ${businesses.length} businesses with AI in parallel...`
      });
    }
    
    try {
      // Split businesses into smaller batches for parallel processing
      // We use 5 businesses per batch as a reasonable size
      const BATCH_SIZE = 5;
      const batches: any[][] = [];
      
      for (let i = 0; i < businesses.length; i += BATCH_SIZE) {
        batches.push(businesses.slice(i, i + BATCH_SIZE));
      }
      
      console.log(`Split businesses into ${batches.length} batches for parallel processing`);
      
      // Process batches in parallel
      const batchPromises = batches.map((batch, index) => 
        enhanceBusinessBatch(batch, index)
      );
      
      // Regular progress updates if context has progressEmitter
      if (context['progressEmitter']) {
        let processedCount = 0;
        const totalCount = businesses.length;
        const updateInterval = setInterval(() => {
          (context['progressEmitter'] as any).emit('progress', {
            step: 'enhance-businesses',
            status: 'processing',
            count: processedCount,
            total: totalCount,
            message: `Processed ${processedCount} of ${totalCount} businesses...`
          });
        }, 2000); // Update every 2 seconds
        
        // Clean up interval when done
        const cleanup = () => clearInterval(updateInterval);
        Promise.all(batchPromises).then(cleanup, cleanup);
      }
      
      // Wait for all batches to complete
      const enhancedBatches = await Promise.all(batchPromises);
      
      // Combine all batches into one array
      const enhancedBusinesses = enhancedBatches.flat();
      
      console.log(`Successfully enhanced ${enhancedBusinesses.length} businesses in parallel`);
      
      const result: EnhancedBusinessResult = {
        businesses: enhancedBusinesses,
        count: enhancedBusinesses.length,
        location: searchResults.location,
        query: searchResults.query
      };
      
      // Emit completion event if context has progressEmitter
      if (context['progressEmitter']) {
        (context['progressEmitter'] as any).emit('progress', {
          step: 'enhance-businesses',
          status: 'completed',
          count: result.businesses.length,
          message: `Enhanced ${result.businesses.length} businesses with additional details`
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error in parallel enhanceBusinessesStep:', error);
      
      // Emit error event if context has progressEmitter
      if (context['progressEmitter']) {
        (context['progressEmitter'] as any).emit('error', {
          step: 'enhance-businesses',
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      // Return original businesses if enhancement fails
      return {
        businesses: businesses,
        count: businesses.length,
        location: searchResults.location,
        query: searchResults.query
      };
    }
  }
});

/**
 * Streaming version of the enhance businesses step
 * This step processes businesses and streams the results as they become available
 */
export const enhanceBusinessesStreamingStep = new Step({
  id: 'enhance-businesses-streaming',
  description: 'Enhance business information with streaming results',
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
    
    const businesses = searchResults.businesses;
    console.log(`Enhancing ${businesses.length} businesses with streaming results`);
    
    // Check if context has a progressEmitter before using it
    if (context['progressEmitter']) {
      (context['progressEmitter'] as any).emit('progress', {
        step: 'enhance-businesses-streaming',
        status: 'started',
        count: businesses.length,
        message: `Enhancing ${businesses.length} businesses with streaming...`
      });
    }
    
    try {
      // Get the streaming response
      const { stream } = await enhanceBusinessesWithStreaming(businesses);
      
      // Convert the stream to collected results
      const reader = stream.getReader();
      const enhancedBusinesses: any[] = [];
      let done = false;
      
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        
        if (doneReading) {
          done = true;
          break;
        }
        
        // Parse the chunk as a UTF-8 string
        const chunk = new TextDecoder().decode(value);
        
        // Each line is a JSON object
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            
            // Handle progress updates
            if (data.type === 'progress' && context['progressEmitter']) {
              (context['progressEmitter'] as any).emit('progress', {
                step: 'enhance-businesses-streaming',
                status: 'processing',
                count: data.current,
                total: data.total,
                message: data.message
              });
            }
            
            // Handle business data
            if (data.type === 'business' && data.data) {
              enhancedBusinesses.push(data.data);
              
              // Emit progress for each business added
              if (context['progressEmitter']) {
                (context['progressEmitter'] as any).emit('progress', {
                  step: 'enhance-businesses-streaming',
                  status: 'processing',
                  count: enhancedBusinesses.length,
                  total: businesses.length,
                  message: `Processed ${enhancedBusinesses.length} of ${businesses.length} businesses`
                });
              }
            }
          } catch (error) {
            console.error('Error parsing stream chunk:', error);
          }
        }
      }
      
      console.log(`Successfully enhanced ${enhancedBusinesses.length} businesses via streaming`);
      
      const result: EnhancedBusinessResult = {
        businesses: enhancedBusinesses,
        count: enhancedBusinesses.length,
        location: searchResults.location,
        query: searchResults.query
      };
      
      // Emit completion event if context has progressEmitter
      if (context['progressEmitter']) {
        (context['progressEmitter'] as any).emit('progress', {
          step: 'enhance-businesses-streaming',
          status: 'completed',
          count: result.businesses.length,
          message: `Enhanced ${result.businesses.length} businesses with streaming`
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error in streaming enhanceBusinessesStep:', error);
      
      // Emit error event if context has progressEmitter
      if (context['progressEmitter']) {
        (context['progressEmitter'] as any).emit('error', {
          step: 'enhance-businesses-streaming',
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      // Return original businesses if enhancement fails
      return {
        businesses: businesses,
        count: businesses.length,
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
    if (context['progressEmitter']) {
      (context['progressEmitter'] as any).emit('progress', {
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
      if (context['progressEmitter']) {
        (context['progressEmitter'] as any).emit('progress', {
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
      if (context['progressEmitter']) {
        (context['progressEmitter'] as any).emit('error', {
          step: 'validate-businesses',
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      // Return original businesses if validation fails
      return enhancedResults;
    }
  }
}); 