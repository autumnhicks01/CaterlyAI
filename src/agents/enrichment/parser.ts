/**
 * Parser functions for handling AI responses
 */

/**
 * Parse AI response into structured enrichment data
 */
export function parseResponse(response: string, leadInfo: any): any {
  try {
    let parsedData: any;
    
    try {
      parsedData = JSON.parse(response);
    } catch (jsonError) {
      // Try to find JSON in the text if direct parsing fails
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse JSON from response');
      }
    }
    
    // Map the parsed data to our EnrichmentData structure
    const result = {
      venueName: parsedData.venueName || leadInfo.name,
      aiOverview: parsedData.aiOverview,
      eventManagerName: parsedData.eventManagerName || parsedData.contact_name,
      eventManagerEmail: parsedData.eventManagerEmail || parsedData.contact_email || leadInfo.email,
      eventManagerPhone: parsedData.eventManagerPhone || parsedData.contact_phone || leadInfo.phone,
      website: parsedData.website || leadInfo.website,
      commonEventTypes: parsedData.commonEventTypes || parsedData.event_types || [],
      venueCapacity: typeof parsedData.venueCapacity === 'number' ? parsedData.venueCapacity : null,
      inHouseCatering: typeof parsedData.inHouseCatering === 'boolean' ? parsedData.inHouseCatering : null,
      amenities: parsedData.amenities || [],
      pricingInformation: parsedData.pricingInformation || parsedData.pricing_info || '',
      preferredCaterers: parsedData.preferredCaterers || []
    };
    
    return result;
  } catch (error) {
    console.error('[ENRICHMENT-AGENT] Error parsing AI response:', error);
    
    // Return basic data from the lead info
    return { 
      venueName: leadInfo.name,
      website: leadInfo.website,
      eventManagerEmail: leadInfo.email,
      eventManagerPhone: leadInfo.phone,
      aiOverview: `${leadInfo.name} is a venue located at ${leadInfo.address || 'an unknown location'}.`
    };
  }
} 