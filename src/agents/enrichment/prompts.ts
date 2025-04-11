/**
 * Prompt templates for enrichment agent
 */

/**
 * Create a prompt for the AI model to analyze a business
 */
export function createPrompt(leadInfo: any, websiteContent: string = ''): string {
  return `You are analyzing a venue business for a catering company.
Please extract key details from the following information. Focus on finding contact emails and event details.

BUSINESS INFORMATION:
Name: ${leadInfo.name}
${leadInfo.type ? `Type: ${leadInfo.type}` : ''}
${leadInfo.address ? `Address: ${leadInfo.address}` : ''}
${leadInfo.website ? `Website: ${leadInfo.website}` : ''}
${leadInfo.phone ? `Phone: ${leadInfo.phone}` : ''}
${leadInfo.email ? `Email: ${leadInfo.email}` : ''}

${websiteContent ? 'WEBSITE CONTENT (extract):\n' + websiteContent.substring(0, 3000) + (websiteContent.length > 3000 ? '...(content truncated)' : '') : 'No website content available.'}

YOUR MOST IMPORTANT TASK is to find contact emails! Look very carefully for email addresses in the website content.
Specifically search for patterns like name@domain.com throughout the text.
Look at "Contact Us" sections, footers, and staff directories for email addresses.
Contact information is ABSOLUTELY CRITICAL - without it, this lead cannot be used.

Focus particularly on finding the event manager's or event coordinator's contact information.
Common titles to look for: "Event Manager", "Event Coordinator", "Event Director", "Catering Manager", etc.

Search for phrases like "For event inquiries, contact..." or "To schedule an event, email..."

Provide a response in valid JSON format:
{
  "venueName": "name of the venue",
  "website": "website URL if available",
  "aiOverview": "2-3 sentence description of the venue",
  "eventManagerName": "contact person name if found (especially event coordinator/manager)",
  "eventManagerEmail": "contact email (VERY IMPORTANT, search thoroughly for email addresses)",
  "eventManagerPhone": "contact phone number with area code",
  "commonEventTypes": ["types", "of", "events", "they", "host"],
  "venueCapacity": number of people they can accommodate or null,
  "inHouseCatering": boolean or null (whether they provide their own catering),
  "amenities": ["list", "of", "amenities"],
  "pricingInformation": "pricing details if available",
  "preferredCaterers": ["list", "of", "preferred", "caterers"] 
}`;
} 