"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCaterly } from "../app/context/caterly-context"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { Mail } from "lucide-react"

// Define type for drip emails
interface DripEmail {
  id?: string;
  subject: string;
  content: string;
  approved: boolean;
  category: string;
  week?: number;
  delay: string | number; // Allow both string and number delays
  campaign_id?: string;
  edited_content?: string;
  sent?: boolean;
  scheduled_date?: string;
}

export default function CampaignLaunchPage() {
  const router = useRouter()
  const { campaign, enrichedLeads, profile } = useCaterly()
  const [emailContent, setEmailContent] = useState("")
  const [isLaunched, setIsLaunched] = useState(false)
  const [isGeneratingEmails, setIsGeneratingEmails] = useState(false)
  const [stats, setStats] = useState({
    sent: 0,
    opened: 0,
    replied: 0,
    clicked: 0,
  })
  const [activities, setActivities] = useState<any[]>([])
  
  // State for handling multiple categories
  const [categories, setCategories] = useState<string[]>([])
  const [activeCategory, setActiveCategory] = useState<string>("")
  
  // State for drip campaign sequence with category awareness
  const [dripEmailsByCategory, setDripEmailsByCategory] = useState<Record<string, DripEmail[]>>({})
  const [activeDripEmail, setActiveDripEmail] = useState<number | string>(1)
  const [allEmailsApproved, setAllEmailsApproved] = useState<boolean>(false)
  const [currentCategoryApproved, setCurrentCategoryApproved] = useState<boolean>(false)
  const [isLoadingEmails, setIsLoadingEmails] = useState<boolean>(true)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [generationError, setGenerationError] = useState<string>("")

  // Show status message function (replaces toast)
  const showStatus = (message: string, isError = false) => {
    setStatusMessage(message);
    console.log(isError ? `Error: ${message}` : message);
    
    // Auto clear after 3 seconds
    setTimeout(() => {
      setStatusMessage(null);
    }, 3000);
  };

  // Organize leads by category on initial page load - only set up state without API calls
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const initializing = searchParams.get('initializing') === 'true';
    const leadIds = searchParams.get('leads')?.split(',').filter(Boolean) || [];
    const autoGenerate = searchParams.get('autoGenerate') === 'true';
    
    // Get categories from URL if provided
    const categoriesFromURL = searchParams.get('categories')?.split(',').filter(Boolean) || [];
    
    console.log("Campaign launch parameters:", { 
      initializing, 
      leadCount: leadIds.length, 
      autoGenerate,
      categoriesFromURL 
    });
    
    if (!campaign) {
      console.log("No campaign found in context, redirecting to enriched leads page");
      router.push('/leads/enriched');
      return;
    }

    console.log("Initializing campaign launch page...");
    setIsLoadingEmails(true);
    
    // Get categories either from leads or from predefined list if no leads
    let uniqueCategories: string[] = [];
    
    // First try to use categories from URL if available
    if (categoriesFromURL.length > 0) {
      uniqueCategories = categoriesFromURL;
      console.log(`Using categories from URL: ${uniqueCategories.join(', ')}`);
    }
    // Otherwise, extract from leads if available
    else if (enrichedLeads && enrichedLeads.length > 0) {
      uniqueCategories = Array.from(new Set(
        enrichedLeads
          .map(lead => lead.category?.toLowerCase() || '')
          .filter(category => category !== '')
      ));
      
      console.log(`Found ${uniqueCategories.length} unique categories from ${enrichedLeads.length} leads: ${uniqueCategories.join(', ')}`);
    }
    
    // If no leads or no categories from leads, use the campaign category or a default
    if (uniqueCategories.length === 0) {
      if (campaign && campaign.eventType) {
        uniqueCategories = [campaign.eventType.toLowerCase()];
        console.log(`No categories from leads, using campaign event type: ${campaign.eventType}`);
      } else {
        // Last resort fallback to wedding only
        uniqueCategories = ['wedding'];
        console.log('No categories from leads or campaign, defaulting to wedding category only');
      }
    }
    
    console.log("Setting up categories:", uniqueCategories);
    setCategories(uniqueCategories);
    
    // Set active category to first one
    if (uniqueCategories.length > 0 && !activeCategory) {
      setActiveCategory(uniqueCategories[0]);
    }
    
    // Check if we already have pre-generated templates from the enriched leads page
    // If not, initialize empty categories but don't auto-generate campaign emails
    if (Object.keys(dripEmailsByCategory).length === 0) {
      console.log("No existing campaign emails found, initializing empty placeholder");
      const initialEmailsByCategory: Record<string, DripEmail[]> = {};
      
      uniqueCategories.forEach(category => {
        initialEmailsByCategory[category] = Array(8).fill(null).map((_, i) => ({
          id: `${category}-${i + 1}`,
          subject: `Email #${i + 1} for ${category}`,
          content: "Campaign emails will appear here. If they don't load automatically, you can create them using the controls below.",
          delay: getDelayForEmail(i),
          approved: false,
          category: category,
          week: i + 1
        }));
      });
      
      setDripEmailsByCategory(initialEmailsByCategory);
    }
    
    // If autoGenerate is true, automatically generate emails
    if (autoGenerate && enrichedLeads && enrichedLeads.length > 0 && profile) {
      // Start generating emails automatically
      setTimeout(() => {
        console.log("Auto-generating emails based on URL parameter");
        handleLaunchCampaign();
      }, 1000); // Slight delay to ensure UI is ready
    }
    
    setIsLoadingEmails(false);
    
    // We'll centralize campaign email generation to a single process.
    // Do not generate campaign emails here - we'll let the activeCategory useEffect handle it.
  }, [campaign, enrichedLeads, profile, router]);

  // Auto-load templates when category changes - this will be our single source for template generation
  useEffect(() => {
    if (activeCategory && profile && !isGeneratingEmails) {
      const emails = dripEmailsByCategory[activeCategory] || [];
      
      // Don't auto-generate emails - wait for Launch Campaign button
      console.log(`Found ${emails.length} campaign emails for ${activeCategory}`);
    }
  }, [activeCategory, profile, dripEmailsByCategory, isGeneratingEmails]);

  // Helper function to get the delay string for each email
  const getDelayForEmail = (index: number): string => {
    const delays = [
      "Day 1 (Initial Contact)",
      "Day 5",
      "Week 2",
      "Week 3",
      "Week 5",
      "Week 7", 
      "Week 9",
      "Week 12"
    ];
    return delays[index] || `Week ${index + 1}`;
  };

  // Generate emails for a specific category
  const generateCampaignEmails = async (category: string) => {
    if (!profile || isGeneratingEmails) {
      console.log(`Cannot generate campaign emails: ${!profile ? 'No profile available' : 'Already generating emails'}`);
      return;
    }
    
    setIsGeneratingEmails(true);
    setGenerationError('');
    
    console.log(`Generating campaign emails for category: ${category}`);
    console.log('Using profile:', JSON.stringify(profile).substring(0, 100) + '...');
    
    // Format the profile data to match what the API expects
    const formattedProfile = {
      companyName: (profile as any).business_name || "Your Catering Company",
      description: (profile as any).description || (profile as any).user_input_data?.description || "Premium catering services",
      menuLink: (profile as any).website_url || "",
      managerContact: (profile as any).user_input_data?.managerContact || (profile as any).contact_phone || "",
      orderingLink: (profile as any).website_url || "",
      focus: (profile as any).business_type || "catering",
      idealClients: category || "wedding",
      specialties: [],
      photos: []
    };
    
    try {
      let attempts = 0;
      const maxAttempts = 3;
      let success = false;
      
      while (attempts < maxAttempts && !success) {
        attempts++;
        console.log(`Campaign email generation attempt ${attempts} for ${category}`);
        
        try {
          // Force clear any existing emails to ensure fresh generation
          setDripEmailsByCategory(prev => {
            const updated = {...prev};
            if (updated[category]) {
              updated[category] = updated[category].map(email => ({
                ...email,
                content: "Generating new campaign email...",
              }));
            }
            return updated;
          });
          
          const response = await fetch('/api/outreach/start', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              profile: formattedProfile,
              category,
              useStreaming: true,
              currentDate: new Date().toISOString(),
              templateCount: 8,
              weekSpan: 12,
              campaignId: campaign?.name || undefined,
              forceRefresh: true, // Always force refresh - no caching
              leads: enrichedLeads, // Ensure leads are always passed
              hasLeads: !!enrichedLeads?.length // Explicitly set hasLeads flag
            }),
          });
          
          if (response.status === 429) {
            // Rate limited, wait and retry
            const retryAfter = response.headers.get('retry-after') || '2';
            const waitTime = parseInt(retryAfter, 10) * 1000 || 2000;
            console.log(`Rate limited. Waiting ${waitTime}ms before retry...`);
            setGenerationError(`Rate limited. Waiting ${Math.ceil(waitTime/1000)}s before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error ${response.status}`);
          }
          
          const data = await response.json();
          
          console.log("API response data:", data);
          console.log("API response structure:", JSON.stringify(Object.keys(data)));
          
          // Extract emails from response data (handle different response formats)
          let emailArray: string[] = [];
          
          if (data.data?.emailTemplates?.[category]) {
            // Format from /api/outreach/start
            emailArray = data.data.emailTemplates[category];
            console.log(`Found ${emailArray.length} emails in data.data.emailTemplates[${category}]`);
          } else if (data.templates?.templates) {
            // Alternative format
            emailArray = data.templates.templates;
            console.log(`Found ${emailArray.length} emails in data.templates.templates`);
          } else if (Array.isArray(data.templates)) {
            // Direct array format (from test page)
            emailArray = data.templates;
            console.log(`Found ${emailArray.length} emails in data.templates array`);
          } else {
            console.error("Unexpected response format:", data);
            throw new Error('Emails not found in API response');
          }
          
          if (!emailArray || emailArray.length === 0) {
            console.error("Empty email array after parsing");
            throw new Error('No emails returned from API');
          }
          
          console.log(`Email array sample: "${emailArray[0].substring(0, 100)}..."`);
          
          const formattedEmails = emailArray.map((email: any, index: number) => {
            const campaignEmail: DripEmail = {
              id: `${category}-${index + 1}`,
              subject: extractSubjectLine(email) || `Email #${index + 1} for ${category}`,
              content: email,
              delay: getDelayForEmail(index),
              approved: false,
              category: category,
              week: index + 1
            };
            console.log(`Processed email ${index + 1}:`, {
              id: campaignEmail.id,
              subject: campaignEmail.subject,
              contentLength: campaignEmail.content?.length || 0
            });
            return campaignEmail;
          });
          
          console.log(`Successfully formatted ${formattedEmails.length} campaign emails for ${category}`);
          
          setDripEmailsByCategory(prev => {
            console.log(`Updating state with ${formattedEmails.length} campaign emails for ${category}`);
            return {
              ...prev,
              [category]: formattedEmails
            };
          });
          
          success = true;
        } catch (error: any) {
          console.error(`Attempt ${attempts} failed:`, error);
          setGenerationError(error.message || 'Unknown error occurred');
          
          if (attempts >= maxAttempts) {
            console.error(`Failed to generate campaign emails after ${maxAttempts} attempts`);
            showStatus(`Failed to generate campaign emails for ${category} after ${maxAttempts} attempts. Please try again.`, true);
          }
          
          // Wait briefly before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error: any) {
      console.error("Error generating campaign emails:", error);
      setGenerationError(error.message || 'Unknown error occurred');
      showStatus(`Error generating campaign emails: ${error.message}`, true);
    } finally {
      setIsGeneratingEmails(false);
    }
  };

  // Extract subject line from email content with improved regex
  const extractSubjectLine = (content: string): string | null => {
    if (!content) return null;
    
    // Look for Subject: at the beginning of a line with case-insensitivity
    const match = content.match(/^[^\S\n]*Subject:\s*(.*)$/mi);
    
    if (match && match[1]) {
      // Clean up the subject line
      return match[1].trim();
    }
    
    // Alternative: look for **Subject: pattern (sometimes used in markdown)
    const altMatch = content.match(/\*\*Subject:\s*([^*\n]+)/i);
    if (altMatch && altMatch[1]) {
      return altMatch[1].trim();
    }
    
    // Try to find a line that starts with "Subject:" - common in our format
    const subjectLineMatch = content.split('\n').find(line => 
      line.trim().toLowerCase().startsWith('subject:')
    );
    
    if (subjectLineMatch) {
      return subjectLineMatch.replace(/^subject:\s*/i, '').trim();
    }
    
    // Last resort: try to find anything that looks like a subject line
    // but avoid capturing "Hi!" which starts every email
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && 
          trimmedLine.length > 5 && 
          !trimmedLine.toLowerCase().includes('email #') &&
          !trimmedLine.toLowerCase().startsWith('hi!') &&
          !trimmedLine.toLowerCase().startsWith('hi,')) {
        return trimmedLine;
      }
    }
    
    return null;
  };

  // Get active category's emails with better error handling
  const getActiveCategoryEmails = (): DripEmail[] => {
    if (!activeCategory) return [];
    const emails = dripEmailsByCategory[activeCategory];
    if (!emails) {
      console.log(`No emails found for category: ${activeCategory}`);
      return [];
    }
    console.log(`Retrieved ${emails.length} emails for category: ${activeCategory}`);
    return emails;
  };

  // Check if all emails in active category are approved
  useEffect(() => {
    const activeCategoryEmails = getActiveCategoryEmails();
    const isAllApproved = activeCategoryEmails.length > 0 && 
                         activeCategoryEmails.every(email => email.approved);
    setCurrentCategoryApproved(isAllApproved);
    
    // Check if all categories have approved emails
    const allCatsApproved = Object.keys(dripEmailsByCategory).length > 0 &&
                          Object.keys(dripEmailsByCategory).every(cat => 
                            dripEmailsByCategory[cat].every(email => email.approved)
                          );
    setAllEmailsApproved(allCatsApproved);
  }, [dripEmailsByCategory, activeCategory]);

  // Handle changing the active email
  const handleDripEmailContentChange = (content: string) => {
    // Update the active drip email content for the current category
    setDripEmailsByCategory(prev => {
      const updatedEmails = [...prev[activeCategory]];
      const emailIndex = updatedEmails.findIndex(email => String(email.id) === String(activeDripEmail));
      
      if (emailIndex !== -1) {
        updatedEmails[emailIndex] = {
          ...updatedEmails[emailIndex],
          content
        };
      }
      
      return {
        ...prev,
        [activeCategory]: updatedEmails
      };
    });
  };

  // Fix type errors with id property handling
  const handleDripEmailEdit = (id: string | number | undefined) => {
    if (id) {
      setActiveDripEmail(id);
    }
  };

  // Handle approving an email with proper type handling
  const handleDripEmailApproval = (id: string | number | undefined) => {
    if (!id) return;

    // Mark the drip email as approved for the current category
    setDripEmailsByCategory(prev => {
      const updatedEmails = [...prev[activeCategory]];
      const emailIndex = updatedEmails.findIndex(email => String(email.id) === String(id));
      
      if (emailIndex !== -1) {
        updatedEmails[emailIndex] = {
          ...updatedEmails[emailIndex],
          approved: true
        };
      }
      
      return {
        ...prev,
        [activeCategory]: updatedEmails
      };
    });
  };

  // Handle changing the active category with proper null checks
  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);
    console.log(`Changed active category to: ${category}`);
    
    // Set active email to first one in this category with proper null checks
    const emails = dripEmailsByCategory[category] || [];
    
    if (emails.length > 0) {
      console.log(`Category ${category} has ${emails.length} emails`);
      const firstUnapprovedIndex = emails.findIndex(email => !email.approved);
      
      if (firstUnapprovedIndex !== -1 && emails[firstUnapprovedIndex]?.id) {
        console.log(`Setting active email to first unapproved: ${emails[firstUnapprovedIndex].id}`);
        setActiveDripEmail(emails[firstUnapprovedIndex].id as string | number);
      } else if (emails[0]?.id) {
        console.log(`Setting active email to first email: ${emails[0].id}`);
        setActiveDripEmail(emails[0].id as string | number);
      } else {
        console.log(`No valid email IDs found, defaulting to 1`);
        setActiveDripEmail(1);
      }
    }
    // Don't trigger generation here - let the activeCategory useEffect handle it
  };

  // Handle launching the campaign
  const handleLaunchCampaign = async () => {
    try {
      // Check if we have any approved emails
      const hasApprovedEmails = Object.keys(dripEmailsByCategory).some(category => 
        dripEmailsByCategory[category].some(email => email.approved)
      );
      
      // If all emails are approved, launch the campaign
      if (allEmailsApproved) {
        showStatus("Launching approved campaign emails...");
        
        // Collect all approved emails for each category
        const approvedEmailsByCategory: Record<string, string[]> = {};
        
        Object.keys(dripEmailsByCategory).forEach(category => {
          const approvedEmails = dripEmailsByCategory[category]
            .filter(email => email.approved)
            .map(email => email.content);
            
          if (approvedEmails.length > 0) {
            approvedEmailsByCategory[category] = approvedEmails;
          }
        });
        
        // Only proceed if we have at least one category with approved emails
        if (Object.keys(approvedEmailsByCategory).length === 0) {
          console.error("No approved emails to launch");
          showStatus("No approved emails to launch", true);
          return;
        }
        
        // Call the API to launch the campaign
        const response = await fetch('/api/outreach/start/launch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-protection': '1',
          },
          credentials: 'include', // Include cookies for authentication
          body: JSON.stringify({
            approvedEmails: approvedEmailsByCategory,
            leads: enrichedLeads
          })
        });
        
        const result = await response.json();
        
        if (!result.success) {
          console.error("Failed to launch campaign:", result.error);
          showStatus("Failed to launch campaign", true);
          return;
        }
        
        console.log("Campaign launched successfully:", result.data);
        showStatus("Campaign launched successfully!");
        
        // Update UI state to show the campaign is running
        setIsLaunched(true);
        setStats({
          sent: enrichedLeads?.length || 0,
          opened: 0,
          replied: 0,
          clicked: 0,
        });
        return;
      }
      
      // Otherwise, just generate the emails first
      setIsGeneratingEmails(true);
      showStatus("Generating campaign emails...");
      
      // Only generate emails for categories that have leads
      const categoriesToGenerate = [];
      
      // If we have leads, only include categories that actually have leads
      if (enrichedLeads && enrichedLeads.length > 0) {
        // Get unique categories from leads
        const leadCategories = Array.from(new Set(
          enrichedLeads
            .map(lead => lead.category?.toLowerCase() || '')
            .filter(category => category !== '')
        ));
        
        if (leadCategories.length > 0) {
          categoriesToGenerate.push(...leadCategories);
          console.log(`Will only generate emails for categories with leads: ${leadCategories.join(', ')}`);
        } else {
          // Fallback to primary category if no categories found in leads
          categoriesToGenerate.push('wedding');
          console.log('No categories found in leads, defaulting to wedding category');
        }
      } else if (categories.length > 0) {
        // Use existing categories if available
        categoriesToGenerate.push(...categories);
        console.log(`Using existing categories: ${categories.join(', ')}`);
      } else {
        // Last resort fallback
        categoriesToGenerate.push('wedding');
        console.log('No leads or categories found, defaulting to wedding category');
      }
      
      // Ensure we have a profile
      if (!profile) {
        console.error("No profile available to generate emails");
        showStatus("No profile available to generate emails", true);
        setIsGeneratingEmails(false);
        return;
      }
      
      // Format the profile data to match what the API expects
      const formattedProfile = {
        companyName: (profile as any).business_name || "Your Catering Company",
        description: (profile as any).description || (profile as any).user_input_data?.description || "Premium catering services",
        menuLink: (profile as any).website_url || "",
        managerContact: (profile as any).user_input_data?.managerContact || (profile as any).contact_phone || "",
        orderingLink: (profile as any).website_url || "",
        focus: (profile as any).business_type || "catering",
        idealClients: categoriesToGenerate[0] || "wedding",
        specialties: [],
        photos: []
      };
      
      // Generate emails for each category
      for (const category of categoriesToGenerate) {
        try {
          console.log(`Generating campaign emails for ${category}`);
          
          const response = await fetch('/api/outreach/start', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              profile: formattedProfile,
              category,
              useStreaming: true,
              currentDate: new Date().toISOString(),
              templateCount: 8,
              weekSpan: 12,
              campaignId: campaign?.name || undefined,
              leads: enrichedLeads,
              hasLeads: !!enrichedLeads?.length
            }),
          });
          
          if (!response.ok) {
            throw new Error(`Failed to generate emails for ${category}: ${response.statusText}`);
          }
          
          const data = await response.json();
          
          if (!data.success) {
            throw new Error(data.error || `Failed to generate emails for ${category}`);
          }
          
          const emailArray = data.data.emailTemplates[category];
          
          if (!emailArray || emailArray.length === 0) {
            throw new Error(`No emails returned for ${category}`);
          }
          
          // Update the emails in state WITHOUT auto-approval
          const formattedEmails = emailArray.map((email: string, index: number) => ({
            id: `${category}-${index + 1}`,
            subject: extractSubjectLine(email) || `Email #${index + 1} for ${category}`,
            content: email,
            delay: getDelayForEmail(index),
            approved: false, // Keep this as false so human needs to approve
            category: category,
            week: index + 1
          }));
          
          setDripEmailsByCategory(prev => ({
            ...prev,
            [category]: formattedEmails
          }));
          
          console.log(`Successfully generated ${formattedEmails.length} emails for ${category}`);
        } catch (error: any) {
          console.error(`Error generating emails for ${category}:`, error);
          showStatus(`Error generating emails for ${category}: ${error.message}`, true);
        }
      }
      
      setIsGeneratingEmails(false);
      showStatus("Campaign emails generated successfully! Please review and approve each email.");
    } catch (error) {
      console.error("Error in campaign process:", error);
      showStatus("Error in campaign process", true);
      setIsGeneratingEmails(false);
    }
  };

  // Improved function to get active email content with better error handling and debugging
  const getActiveEmailContent = (): string => {
    if (!activeCategory) {
      console.log('No active category selected');
      return "No category selected. Please select a category.";
    }
    
    const activeEmails = dripEmailsByCategory[activeCategory];
    if (!activeEmails || activeEmails.length === 0) {
      console.log(`No emails found for category: ${activeCategory} when fetching content`);
      return "No email content available for this category.";
    }
    
    console.log(`Finding email with id ${activeDripEmail} among ${activeEmails.length} emails`);
    console.log(`Email IDs available: ${activeEmails.map(e => e.id).join(', ')}`);
    
    const activeEmail = activeEmails.find(
      email => String(email.id) === String(activeDripEmail)
    );
    
    if (!activeEmail) {
      console.log(`Active email ${activeDripEmail} not found in category ${activeCategory}`);
      // Fallback to first email if active email not found
      if (activeEmails.length > 0) {
        const firstEmail = activeEmails[0];
        console.log(`Falling back to first email: ${firstEmail.id}`);
        setTimeout(() => setActiveDripEmail(firstEmail.id as string | number), 0);
        return firstEmail.content || "No content available for this email.";
      }
      return "Email content not found. Please select another email.";
    }
    
    console.log(`Found active email with id ${activeEmail.id}, content length: ${activeEmail.content?.length || 0}`);
    return activeEmail.content || "No content available for this email.";
  };

  return (
    <div className="container mx-auto py-8 max-w-screen-xl">
      {/* Loading Overlay for Template Generation */}
      {isGeneratingEmails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">Generating Email Campaign</h3>
            <div className="space-y-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-purple-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${Math.min(100, activeCategory ? 
                    ((dripEmailsByCategory[activeCategory]?.filter(e => e && e.content && !e.content.includes('Campaign emails will appear here')).length || 0) / 8) * 100
                    : 0)}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-500">
                Generating emails for {activeCategory} category
              </p>
              {generationError && (
                <div className="text-sm text-red-500 bg-red-50 p-2 rounded">
                  {generationError}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status Message */}
      {statusMessage && (
        <div className="fixed top-4 right-4 z-50 max-w-md">
          <Alert variant={generationError ? "destructive" : "default"} className="animate-in slide-in-from-top">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {statusMessage}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Page Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2 text-center gradient-text">
          {isLaunched ? "Campaign Dashboard" : "Launch Your Campaign"}
        </h1>
        <p className="text-center text-foreground/80 mb-6">
          {isLaunched ? "Track your campaign performance in real-time" : "Review and approve your outreach strategy"}
        </p>
      </div>

      {/* Background effects */}
      <div className="absolute -top-20 left-0 w-96 h-96 bg-purple-500/5 rounded-full filter blur-3xl animate-pulse-slow"></div>
      <div className="absolute bottom-20 -right-20 w-96 h-96 bg-blue-500/5 rounded-full filter blur-3xl animate-pulse-slow animation-delay-700"></div>

      {/* Show a message when no leads are selected */}
      {(!enrichedLeads || enrichedLeads.length === 0) && !isLaunched && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-blue-800 mb-2">No Leads Selected</h2>
          <p className="mb-4">
            You haven't selected any leads yet, but you can still generate and review email templates
            for different venue categories. This allows you to prepare your campaign templates 
            before adding leads.
          </p>
          
          {!categories.length ? (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <p className="text-muted-foreground">
                Click "Launch Campaign" to start generating your email campaign
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* Category Tabs */}
      {categories.length > 0 && !isLaunched && (
        <div className="flex justify-center mb-6">
          <Tabs 
            value={activeCategory} 
            onValueChange={handleCategoryChange} 
            className="w-full max-w-lg"
          >
            <TabsList className="grid" style={{ gridTemplateColumns: `repeat(${categories.length}, 1fr)` }}>
              {categories.map(category => (
                <TabsTrigger key={category} value={category} className="capitalize">
                  {isGeneratingEmails && activeCategory === category ? (
                    <div className="flex items-center">
                      <div className="w-3 h-3 border-t-2 border-current border-r-2 rounded-full animate-spin mr-2"></div>
                      {category}
                    </div>
                  ) : (
                    <>
                      {category}
                      {dripEmailsByCategory[category]?.every(email => email.approved) && (
                        <span className="ml-2 text-green-500">✓</span>
                      )}
                    </>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}

      {/* SIMPLIFIED MAIN GRID LAYOUT - This is the key fix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Email Preview Card */}
        <Card className="h-full shadow-md border border-gray-200/40 bg-white/95 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl flex items-center">
              <Mail className="mr-2 h-5 w-5 text-purple-500" />
              <span>Email Template</span>
            </CardTitle>
            <CardDescription>Email for {activeCategory}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingEmails ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-muted-foreground">Loading email templates...</p>
                <p className="text-xs text-muted-foreground mt-2">Templates should appear automatically if they were pre-generated.</p>
              </div>
            ) : !isLaunched ? (
              <>
                {/* No Templates Message */}
                {(!dripEmailsByCategory[activeCategory] || 
                  dripEmailsByCategory[activeCategory].length === 0 || 
                  dripEmailsByCategory[activeCategory][0]?.content?.includes("Campaign emails will appear here")) ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <p className="text-muted-foreground">
                      Generating campaign emails... Please wait.
                    </p>
                  </div>
                ) : (
                  <Textarea
                    value={getActiveEmailContent()}
                    onChange={(e) => handleDripEmailContentChange(e.target.value)}
                    className="min-h-[400px] font-mono text-sm bg-white text-gray-800 border-gray-200 focus:border-purple-500/50"
                  />
                )}
              </>
            ) : (
              <div className="border border-border/20 rounded-md p-6 bg-white/80 backdrop-blur-sm shadow-sm">
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold shadow-sm">
                      {profile?.managerContact?.charAt(0) || "C"}
                    </div>
                    <div>
                      <div className="font-semibold">Your Catering Company</div>
                      <div className="text-sm text-gray-500">to {enrichedLeads[0]?.name}</div>
                    </div>
                  </div>

                  <div className="whitespace-pre-line text-sm text-gray-800">{emailContent}</div>

                  <div className="pt-4 grid grid-cols-3 gap-2">
                    {profile?.photos?.map((photo, index) => (
                      <div key={index} className="aspect-video relative rounded-md overflow-hidden shadow-sm">
                        <Image
                          src={photo || "/placeholder.svg"}
                          alt={`Catering photo ${index + 1}`}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
          {!isLaunched && (
            <CardFooter className="border-t border-purple-200/20 bg-purple-50/5 p-6">
              {!dripEmailsByCategory[activeCategory]?.find(email => email.id === activeDripEmail)?.approved ? (
                <Button 
                  onClick={() => handleDripEmailApproval(activeDripEmail)} 
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-ai-glow transition-all duration-300"
                  size="lg"
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="w-5 h-5 mr-2 text-white" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Approve Email #{activeDripEmail} for {activeCategory} Category
                </Button>
              ) : (
                <Button 
                  disabled
                  className="w-full bg-green-100 text-green-800 cursor-not-allowed"
                  size="lg"
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="w-5 h-5 mr-2" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Email #{activeDripEmail} for {activeCategory} Approved
                </Button>
              )}
            </CardFooter>
          )}
        </Card>

        {/* Right Column - Drip Campaign/Dashboard Card */}
        <Card className="h-full shadow-md border border-gray-200/40 bg-white/95 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl flex items-center">
              <Mail className="mr-2 h-5 w-5 text-purple-500" />
              <span>{isLaunched ? "Campaign Performance" : "Email Sequence"}</span>
            </CardTitle>
            <CardDescription>12-Week Drip Campaign - {activeCategory}</CardDescription>
          </CardHeader>
          <CardContent>
            {!isLaunched ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4 flex items-center text-card-foreground">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Email Sequence for {activeCategory}
                  </h3>
                  
                  {isLoadingEmails ? (
                    <div className="text-center py-12">
                      <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-muted-foreground">Generating personalized email sequence...</p>
                    </div>
                  ) : dripEmailsByCategory[activeCategory]?.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">
                        Generating campaign emails... Please wait.
                      </p>
                    </div>
                  ) : (
                  <div className="space-y-2">
                    <Accordion type="single" collapsible className="w-full">
                        {getActiveCategoryEmails().filter(email => email && !email.content?.includes("Campaign emails will appear here")).map((email, index) => (
                        <AccordionItem key={index} value={`email-${email.id || index}`} className="border border-blue-200/10 rounded-lg mb-3 overflow-hidden">
                          <AccordionTrigger className="px-4 py-3 hover:bg-blue-50/5 text-left">
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center space-x-3">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${email.approved ? 'bg-green-500 text-white' : 'bg-blue-100 text-blue-800'}`}>
                                  {email.approved ? '✓' : (index + 1)}
                                </div>
                                <div className="text-sm font-medium flex flex-col">
                                  <span className="truncate max-w-[180px]">{email.subject || `Email #${index + 1} for ${activeCategory}`}</span>
                                  <span className="text-xs text-muted-foreground">{email.delay || `Week ${index + 1}`}</span>
                                </div>
                              </div>
                              <Badge variant="outline" className="text-xs bg-blue-50/10 text-blue-600">
                                {index === 0 ? "Initial Contact" : index < 3 ? "Early Follow-up" : "Nurture"}
                              </Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 py-3 bg-blue-50/5 border-t border-blue-200/10">
                            <div className="flex flex-col space-y-3">
                              <div className="font-medium text-sm mb-1">
                                Subject: {email.subject || `Email #${index + 1} for ${activeCategory}`}
                              </div>
                              <div className="text-sm whitespace-pre-line text-muted-foreground">
                                {!email.content ? 
                                  "No template content available." : 
                                  email.content.substring(0, 150) + "..."}
                              </div>
                              <div className="flex items-center space-x-2 pt-2">
                                <Button 
                                  onClick={() => email.id && handleDripEmailEdit(email.id)} 
                                  size="sm"
                                  variant="outline"
                                  className="text-xs"
                                  disabled={!email.id}
                                >
                                  {activeDripEmail === email.id ? 'Currently Editing' : 'Edit Email'}
                                </Button>
                                
                                {!email.approved ? (
                                  <Button 
                                    onClick={() => email.id && handleDripEmailApproval(email.id)} 
                                    size="sm"
                                    variant="default"
                                    className="text-xs bg-green-600 hover:bg-green-700"
                                    disabled={!email.id}
                                  >
                                    Approve
                                  </Button>
                                ) : (
                                  <Badge className="bg-green-500/20 text-green-700">
                                    Approved
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                  )}
                </div>

                <div className="pt-4">
                  <Card className="border border-purple-200/10 bg-card/30">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-blue-50 text-blue-700 p-2 rounded-full">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {currentCategoryApproved 
                            ? `All emails for ${activeCategory} category approved! Move to the next category or launch the campaign.`
                            : `You need to approve all ${getActiveCategoryEmails().length} emails for ${activeCategory} before moving to the next category.`}
                        </div>
                      </div>
                      <div className="mt-3 w-full bg-secondary/30 h-2 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                          style={{width: `${(getActiveCategoryEmails().filter(e => e.approved).length / getActiveCategoryEmails().length) * 100}%`}}
                        ></div>
                      </div>
                      <div className="mt-1 text-xs text-right text-muted-foreground">
                        {getActiveCategoryEmails().filter(e => e.approved).length}/{getActiveCategoryEmails().length} emails approved
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <Tabs defaultValue="stats" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="stats">Statistics</TabsTrigger>
                  <TabsTrigger value="activity">Recent Activity</TabsTrigger>
                </TabsList>

                <TabsContent value="stats" className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="border border-purple-500/10 bg-card/50">
                      <CardContent className="pt-6 p-4">
                        <div className="text-center">
                          <div className="text-4xl font-bold gradient-text">{stats.sent}</div>
                          <div className="text-sm text-muted-foreground">Emails Sent</div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border border-purple-500/10 bg-card/50">
                      <CardContent className="pt-6 p-4">
                        <div className="text-center">
                          <div className="text-4xl font-bold gradient-text">{stats.opened}</div>
                          <div className="text-sm text-muted-foreground">Emails Opened</div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border border-purple-500/10 bg-card/50">
                      <CardContent className="pt-6 p-4">
                        <div className="text-center">
                          <div className="text-4xl font-bold gradient-text">{stats.clicked}</div>
                          <div className="text-sm text-muted-foreground">Links Clicked</div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border border-purple-500/10 bg-card/50">
                      <CardContent className="pt-6 p-4">
                        <div className="text-center">
                          <div className="text-4xl font-bold gradient-text">{stats.replied}</div>
                          <div className="text-sm text-muted-foreground">Replies Received</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
          {!isLaunched && (
            <CardFooter className="border-t border-blue-200/20 bg-blue-50/5 p-6">
              {allEmailsApproved ? (
                <Button 
                  onClick={handleLaunchCampaign} 
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-ai-glow transition-all duration-300"
                  size="lg"
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="w-5 h-5 mr-2 text-white" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Launch Approved Campaign
                </Button>
              ) : (
                <div className="w-full text-center text-muted-foreground">
                  <p>Please approve all emails to launch the campaign</p>
                </div>
              )}
            </CardFooter>
          )}
        </Card>
      </div>

      {/* Remove generation controls */}
      {dripEmailsByCategory[activeCategory]?.every(email => 
        email.content?.includes("Campaign emails will appear here")) && (
        <div className="flex flex-col space-y-4 pt-4">
          {/* Leave error alert but remove generation button */}
          {generationError && (
            <Alert variant="destructive" className="mb-2">
              <AlertCircle className="h-4 w-4 mr-2" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{generationError}</AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  )
}

