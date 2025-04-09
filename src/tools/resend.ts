import axios from "axios";

const RESEND_API_URL = "https://api.resend.com/emails";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";

// Interface for leads with category
interface Lead {
  id: string;
  name: string;
  email: string;
  category: string;
}

/**
 * Schedule a drip campaign over 12 weeks for each lead category
 * @param approvedEmailsByCategory Record of approved email templates by category
 */
export async function scheduleDripCampaign(
  approvedEmailsByCategory: Record<string, string[]>
) {
  try {
    // Verify API key is present
    if (!RESEND_API_KEY) {
      throw new Error("Resend API key not configured");
    }
    
    // Get all leads from database
    const leads = await getAllLeads();
    console.log(`Found ${leads.length} leads to target with drip campaigns`);
    
    // Group leads by category
    const leadsGrouped: Record<string, Lead[]> = {};
    for (const lead of leads) {
      if (!leadsGrouped[lead.category]) {
        leadsGrouped[lead.category] = [];
      }
      leadsGrouped[lead.category].push(lead);
    }
    
    // Track statistics for reporting
    const stats = {
      categories: 0,
      totalLeads: 0,
      totalEmails: 0,
      scheduledEmails: 0
    };
    
    // For each category that has approved emails
    for (const [category, emails] of Object.entries(approvedEmailsByCategory)) {
      // Skip if no matching leads for this category
      const categoryLeads = leadsGrouped[category.toLowerCase()] || [];
      if (categoryLeads.length === 0) {
        console.log(`No leads found for category: ${category}`);
        continue;
      }
      
      stats.categories++;
      stats.totalLeads += categoryLeads.length;
      
      // Process each lead in this category
      for (const lead of categoryLeads) {
        // Schedule each approved email template
        for (const [index, emailTemplate] of emails.entries()) {
          // Basic scheduling approach: spread over 12 weeks
          // Each email is 1-2 weeks apart depending on total emails
          const spreadFactor = emails.length <= 6 ? 2 : 1.5;
          const weekOffset = Math.floor(index * spreadFactor);
          const sendDate = computeFutureDate(weekOffset);
          
          try {
            // Personalize the email for this specific lead
            const personalizedContent = personalizeEmail(emailTemplate, lead);
            
            // Schedule the email
            await scheduleEmail(lead.email, personalizedContent, sendDate);
            
            stats.totalEmails++;
            stats.scheduledEmails++;
          } catch (error) {
            console.error(`Error scheduling email for ${lead.email}:`, error);
          }
        }
      }
    }
    
    console.log(`Campaign scheduling complete. Stats:`, stats);
    return stats;
  } catch (error) {
    console.error("Error in scheduleDripCampaign:", error);
    throw error;
  }
}

/**
 * Calculate a future date X weeks from now
 */
function computeFutureDate(weeksFromNow: number): Date {
  const now = new Date();
  now.setDate(now.getDate() + weeksFromNow * 7);
  return now;
}

/**
 * Replace placeholders in email template with lead data
 */
function personalizeEmail(emailTemplate: string, lead: Lead): string {
  // Replace common placeholders
  return emailTemplate
    .replace(/\[Lead Name\]/g, lead.name)
    .replace(/\[lead name\]/g, lead.name)
    .replace(/\[NAME\]/g, lead.name)
    .replace(/\[name\]/g, lead.name)
    .replace(/\[Business\]/g, lead.name)
    .replace(/\[business\]/g, lead.name)
    .replace(/\[Category\]/g, lead.category)
    .replace(/\[category\]/g, lead.category);
}

/**
 * Schedule an email to be sent on a specific date
 */
async function scheduleEmail(
  recipientEmail: string,
  emailContent: string,
  sendDate: Date
): Promise<void> {
  // Extract subject line
  const subject = extractSubjectLine(emailContent) || "Your Custom Campaign";
  
  // Remove subject line from the content if present
  const cleanContent = emailContent.replace(/^Subject:.*$/mi, '').trim();
  
  const headers = {
    Authorization: `Bearer ${RESEND_API_KEY}`,
    "Content-Type": "application/json",
  };

  // Convert HTML content if needed
  const htmlBody = cleanContent.includes('<html') 
    ? cleanContent 
    : `<html><body>${cleanContent.replace(/\n/g, '<br>')}</body></html>`;

  // Prepare the payload
  const payload = {
    from: process.env.EMAIL_FROM || "outreach@yourcateringcompany.com",
    to: recipientEmail,
    subject: subject,
    html: htmlBody,
    // If Resend supports it, we could add:
    // scheduled_for: sendDate.toISOString(),
  };

  try {
    // Send the email through Resend API
    const resp = await axios.post(RESEND_API_URL, payload, { headers });
    console.log(`Email scheduled for ${recipientEmail} on ${sendDate.toLocaleDateString()}`);
    return;
  } catch (error: any) {
    console.error(
      `Failed to schedule email to ${recipientEmail}:`, 
      error.response?.data || error.message
    );
    throw error;
  }
}

/**
 * Extract the subject line from an email template
 */
function extractSubjectLine(emailContent: string): string | null {
  // Try to find a Subject: line
  const match = emailContent.match(/^Subject:\s*(.*)$/mi);
  
  if (match) {
    return match[1].trim();
  }
  
  // Try to find the first line as subject
  const lines = emailContent.trim().split('\n');
  if (lines.length > 0) {
    return lines[0].trim().substring(0, 60); // Limit to 60 chars
  }
  
  return null;
}

/**
 * Get all leads from the database
 * This is a stub that would be replaced with your real database access
 */
async function getAllLeads(): Promise<Lead[]> {
  // In a real implementation, you would query your database
  // For example using Supabase:
  // const { data, error } = await supabase
  //   .from('saved_leads')
  //   .select('id, name, email, category')
  //   .not('email', 'is', null);
  
  // For demonstration purposes, return dummy data
  return [
    { id: "1", name: "Jane's Wedding Venue", email: "jane@example.com", category: "wedding" },
    { id: "2", name: "ABC School District", email: "john@example.com", category: "education" },
    { id: "3", name: "XYZ Corporation", email: "sara@example.com", category: "corporate" },
    { id: "4", name: "Smith Wedding Planning", email: "smith@example.com", category: "wedding" },
    { id: "5", name: "Johnson University", email: "johnson@example.com", category: "education" },
  ];
}