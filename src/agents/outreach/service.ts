import OpenAI from "openai";
import { CateringProfile, OutreachOptions, SeasonalContext, EmailCampaignResult } from "./model";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * OutreachService provides methods for generating email campaigns
 */
export class OutreachService {
  /**
   * Helper function to get current season and upcoming holidays
   */
  getSeasonalContext(date: Date = new Date()): SeasonalContext {
    const month = date.getMonth();
    
    // Determine season
    let season: string;
    if (month >= 2 && month <= 4) season = "spring";
    else if (month >= 5 && month <= 7) season = "summer";
    else if (month >= 8 && month <= 10) season = "fall";
    else season = "winter";

    // Determine upcoming holidays (comprehensive list)
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
   * Generate email campaign for a business category
   */
  async generateCampaign(
    category: string, 
    profile?: CateringProfile,
    options?: OutreachOptions
  ): Promise<EmailCampaignResult> {
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
      const { season, upcomingHolidays } = this.getSeasonalContext(currentDate);
      console.log(`Generating campaign for ${normalizedCategory} in ${season} with holidays: ${upcomingHolidays.join(', ')}`);
      
      // Generate emails with a batched approach
      const campaignEmails = await this.generateBatchedEmails(
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
      
      return {
        success: true,
        emails: campaignEmails
      };
    } catch (error) {
      console.error(`Error generating campaign emails for ${normalizedCategory}:`, error);
      return {
        success: false,
        emails: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Generate emails with a single API call for better performance
   */
  private async generateBatchedEmails(
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
    
    // Enhanced unified prompt for email generation
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

      FORMAT YOUR RESPONSE WITH:
      Subject Line 1: [SUBJECT LINE]

      [FULL EMAIL 1 CONTENT]

      Subject Line 2: [SUBJECT LINE]

      [FULL EMAIL 2 CONTENT]

      And so on for all ${templateCount} emails...
    `;
    
    // Make API call to generate the emails
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate a ${templateCount}-email sequence for marketing catering services to ${category} businesses.` }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      });
      
      const gptOutput = completion.choices[0]?.message?.content || "";
      
      if (!gptOutput) {
        throw new Error("No output generated from OpenAI");
      }
      
      return this.splitIntoEmails(gptOutput);
    } catch (error) {
      console.error("Error in OpenAI call:", error);
      throw error;
    }
  }

  /**
   * Split the OpenAI response into individual emails
   */
  private splitIntoEmails(gptOutput: string): string[] {
    // Regex to match email sections
    const emailPattern = /Subject Line \d+: (.*?)(?:\n\n)([\s\S]*?)(?=\n\nSubject Line \d+:|$)/g;
    const emails: string[] = [];
    
    let match;
    while ((match = emailPattern.exec(gptOutput)) !== null) {
      const subjectLine = match[1].trim();
      const emailBody = match[2].trim();
      
      // Format email with subject line and body
      const formattedEmail = `Subject: ${subjectLine}\n\n${emailBody}`;
      emails.push(formattedEmail);
    }
    
    return emails;
  }
} 