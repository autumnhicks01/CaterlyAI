// /lib/outreachAgent.ts
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Types for profile data
interface CateringProfile {
  companyName?: string;
  description?: string;
  menuLink?: string;
  managerContact?: string;
  orderingLink?: string;
  focus?: string;
  idealClients?: string;
  specialties?: string[];
  photos?: string[];
  [key: string]: any;
}

// Helper function to get current season and upcoming holidays
function getSeasonalContext(date: Date = new Date()): { season: string; upcomingHolidays: string[] } {
  const month = date.getMonth();
  
  // Determine season
  let season: string;
  if (month >= 2 && month <= 4) season = "spring";
  else if (month >= 5 && month <= 7) season = "summer";
  else if (month >= 8 && month <= 10) season = "fall";
  else season = "winter";

  // Determine upcoming holidays (more comprehensive list)
  const upcomingHolidays: string[] = [];
  
  // Current month + next 3 months holidays
  const holidayMap: Record<number, string[]> = {
    0: ["New Year's Day", "Martin Luther King Jr. Day", "Chinese New Year"],
    1: ["Valentine's Day", "President's Day", "Mardi Gras"],
    2: ["St. Patrick's Day", "Women's History Month", "March Equinox"],
    3: ["Easter", "Earth Day", "Passover", "Ramadan"],
    4: ["Mother's Day", "Memorial Day", "Cinco de Mayo"],
    5: ["Father's Day", "Juneteenth", "Pride Month", "Summer Solstice"],
    6: ["Independence Day", "Canada Day"],
    7: ["Labor Day", "Back to School Season"],
    8: ["Hispanic Heritage Month", "Rosh Hashanah", "Fall Equinox"],
    9: ["Halloween", "Breast Cancer Awareness Month", "Diwali"],
    10: ["Veterans Day", "Thanksgiving", "Native American Heritage Month"],
    11: ["Christmas", "Hanukkah", "Kwanzaa", "New Year's Eve", "Winter Solstice"]
  };
  
  // Add current month holidays
  if (holidayMap[month]) {
    upcomingHolidays.push(...holidayMap[month]);
  }
  
  // Add next month holidays
  const nextMonth = (month + 1) % 12;
  if (holidayMap[nextMonth]) {
    upcomingHolidays.push(...holidayMap[nextMonth]);
  }
  
  // Add month after next holidays
  const monthAfterNext = (month + 2) % 12;
  if (holidayMap[monthAfterNext]) {
    upcomingHolidays.push(...holidayMap[monthAfterNext]);
  }
  
  return { season, upcomingHolidays };
}

/**
 * Generate fresh campaign emails - no caching
 * @param category The business category to target
 * @param profile The catering company profile for personalization
 * @param options Additional options for customizing the campaign email generation
 */
export async function generateDripCampaign(
  category: string, 
  profile?: CateringProfile,
  options?: {
    useStreaming?: boolean;
    currentDate?: string;
    templateCount?: number;
    weekSpan?: number;
    forceRefresh?: boolean;
    leads?: any[];
  }
): Promise<string[]> {
  // Normalize category for consistent processing
  const normalizedCategory = category.toLowerCase().trim();
  
  // Default options
  const templateCount = options?.templateCount || 8;
  const weekSpan = options?.weekSpan || 12;
  const useStreaming = options?.useStreaming || false;
  const hasLeads = options?.leads && options.leads.length > 0;
  const currentDate = options?.currentDate ? new Date(options.currentDate) : new Date();
  
  try {
    console.log(`Generating fresh campaign emails for ${normalizedCategory} with date: ${currentDate.toLocaleDateString()}`);
    console.log(`Has leads: ${hasLeads ? 'Yes' : 'No'}, Lead count: ${options?.leads?.length || 0}`);
    
    // Get seasonal context for email personalization
    const { season, upcomingHolidays } = getSeasonalContext(currentDate);
    console.log(`Generating campaign for ${normalizedCategory} in ${season} with holidays: ${upcomingHolidays.join(', ')}`);
    
    // Use faster integrated approach
    const campaignEmails = await generateBatchedEmails(
      normalizedCategory, 
      season, 
      upcomingHolidays, 
      profile,
      templateCount,
      weekSpan,
      useStreaming,
      options?.leads || []
    );
    
    console.log(`Successfully generated ${campaignEmails.length} campaign emails for ${normalizedCategory}`);
    return campaignEmails;
  } catch (error) {
    console.error(`Error generating campaign emails for ${normalizedCategory}:`, error);
    throw error;
  }
}

/**
 * Generate emails with a single API call for better performance
 */
async function generateBatchedEmails(
  category: string,
  season: string,
  upcomingHolidays: string[],
  profile?: CateringProfile,
  templateCount: number = 8,
  weekSpan: number = 12,
  useStreaming: boolean = false,
  leads: any[] = []
): Promise<string[]> {
  // Format profile information for the prompt
  const companyName = profile?.companyName || "Your Catering Company";
  const description = profile?.description || "We specialize in creating memorable dining experiences with fresh, locally-sourced ingredients and exceptional service.";
  const menuLink = profile?.menuLink || "[Menu Link]";
  const managerContact = profile?.managerContact || "[Contact Information]";
  const orderingLink = profile?.orderingLink || "[Ordering Link]";
  const specialties = profile?.specialties?.join(", ") || "custom menu design, dietary accommodations";
  
  // Lead information for personalization, if available
  let leadInfo = "";
  if (leads && leads.length > 0) {
    leadInfo = `
    LEAD INFORMATION (Use this to make emails more relevant):
    - You are targeting ${leads.length} leads in the ${category} category
    - Example venue: ${leads[0].name || ""}
    - Type of venue: ${leads[0].type || category}
    - Location: ${leads[0].location || "local area"}
    ${leads[0].description ? `- About the venue: ${leads[0].description.substring(0, 200)}...` : ""}
    `;
  }
  
  // Enhanced unified prompt combining generation and polish in one step
  const systemPrompt = `
    You are an expert email campaign creator for catering businesses. You excel at B2B and B2C marketing, 
    creating persuasive, seasonally-relevant content with perfect grammar and formatting.
    
    TODAY'S DATE: ${new Date().toLocaleDateString()}
    CURRENT SEASON: ${season}
    UPCOMING HOLIDAYS: ${upcomingHolidays.join(', ')}
    
    COMPANY INFORMATION:
    Business Name: ${companyName}
    Description: ${description}
    Menu Link: ${menuLink}
    Manager Contact: ${managerContact}
    Ordering Link: ${orderingLink}
    Specialties: ${specialties}
    
    ${leadInfo}
    
    YOUR TASK:
    Create ${templateCount} complete email templates for a ${weekSpan}-week drip campaign targeting ${category} clients. These emails should build on each other in a logical sequence that nurtures leads from introduction to booking.
    
    FOR EACH EMAIL:
    1. Each email MUST have a UNIQUE subject line (under 60 characters)
       - Do NOT use the word "elevate" in any subject line
       - Each subject line must be completely different in wording, not just slight variations
       - Use diverse, compelling action words (partner, discover, transform, enhance, etc.)
    2. Length: 100-200 words per email
    3. Include seasonal references and upcoming holiday connections where appropriate
    4. DO NOT use [Lead Name] placeholders - these emails will be sent to general info@ addresses
    5. Include the catering company's actual links, information, and unique selling points
    6. ALWAYS include a clear, compelling call to action in EVERY email that specifically invites the recipient to:
       - Schedule a 15-minute phone call, OR
       - Book a tasting session, OR
       - Schedule a menu consultation
    7. Target the specific needs of ${category} venues and event planners
    8. Each email must reference how the partnership benefits the venue's clients and makes the venue look better
    9. Include the sender's full contact information at the end of every email
    
    SEQUENCE DETAILS:
    - Email 1 (Day 1): Introduction - Introduce the company, establish your value proposition for venues
    - Email 2 (Day 5): Testimonial - Share a venue success story, highlight a specific benefit venues receive
    - Email 3 (Week 2): Menu Options - Present customized offerings that complement the venue's ambiance
    - Email 4 (Week 3): Case Study - Tell a success story about a venue partnership with specific results
    - Email 5 (Week 5): Seasonal Offer - Present a timely, seasonal promotion with venue-specific benefits
    - Email 6 (Week 7): Client Attraction - Share how your services help venues attract more bookings
    - Email 7 (Week 9): Partnership Benefits - Outline exclusive advantages for venue partners
    - Email 8 (Week 12): Final Opportunity - Create urgency with a time-sensitive venue partner program
    
    CRITICAL REQUIREMENTS:
    1. Each email MUST build on the previous ones by referencing the ongoing conversation
    2. Each email MUST contain EXACTLY ONE clear call-to-action focused on booking a call, tasting, or consultation
    3. Each email MUST explain benefits from the VENUE'S perspective, not just the end client
    4. ALL emails must end with the sender's full signature including name, position, company, and email
    5. Each subject line MUST be distinct and clearly indicate which stage of the sequence it belongs to
    6. DO NOT use [Lead Name] or any other personalization placeholders - these will go to general email addresses
    7. NO TWO subject lines should use the same key action word (especially avoid "elevate" entirely)
    
    WRITING STYLE REQUIREMENTS:
    1. Write in a warm, professional, and conversational tone that sounds like a real person
    2. Avoid stiff or formal language like "I hope this email finds you well" or "I am writing to"
    3. Do not use AI-sounding phrases like "Don't hesitate to" or "Please feel free to"
    4. Use natural transitions between paragraphs that maintain a coherent flow 
    5. Keep emails concise, focused, and scannable with short paragraphs
    6. Use a friendly yet professional greeting without personal names (e.g., "Hello," or "Hi there,")
    
    FORMAT:
    Format each email clearly with "Email #1", "Email #2", etc. followed by "Subject: [Your Subject]" and then the email body.
  `;

  try {
    console.log('Starting email template generation (single-pass)...');
    
    // Single API call for complete template generation
    if (useStreaming) {
      // Handle streaming response
      const stream = await openai.chat.completions.create({
        model: "gpt-4-turbo", 
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Please create ${templateCount} optimized email templates for ${companyName}'s drip campaign targeting ${category} venues and event planners. 
            Each email should follow the sequence structure provided, building a cohesive journey from introduction to partnership. 
            Focus on venue benefits, not just end-client benefits.
            
            IMPORTANT REMINDERS:
            1. Every email must have a UNIQUE subject line with NO REPEATING ACTION WORDS
            2. DO NOT use the word "elevate" in any subject line
            3. DO NOT use [Lead Name] or other personalization placeholders
            4. Each email must have exactly one specific call-to-action
            5. Include strong sequence transitions to show these are part of an ongoing conversation
            6. Make these emails sound natural and conversational, not like AI-generated content
            
            Please create all ${templateCount} emails now, formatted clearly with "Email #1", "Email #2", etc.`
          },
        ],
        temperature: 0.7,
        max_tokens: 4000,
        stream: true,
      });

      // Collect chunks from stream
      let fullContent = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        fullContent += content;
      }
      
      // Process the full content
      const emailTemplates = splitIntoEmails(fullContent);
      
      // Error handling for insufficient templates
      if (emailTemplates.length < templateCount) {
        console.warn(`Only generated ${emailTemplates.length} templates, expected ${templateCount}. Adding placeholder prompts.`);
        while (emailTemplates.length < templateCount) {
          emailTemplates.push(`Subject: Email ${emailTemplates.length + 1}\n\nGeneration incomplete. Please regenerate this template.`);
        }
      }
      
      return emailTemplates;
    } else {
      // Non-streaming approach
      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo", 
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Please create ${templateCount} optimized email templates for ${companyName}'s drip campaign targeting ${category} venues and event planners. 
            Each email should follow the sequence structure provided, building a cohesive journey from introduction to partnership. 
            Focus on venue benefits, not just end-client benefits.
            
            IMPORTANT REMINDERS:
            1. Every email must have a UNIQUE subject line with NO REPEATING ACTION WORDS
            2. DO NOT use the word "elevate" in any subject line
            3. DO NOT use [Lead Name] or other personalization placeholders
            4. Each email must have exactly one specific call-to-action
            5. Include strong sequence transitions to show these are part of an ongoing conversation
            6. Make these emails sound natural and conversational, not like AI-generated content
            
            Please create all ${templateCount} emails now, formatted clearly with "Email #1", "Email #2", etc.`
          },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      });
      
      console.log('Email templates generated successfully');
      const fullContent = response.choices[0].message.content || '';
      
      // Process full content into separate emails
      const emailTemplates = splitIntoEmails(fullContent);
      
      // Error handling for insufficient templates
      if (emailTemplates.length < templateCount) {
        console.warn(`Only generated ${emailTemplates.length} templates, expected ${templateCount}. Adding placeholder prompts.`);
        while (emailTemplates.length < templateCount) {
          emailTemplates.push(`Subject: Email ${emailTemplates.length + 1}\n\nGeneration incomplete. Please regenerate this template.`);
        }
      }
      
      return emailTemplates;
    }
  } catch (error) {
    console.error('Error in template generation:', error);
    throw error;
  }
}

/**
 * Helper: Splits the GPT output into an array of email strings.
 */
function splitIntoEmails(gptOutput: string): string[] {
  // A naive approach: look for lines with "Email #"
  const splitted = gptOutput.split(/Email #\d+/i).map((part) => part.trim());
  // The first split may be empty if the text starts with "Email #1"; remove empties
  const filtered = splitted.filter((p) => p.length > 10);
  return filtered;
}
