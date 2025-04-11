/**
 * Outreach model definitions for the outreach agent
 */

export interface CateringProfile {
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

export interface OutreachOptions {
  useStreaming?: boolean;
  currentDate?: string;
  templateCount?: number;
  weekSpan?: number;
  forceRefresh?: boolean;
  leads?: any[];
}

export interface SeasonalContext {
  season: string;
  upcomingHolidays: string[];
}

export interface EmailCampaign {
  category: string;
  emailTemplates: string[];
  generatedAt: Date;
}

export interface EmailCampaignResult {
  success: boolean;
  emails: string[];
  error?: string;
} 