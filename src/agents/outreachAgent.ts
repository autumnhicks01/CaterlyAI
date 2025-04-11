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
  contactPerson?: { name: string; title: string };
  location?: string;
  yearsExperience?: string;
  contact_phone?: string;
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
  
  // Extract additional profile info if available
  const contactPersonName = profile?.contactPerson?.name || "";
  const contactPersonTitle = profile?.contactPerson?.title || "Catering Manager";
  const businessLocation = profile?.location || "";
  const yearsExperience = profile?.yearsExperience || "";
  const contactPhone = profile?.contact_phone || managerContact;
  
  // Lead information for personalization, if available
  let leadInfo = "";
  if (leads && leads.length > 0) {
    leadInfo = `
    LEAD INFORMATION (Use this to make emails more relevant):
    - You are targeting ${leads.length} leads in the ${category} category
    - Type of venue: ${category}
    - Location: local area
    `;
  }
  
  // Enhanced unified prompt combining generation and polish in one step
  const systemPrompt = `
    You are a professional copywriter experienced in crafting short, natural-sounding marketing emails. Please create an 8‑email sequence for a catering business campaign spanning 12 weeks. Each email must:
    
    TODAY'S DATE: ${new Date().toLocaleDateString()}
    CURRENT SEASON: ${season}
    UPCOMING HOLIDAYS: ${upcomingHolidays.join(', ')}
    
    COMPANY INFORMATION:
    Business Name: ${companyName}
    Description: ${description}
    Menu Link: ${menuLink}
    Manager Contact: ${contactPhone || managerContact}
    Ordering Link: ${orderingLink}
    Specialties: ${specialties}
    Contact Person Name: ${contactPersonName}
    Contact Person Title: ${contactPersonTitle}
    Business Location: ${businessLocation}
    Years Experience: ${yearsExperience}
    
    ${leadInfo}
    
    YOUR TASK:
    Create ${templateCount} complete email templates for a ${weekSpan}-week catering business campaign.

    STRICT EMAIL FORMAT REQUIREMENTS:
    • EVERY email MUST start with "Hi!" (no name, keep it generic)
    • DO NOT mention specific venues or locations in the emails
    • NO specific venue mentions like "Leslie-Alford-Mims House" or any other venue names
    • The FIRST EMAIL must follow this exact format:
      "Hi!

      I hope you're doing well. I'm [Contact Person Name], [Contact Person Title] of [Business Name], located at [Location]. We've spent [Years Experience] perfecting our craft, and we'd love to bring our passion for delicious food and catering to your next event.

      If you have something on the calendar soon, I'd be delighted to chat about how we can help. Just reply to this email or book a 15-minute call at this link [Calendar Link] to learn more.

      Best,
      [Contact Person Name]
      [Contact Person Title]
      [Business Name]
      [Phone Number]
      [Email]"

    EACH EMAIL MUST:
    • Stay around 150 words or fewer (concise and focused)
    • ALWAYS start with "Hi!" (not "Hello", "Greetings", or any other variation)
    • Omit any "AI" references, using a warm, friendly, conversational tone
    • Mention only the food and dishes found in the provided company information (no generic examples)
    • Address the following themes across the 8 emails:
      1) Introducing the catering service
      2) Highlighting core services and specialties
      3) Sharing testimonials or positive feedback
      4) Offering a limited-time promotion or special deal
      5) Mentioning seasonal/holiday options
      6) Addressing common concerns (budget, dietary requirements)
      7) Providing a "last call" reminder for any promotions
      8) Wrapping up with a friendly final follow-up
    • Include a clear call to action in EVERY email - one of these three options:
      1) Invite them to schedule a 15-minute phone call
      2) Ask a specific question to encourage them to reply to the email
      3) Invite them to book a tasting via calendar link
    • IMPORTANT: EXACTLY 2 EMAILS (no more, no less) must reference a specific upcoming holiday/seasonal event in BOTH the subject line AND email content
    • Reflect the provided company information to keep the content personal, relevant, and on-brand

    SEQUENCE TIMING:
    - Email 1 (Day 1): Introduction - Initial Contact (MUST follow the exact format specified above)
    - Email 2 (Day 5): Core Services
    - Email 3 (Week 2): Testimonials
    - Email 4 (Week 3): Limited-Time Promotion
    - Email 5 (Week 5): Seasonal Options (RECOMMENDED: Make this one of the holiday-themed emails)
    - Email 6 (Week 7): Address Common Concerns 
    - Email 7 (Week 9): Last Call Reminder
    - Email 8 (Week 12): Final Friendly Follow-up

    EMAIL REQUIREMENTS:
    1. Each email MUST have a UNIQUE subject line (under 60 characters)
       - Do NOT use the word "elevate" in any subject line
       - EXACTLY 2 emails must reference a holiday/seasonal event in both the subject line and email content
    2. Length: Must stay around 150 words or fewer
    3. DO NOT use [Lead Name] placeholders - these emails will be sent to general info@ addresses
    4. Include the catering company's actual information, specialties, and unique selling points
    5. ALWAYS include a clear call to action in EVERY email - one of:
       a) Schedule a 15-minute phone call with the catering manager
       b) Ask a specific question to encourage a reply
       c) Book a tasting session via calendar link
    6. Keep the tone warm, genuine, and free of industry jargon
    7. Make each email feel natural, helpful, and on topic
    8. Include a simple signature block at the end of EVERY email with:
       [Contact Person Name]
       [Contact Person Title]
       [Business Name]
       [Phone Number]
       [Email]
    
    FORMAT:
    Format each email clearly with "Email #1", "Email #2", etc. followed by "Subject: [Your Subject]" and then the email body with the signature block at the end.
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
            content: `Please create ${templateCount} natural-sounding marketing emails for ${companyName}'s catering business. 
            
            CRITICAL REMINDERS:
            1. EVERY email MUST start with "Hi!" (not Hello, Greetings, etc.)
            2. The FIRST email MUST follow the exact template format specified
            3. DO NOT mention specific venues like "Leslie-Alford-Mims House" or any venue names
            4. Keep each email concise (around 150 words or less)
            5. Use only specific food/dishes mentioned in the company information
            6. Include EXACTLY 2 emails with holiday/seasonal references in BOTH subject line AND email content
            7. Every email must have a unique subject line
            8. Each email MUST include one of these three call-to-action types:
               - Schedule a 15-minute phone call
               - A specific question to encourage reply
               - Book a tasting via calendar link
            9. Include a simple signature block at the end of each email
            10. Use warm, conversational language that sounds like a real person wrote it
            
            Please create all ${templateCount} emails now, formatted clearly with "Email #1", "Email #2", etc., including the subject lines and signature blocks.`
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
            content: `Please create ${templateCount} natural-sounding marketing emails for ${companyName}'s catering business. 
            
            CRITICAL REMINDERS:
            1. EVERY email MUST start with "Hi!" (not Hello, Greetings, etc.)
            2. The FIRST email MUST follow the exact template format specified
            3. DO NOT mention specific venues like "Leslie-Alford-Mims House" or any venue names
            4. Keep each email concise (around 150 words or less)
            5. Use only specific food/dishes mentioned in the company information
            6. Include EXACTLY 2 emails with holiday/seasonal references in BOTH subject line AND email content
            7. Every email must have a unique subject line
            8. Each email MUST include one of these three call-to-action types:
               - Schedule a 15-minute phone call
               - A specific question to encourage reply
               - Book a tasting via calendar link
            9. Include a simple signature block at the end of each email
            10. Use warm, conversational language that sounds like a real person wrote it
            
            Please create all ${templateCount} emails now, formatted clearly with "Email #1", "Email #2", etc., including the subject lines and signature blocks.`
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
  // Look for the Email # pattern to split the output
  const emailPattern = /Email #\d+/gi;
  
  // Find all occurrences of "Email #X"
  const matches = gptOutput.match(emailPattern) || [];
  
  if (!matches.length) {
    // If no pattern found, return the whole content as one email
    return [gptOutput.trim()];
  }
  
  // Split content at each Email # marker
  const parts = [];
  let lastIndex = 0;
  
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const currentIndex = gptOutput.indexOf(match, lastIndex);
    
    // If not the first match, add the content from lastIndex to currentIndex
    if (i > 0) {
      const content = gptOutput.substring(lastIndex, currentIndex).trim();
      if (content.length > 10) { // Only add non-empty content
        parts.push(content);
      }
    }
    
    // Update lastIndex for next iteration
    lastIndex = currentIndex + match.length;
    
    // For the last match, add everything after it
    if (i === matches.length - 1) {
      const content = gptOutput.substring(lastIndex).trim();
      if (content.length > 10) {
        parts.push(content);
      }
    }
  }
  
  // If we couldn't split properly, fall back to simpler approach
  if (parts.length === 0) {
    console.warn("Email splitting failed with pattern approach, falling back to simpler method");
    const splitted = gptOutput.split(/Email #\d+/i).map((part) => part.trim());
    return splitted.filter((p) => p.length > 10);
  }
  
  return parts;
}
