// FirecrawlTool.ts

/**
 * A tool that extracts structured data from websites
 */
export const firecrawlTool = {
  name: 'firecrawlTool',

  async extract(params: {
    url: string;
    formats?: string[];
    timeout?: number;
    waitTime?: number;
    enableWebSearch?: boolean;
  }) {
    try {
      // Validate URL
      if (!params.url || typeof params.url !== 'string') {
        console.error("Invalid URL provided:", params.url);
        return {
          success: false,
          error: "Invalid URL: URL must be a non-empty string"
        };
      }
      
      console.log(`Extracting data from website: ${params.url}`);
      
      // Normalize the URL for consistent handling
      const url = normalizeUrl(params.url);
      console.log(`Using normalized URL: ${url}`);
      
      // Make HTTP request to the URL and extract data
      const extractedData = await fetchAndExtractData(url, params);
      
      console.log(`Extraction completed for ${url}`);
      
      return {
        success: true,
        data: extractedData
      };
    } catch (error) {
      console.error(`Error extracting from ${params.url}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
};

/**
 * Normalizes a URL by ensuring it has proper format
 */
function normalizeUrl(url: string): string {
  try {
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    // Parse and validate the URL
    const parsedUrl = new URL(url);
    return parsedUrl.origin;
  } catch (error) {
    // If URL parsing fails, return original
    console.warn(`URL parsing failed for ${url}, using as-is:`, error);
    return url;
  }
}

/**
 * Fetches and extracts data from a URL
 */
async function fetchAndExtractData(url: string, params: {
  formats?: string[];
  timeout?: number;
  waitTime?: number;
  enableWebSearch?: boolean;
}): Promise<any> {
  try {
    console.log(`Starting extraction for ${url} with primary fetch method`);
    
    // Make HTTP request to the URL
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FirecrawlBot/1.0; +http://firecrawl.com)'
      },
      // Set timeout if provided
      signal: params.timeout ? AbortSignal.timeout(params.timeout) : undefined
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Get the HTML content
    const html = await response.text();
    
    // Check if we got substantial content
    if (html.length < 1000) {
      console.log(`Received small HTML response (${html.length} bytes), trying scrape fallback`);
      return await scrapeWithFallback(url, params);
    }

    // Clean the HTML to remove scripts, styles, and other non-content elements
    const cleanedHtml = cleanHtml(html);
    
    // Extract structured data from cleaned HTML
    const extractedData = extractDataFromHtml(cleanedHtml, url);
    
    // If we don't have enough meaningful data, try the scrape fallback
    if (!hasMinimalRequiredData(extractedData)) {
      console.log(`Extracted data missing key fields, trying scrape fallback for ${url}`);
      return await scrapeWithFallback(url, params);
    }
    
    // Format the result to match what the enrichment agent expects
    const formattedData = formatExtractedData(extractedData, url);

    return formattedData;
  } catch (error) {
    console.error(`Error in primary extraction for ${url}, trying fallback:`, error);
    return await scrapeWithFallback(url, params);
  }
}

/**
 * Fallback scraping implementation - simulates the behavior from enrichmentAgent.ts
 */
async function scrapeWithFallback(url: string, params: any): Promise<any> {
  console.log(`Using scrape fallback for ${url}`);
  
  try {
    // In a real implementation, this would call an external scraping service
    // For now, perform a more intensive extraction from the site
    
    // Make a new request with different headers to avoid caching
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      signal: params.timeout ? AbortSignal.timeout(params.timeout) : undefined
    });
    
    if (!response.ok) {
      throw new Error(`Fallback HTTP error! status: ${response.status}`);
    }
    
    // Get the HTML content
    const html = await response.text();
    
    // Clean the HTML more aggressively
    const cleanedHtml = cleanHtml(html);
    
    // Extract data with more aggressive patterns
    const extractedData = extractDataWithFallbackPatterns(cleanedHtml, url);
    
    // Format the data for the enrichment agent
    const formattedData = formatExtractedData(extractedData, url);
    
    return formattedData;
  } catch (error) {
    console.error(`Even fallback scraping failed for ${url}:`, error);
    
    // Create a minimal data structure with what we know
    return {
      venue_name: extractNameFromUrl(url),
      description: `Information for this venue could not be automatically extracted.`,
      address: "",
      contact_name: "",
      contact_email: "",
      contact_phone: "",
      event_types: ["Event"],
      in_house_catering: false,
      capacity: null,
      website: url,
      amenities: [],
      pricing_information: "",
      preferred_caterers: [],
      firecrawl_extracted: {
        extraction_failed: true,
        url: url
      }
    };
  }
}

/**
 * Checks if the extracted data has the minimal required fields
 */
function hasMinimalRequiredData(data: any): boolean {
  // Check if we have at least venue name and either a description, address, or contact info
  return data.venueName && (
    data.description || 
    data.physicalAddress || 
    data.contactInformation?.email || 
    data.contactInformation?.phone
  );
}

/**
 * Formats the extracted data to match what the enrichment agent expects
 */
function formatExtractedData(extractedData: any, url: string): any {
  return {
    venue_name: extractedData.venueName || extractNameFromUrl(url),
    description: extractedData.description || "",
    address: extractedData.physicalAddress || "",
    contact_name: extractedData.contactInformation?.contactPersonName || "",
    contact_email: extractedData.contactInformation?.email || "",
    contact_phone: extractedData.contactInformation?.phone || "",
    event_types: extractedData.eventTypes || [],
    in_house_catering: extractedData.inHouseCatering === true,
    capacity: extractedData.venueCapacity,
    website: url,
    amenities: extractedData.amenities || [],
    pricing_information: extractedData.pricingInformation || "",
    preferred_caterers: extractedData.preferredCaterers || [],
    management_contact_name: extractedData.managementContactName || "",
    management_contact_email: extractedData.managementContactEmail || "",
    management_contact_phone: extractedData.managementContactPhone || "",
    management_contact_title: extractedData.managementContactTitle || "",
    events_information: extractedData.eventsInformation || "",
    // Include the raw extraction data for reference
    firecrawl_extracted: extractedData
  };
}

/**
 * Cleans HTML by removing scripts, styles, and other non-content elements
 */
function cleanHtml(html: string): string {
  return html
    // Remove scripts
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    // Remove styles
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    // Remove inline styles
    .replace(/style="[^"]*"/gi, '')
    // Remove comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Simplify multiple spaces
    .replace(/\s+/g, ' ')
    // Remove hidden elements
    .replace(/<[^>]*display:\s*none[^>]*>[^<]*(?:(?!<\/div>)<[^<]*)*<\/[^>]*>/gi, '');
}

/**
 * Extract a venue name from a URL when other methods fail
 */
function extractNameFromUrl(url: string): string {
  try {
    // Remove protocol and www
    let domain = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
    
    // Remove TLD and everything after first slash
    domain = domain.split('.')[0].split('/')[0];
    
    // Replace hyphens and underscores with spaces
    domain = domain.replace(/[-_]/g, ' ');
    
    // Capitalize first letter of each word
    return domain.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') + " Venue";
  } catch {
    return "Unknown Venue";
  }
}

/**
 * Extracts data with more aggressive patterns specifically for the fallback method
 */
function extractDataWithFallbackPatterns(html: string, url: string): Record<string, any> {
  const extractedData: Record<string, any> = {
    venueName: "",
    description: "",
    physicalAddress: "",
    eventTypes: [],
    venueCapacity: null,
    inHouseCatering: false,
    amenities: [],
    pricingInformation: "",
    preferredCaterers: [],
    eventsInformation: "",
    contactInformation: {
      email: "",
      phone: "",
      contactPersonName: ""
    },
    managementContactName: "",
    managementContactEmail: "",
    managementContactPhone: "",
    managementContactTitle: ""
  };
  
  try {
    // Scan the entire page for email addresses and phone numbers
    const emailMatches = html.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || [];
    if (emailMatches.length > 0) {
      // Filter out common service emails and get the first relevant one
      const filteredEmails = emailMatches.filter(email => 
        !email.includes('wordpress') && 
        !email.includes('example.com') &&
        !email.includes('your@email.com'));
      
      if (filteredEmails.length > 0) {
        extractedData.contactInformation.email = filteredEmails[0];
        console.log(`Extracted email with fallback: ${filteredEmails[0]}`);
      }
    }
    
    // Look for phone numbers with various formats
    const phonePatterns = [
      /(?:\+?1[-.\s]?)?(?:\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4}))/g,
      /(?:Phone|Tel|Telephone|Call):?\s*(?:\+?1[-.\s]?)?(?:\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4}))/gi
    ];
    
    for (const pattern of phonePatterns) {
      const matches = Array.from(html.matchAll(pattern));
      if (matches.length > 0) {
        // Get the first full match
        extractedData.contactInformation.phone = matches[0][0].replace(/(?:Phone|Tel|Telephone|Call):?\s*/i, '');
        console.log(`Extracted phone with fallback: ${extractedData.contactInformation.phone}`);
        break;
      }
    }
    
    // Find address with more comprehensive patterns
    const addressPatterns = [
      // Look for full addresses with street, city, state, zip
      /(\d+[^,<>]{1,50}(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|court|ct|parkway|pkwy|way|place|pl|terrace|ter)[^,<>]{1,50},\s*[^,<>]{1,50},\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?)/i,
      
      // Look for addresses introduced by labels
      /(?:Address|Location|Find us|Located at):?\s*([^<>\n]{5,150}?\d{5}(?:-\d{4})?)/i,
      
      // Look for structured address sections
      /<address[^>]*>([\s\S]*?)<\/address>/i
    ];
    
    for (const pattern of addressPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        let addressText = match[1].replace(/<[^>]*>/g, ' ').trim();
        // Clean up the address text
        addressText = addressText.replace(/\s+/g, ' ').trim();
        
        // If it has numbers and looks like an address (not CSS)
        if (addressText.match(/\d+/) && !addressText.includes('{') && !addressText.includes('window.') && addressText.length < 200) {
          extractedData.physicalAddress = addressText;
          console.log(`Extracted address with fallback: ${addressText}`);
          break;
        }
      }
    }
    
    // Extract event types even more aggressively
    const eventTypeKeywords = [
      'wedding', 'weddings', 'corporate', 'meetings', 'meeting', 'party', 'parties', 
      'celebration', 'celebrations', 'conference', 'conferences', 'ceremony', 'ceremonies',
      'reception', 'receptions', 'social', 'gala', 'fundraiser', 'retreat', 'seminar', 
      'workshop', 'birthday', 'graduation', 'reunion', 'anniversary'
    ];
    
    // Find any mention of event types in the HTML
    const pageTextContent = html.replace(/<[^>]+>/g, ' ').toLowerCase();
    const foundEventTypes = eventTypeKeywords
      .filter(keyword => pageTextContent.includes(keyword))
      .map(type => {
        const singular = type.replace(/s$/, ''); // Remove trailing 's'
        return singular.charAt(0).toUpperCase() + singular.slice(1);
      })
      .filter((value, index, self) => self.indexOf(value) === index); // Unique values
    
    if (foundEventTypes.length > 0) {
      extractedData.eventTypes = foundEventTypes;
    }
    
    // Try to extract venue name more aggressively
    // First from the meta title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      const title = titleMatch[1].replace(/\s+/g, ' ').trim();
      if (title.length > 0 && title.toLowerCase() !== 'home' && !title.includes('</')) {
        extractedData.venueName = title.split('|')[0].trim(); // Often the site name is after a pipe
      }
    }
    
    // If no title found, try logo alt text or h1
    if (!extractedData.venueName) {
      const logoMatch = html.match(/<img[^>]*(?:logo|brand)[^>]*alt=["']([^"']+)["'][^>]*>/i) ||
                        html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
      
      if (logoMatch && logoMatch[1]) {
        extractedData.venueName = logoMatch[1].trim();
      }
    }
    
    // Extract description more aggressively
    const descriptionMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"[^>]*>/i) ||
                            html.match(/<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                            html.match(/<section[^>]*about[^>]*>([\s\S]*?)<\/section>/i);
    
    if (descriptionMatch && descriptionMatch[1]) {
      let description = descriptionMatch[1].replace(/<[^>]*>/g, ' ').trim();
      description = description.replace(/\s+/g, ' ').trim();
      
      if (description.length > 20 && !description.includes('{') && !description.includes('window.')) {
        extractedData.description = description;
      }
    }
    
    // Look for sections about "our venue" or "about us"
    if (!extractedData.description) {
      const aboutMatch = html.match(/<(?:div|section|article)[^>]*(?:about|venue-info|overview)[^>]*>([\s\S]*?)<\/(?:div|section|article)>/i);
      
      if (aboutMatch && aboutMatch[1]) {
        let aboutText = aboutMatch[1].replace(/<[^>]*>/g, ' ').trim();
        aboutText = aboutText.replace(/\s+/g, ' ').trim();
        
        if (aboutText.length > 50 && !aboutText.includes('{') && !aboutText.includes('window.')) {
          extractedData.description = aboutText.substring(0, 500) + (aboutText.length > 500 ? '...' : '');
        }
      }
    }
    
    return extractedData;
  } catch (error) {
    console.error('Error in fallback extraction:', error);
    return extractedData;
  }
}

/**
 * Extracts structured data from HTML content
 */
function extractDataFromHtml(html: string, url: string): Record<string, any> {
  const extractedData: Record<string, any> = {
    venueName: "",
    description: "",
    physicalAddress: "",
    eventTypes: [],
    venueCapacity: null,
    inHouseCatering: false,
    amenities: [],
    pricingInformation: "",
    preferredCaterers: [],
    eventsInformation: "",
    contactInformation: {
      email: "",
      phone: "",
      contactPersonName: ""
    },
    managementContactName: "",
    managementContactEmail: "",
    managementContactPhone: "",
    managementContactTitle: ""
  };
  
  try {
    // Extract schema.org structured data if present
    const schemaMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
    if (schemaMatches && schemaMatches.length > 0) {
      for (const match of schemaMatches) {
        try {
          const jsonContent = match.replace(/<script type="application\/ld\+json">/, '')
                                   .replace(/<\/script>/, '')
                                   .trim();
          const schemaData = JSON.parse(jsonContent);
          
          // Handle different schema types
          if (schemaData['@type'] === 'Place' || schemaData['@type'] === 'LocalBusiness' || 
              schemaData['@type'] === 'EventVenue' || schemaData['@type'] === 'Organization') {
            
            // Extract venue name
            if (schemaData.name && !extractedData.venueName) {
              extractedData.venueName = schemaData.name;
            }
            
            // Extract description
            if (schemaData.description && !extractedData.description) {
              extractedData.description = schemaData.description;
            }
            
            // Extract address
            if (schemaData.address && !extractedData.physicalAddress) {
              if (typeof schemaData.address === 'string') {
                extractedData.physicalAddress = schemaData.address;
              } else if (schemaData.address.streetAddress) {
                const addressParts = [
                  schemaData.address.streetAddress,
                  schemaData.address.addressLocality,
                  schemaData.address.addressRegion,
                  schemaData.address.postalCode
                ].filter(Boolean);
                
                extractedData.physicalAddress = addressParts.join(', ');
              }
            }
            
            // Extract contact information
            if (schemaData.telephone && !extractedData.contactInformation.phone) {
              extractedData.contactInformation.phone = schemaData.telephone;
            }
            
            if (schemaData.email && !extractedData.contactInformation.email) {
              extractedData.contactInformation.email = schemaData.email;
            }
            
            if (schemaData.contactPoint && Array.isArray(schemaData.contactPoint)) {
              for (const contact of schemaData.contactPoint) {
                if (contact.telephone && !extractedData.contactInformation.phone) {
                  extractedData.contactInformation.phone = contact.telephone;
                }
                if (contact.email && !extractedData.contactInformation.email) {
                  extractedData.contactInformation.email = contact.email;
                }
                if (contact.name && !extractedData.contactInformation.contactPersonName) {
                  extractedData.contactInformation.contactPersonName = contact.name;
                }
              }
            }
            
            // Extract capacity from event schema
            if (schemaData.maximumAttendeeCapacity && !extractedData.venueCapacity) {
              extractedData.venueCapacity = parseInt(schemaData.maximumAttendeeCapacity);
            }
          }
        } catch (e) {
          console.error('Error parsing schema.org data:', e);
        }
      }
    }
    
    // Extract meta tags
    const metaTitleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    if (metaTitleMatch && metaTitleMatch[1] && !extractedData.venueName) {
      extractedData.venueName = metaTitleMatch[1].trim();
    }
    
    const metaDescriptionMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i);
    if (metaDescriptionMatch && metaDescriptionMatch[1] && !extractedData.description) {
      extractedData.description = metaDescriptionMatch[1].trim();
    }

    // Look for email addresses both in mailto links and plain text
    const emailPatterns = [
      /mailto:([^"'>\s]+@[^"'>\s]+\.[^"'>\s]+)/g,
      /[\w.+-]+@[\w-]+\.[\w.-]+/g
    ];
    
    for (const pattern of emailPatterns) {
      const matches = Array.from(html.matchAll(pattern));
      for (const match of matches) {
        const email = match[1] || match[0];
        // Filter out common service emails
        if (!email.includes('wordpress') && 
            !email.includes('example.com') &&
            !email.includes('your@email.com')) {
          if (!extractedData.contactInformation.email) {
            extractedData.contactInformation.email = email;
            console.log(`Extracted email: ${email}`);
          } else if (!extractedData.managementContactEmail) {
            extractedData.managementContactEmail = email;
          }
        }
      }
    }

    // Look for phone numbers
    const phonePatterns = [
      /(?:tel:|telephone:|phone:|call:)\s*(?:\+?1[-.\s]?)?(?:\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4}))/gi,
      /(?:\+?1[-.\s]?)?(?:\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4}))/g
    ];
    
    for (const pattern of phonePatterns) {
      const matches = Array.from(html.matchAll(pattern));
      if (matches.length > 0) {
        if (matches[0][0].includes('tel:')) {
          // Extract just the number part after tel:
          const phoneStr = matches[0][0].split('tel:')[1].trim();
          extractedData.contactInformation.phone = phoneStr;
        } else {
          extractedData.contactInformation.phone = matches[0][0].replace(/(?:telephone:|phone:|call:)/i, '').trim();
        }
        console.log(`Extracted phone: ${extractedData.contactInformation.phone}`);
        break;
      }
    }

    // Extract contact person name from contact sections
    const contactSectionPatterns = [
      /<section[^>]*contact[^>]*>([\s\S]*?)<\/section>/i,
      /<div[^>]*contact[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*team[^>]*>([\s\S]*?)<\/div>/i
    ];
    
    for (const pattern of contactSectionPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const sectionHtml = match[1];
        
        // Look for person's name in the contact section
        const namePattern = /(?:<h\d[^>]*>([^<]+)<\/h\d>)|(?:<strong>([^<]+)<\/strong>)|(?:(?:contact|manager|coordinator|director|planner):\s*([^<,]+))/i;
        const nameMatch = sectionHtml.match(namePattern);
        
        if (nameMatch) {
          const name = (nameMatch[1] || nameMatch[2] || nameMatch[3]).trim();
          if (name.length > 2 && name.length < 50 && !/^\d+$/.test(name)) {
            extractedData.contactInformation.contactPersonName = name;
            console.log(`Extracted contact name: ${name}`);
          }
        }
      }
    }

    // Extract event types from content
    const eventTypeKeywords = [
      'wedding', 'weddings', 'corporate', 'meetings', 'meeting', 'party', 'parties', 
      'celebration', 'celebrations', 'conference', 'conferences', 'ceremony', 'ceremonies',
      'reception', 'receptions', 'social', 'gala', 'fundraiser', 'retreat', 'seminar', 
      'workshop', 'birthday', 'graduation', 'reunion', 'anniversary'
    ];
    
    const foundEventTypes = eventTypeKeywords
      .filter(keyword => html.toLowerCase().includes(keyword))
      .map(type => {
        // Normalize event type format (singular, capitalized)
        const singular = type.replace(/s$/, ''); // Remove trailing 's'
        return singular.charAt(0).toUpperCase() + singular.slice(1);
      })
      .filter((value, index, self) => self.indexOf(value) === index); // Unique values
    
    if (foundEventTypes.length > 0) {
      extractedData.eventTypes = foundEventTypes;
    }

    // Extract capacity information with more comprehensive patterns
    const capacityPatterns = [
      /(?:capacity|accommodate|fits|seats|hosting)(?:\s+up\s+to)?[^0-9]*(\d+)(?:\s+(?:people|guests|persons|attendees))?/i,
      /(\d+)(?:\s+(?:people|guests|persons|attendees))(?:\s+(?:capacity|can be accommodated|can be seated|can fit))/i,
      /holds\s+up\s+to\s+(\d+)/i,
      /maximum\s+capacity\s+(?:of\s+)?(\d+)/i
    ];
    
    for (const pattern of capacityPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const capacity = parseInt(match[1]);
        if (capacity > 10) { // Avoid small numbers that might not be capacity
          extractedData.venueCapacity = capacity;
          break;
        }
      }
    }

    // Extract in-house catering information
    const inHouseCateringPatterns = [
      /in-house catering/i,
      /we provide (?:our own|the) catering/i,
      /our catering services/i,
      /catering provided by us/i,
      /catering is included/i
    ];
    
    const outsideCateringPatterns = [
      /outside caterers? (?:are )?(?:welcome|allowed)/i,
      /bring your own caterer/i,
      /preferred caterers? list/i,
      /choose your own caterer/i,
      /external catering options/i
    ];
    
    // Check for in-house catering
    extractedData.inHouseCatering = inHouseCateringPatterns.some(pattern => pattern.test(html));
    
    // If no in-house found, check for explicit outside catering
    if (!extractedData.inHouseCatering) {
      extractedData.inHouseCatering = !outsideCateringPatterns.some(pattern => pattern.test(html));
    }

    // Extract address (with better filtering)
    if (!extractedData.physicalAddress) {
      const addressPatterns = [
        // Look for full addresses with street, city, state, zip
        /(\d+[^,<>]{1,50}(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|court|ct|parkway|pkwy|way|place|pl|terrace|ter)[^,<>]{1,50},\s*[^,<>]{1,50},\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?)/i,
        
        // Look for addresses introduced by labels
        /(?:Address|Location|Find us|Located at):?\s*([^<>\n]{5,150}?\d{5}(?:-\d{4})?)/i,
        
        // Look for structured address sections
        /<address[^>]*>([\s\S]*?)<\/address>/i
      ];
      
      for (const pattern of addressPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          let addressText = match[1].replace(/<[^>]*>/g, ' ').trim();
          // Clean up the address text
          addressText = addressText.replace(/\s+/g, ' ').trim();
          
          // Avoid CSS/JS content by checking for curly braces and length
          if (addressText.match(/\d+/) && !addressText.includes('{') && !addressText.includes('window.') && addressText.length < 200) {
            extractedData.physicalAddress = addressText;
            console.log(`Extracted address: ${addressText}`);
            break;
          }
        }
      }
    }

    // Extract amenities/features with better pattern matching
    const amenitiesSection = html.match(/(?:amenities|features|facilities|what we offer|included in|our venue offers|venue includes)[^<]*<[^>]*>([\s\S]*?)(?:<\/(?:ul|ol|div|section|p)>)/i);
    
    if (amenitiesSection) {
      const amenitiesText = amenitiesSection[1];
      // Extract list items or comma-separated values
      let amenitiesList = [];
      
      // Try to extract from list items first
      const listItems = amenitiesText.match(/<li[^>]*>([\s\S]*?)<\/li>/g);
      if (listItems && listItems.length > 0) {
        amenitiesList = listItems
          .map(item => item.replace(/<[^>]*>/g, '').trim())
          .filter(item => item.length > 0);
      } else {
        // Try to extract from paragraphs or other text
        amenitiesList = amenitiesText
          .split(/[,;•\n]/)
          .map(item => item.replace(/<[^>]*>/g, '').trim())
          .filter(item => item.length > 2); // Filter out very short items
      }
      
      // Common amenities to look for explicitly
      const commonAmenities = [
        'WiFi', 'Parking', 'A/V equipment', 'Stage', 'Dance floor', 'Tables', 
        'Chairs', 'Linens', 'Outdoor space', 'Bridal suite', 'Kitchen',
        'Bar service', 'Lighting', 'Sound system', 'Projector', 'Microphone'
      ];
      
      // Add common amenities if they appear in the HTML
      for (const amenity of commonAmenities) {
        if (html.toLowerCase().includes(amenity.toLowerCase()) && 
            !amenitiesList.some(a => a.toLowerCase().includes(amenity.toLowerCase()))) {
          amenitiesList.push(amenity);
        }
      }
      
      if (amenitiesList.length > 0) {
        extractedData.amenities = amenitiesList
          .filter((value, index, self) => self.indexOf(value) === index); // Unique values
      }
    }

    // Extract pricing information with more patterns
    const pricingPatterns = [
      /(?:pricing|rates|costs|fees|packages|rental fee|venue fee)[^<]*<[^>]*>([\s\S]*?)(?:<\/(?:div|section|p|ul|table)>)/i,
      /(?:pricing|rates|costs|fees|packages|rental fee|venue fee)[^\n\r]*((?:\$[0-9,]+(?:\.[0-9]{2})?[^\n\r]*)+)/i
    ];
    
    for (const pattern of pricingPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        let pricingText = match[1].replace(/<[^>]*>/g, ' ').trim();
        // Compress multiple spaces and clean up
        pricingText = pricingText.replace(/\s+/g, ' ').replace(/\s+\./g, '.').trim();
        if (pricingText.length > 10) { // Ensure we have substantial content
          extractedData.pricingInformation = pricingText;
          break;
        }
      }
    }

    // Extract preferred caterers
    const caterersSection = html.match(/(?:preferred caterers|approved caterers|catering partners|catering options)[^<]*<[^>]*>([\s\S]*?)(?:<\/(?:ul|ol|div|section|p)>)/i);
    
    if (caterersSection) {
      const caterersText = caterersSection[1];
      // Extract list items or comma-separated values
      let caterersList = [];
      
      // Try to extract from list items first
      const listItems = caterersText.match(/<li[^>]*>([\s\S]*?)<\/li>/g);
      if (listItems && listItems.length > 0) {
        caterersList = listItems
          .map(item => item.replace(/<[^>]*>/g, '').trim())
          .filter(item => item.length > 0);
      } else {
        // Try to extract from paragraphs or other text
        caterersList = caterersText
          .split(/[,;•\n]/)
          .map(item => item.replace(/<[^>]*>/g, '').trim())
          .filter(item => item.length > 3); // Filter out very short items
      }
      
      if (caterersList.length > 0) {
        extractedData.preferredCaterers = caterersList
          .filter((value, index, self) => self.indexOf(value) === index); // Unique values
      }
    }

    // Extract events information
    const eventsSection = html.match(/(?:upcoming events|past events|events calendar|recent events|featured events)[^<]*<[^>]*>([\s\S]*?)(?:<\/(?:ul|ol|div|section|p)>)/i);
    
    if (eventsSection) {
      let eventsText = eventsSection[1].replace(/<[^>]*>/g, ' ').trim();
      // Compress multiple spaces and clean up
      eventsText = eventsText.replace(/\s+/g, ' ').trim();
      
      if (eventsText.length > 20) {
        extractedData.eventsInformation = eventsText;
      }
    }

    return extractedData;
  } catch (error) {
    console.error('Error extracting data from HTML:', error);
    return extractedData;
  }
}
