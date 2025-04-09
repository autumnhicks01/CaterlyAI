"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCaterly } from "../app/context/caterly-context"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

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
    if (!campaign) {
      router.push('/leads/enriched');
      return;
    }

    console.log("Initializing campaign launch page...");
    
    // Get categories either from leads or from predefined list if no leads
    let uniqueCategories: string[] = [];
    
    // If we have leads, extract categories from them
    if (enrichedLeads && enrichedLeads.length > 0) {
      uniqueCategories = Array.from(new Set(
        enrichedLeads.map(lead => lead.category.toLowerCase())
      )).filter(Boolean);
    }
    
    // If no leads or no categories from leads, use default categories
    if (uniqueCategories.length === 0) {
      uniqueCategories = ['wedding', 'corporate', 'education'];
    }
    
    console.log("Setting up categories:", uniqueCategories);
    setCategories(uniqueCategories);
    
    // Set active category to first one
    if (uniqueCategories.length > 0 && !activeCategory) {
      setActiveCategory(uniqueCategories[0]);
    }
    
    // Check if we already have pre-generated templates from the enriched leads page
    // If not, initialize empty categories but don't auto-generate templates
    if (Object.keys(dripEmailsByCategory).length === 0) {
      console.log("No existing templates found, initializing empty placeholder templates");
      const initialEmailsByCategory: Record<string, DripEmail[]> = {};
      
      uniqueCategories.forEach(category => {
        initialEmailsByCategory[category] = Array(8).fill(null).map((_, i) => ({
          id: `${category}-${i + 1}`,
          subject: `Email #${i + 1} for ${category}`,
          content: "Templates will appear here. If they don't load automatically, you can generate them using the controls below.",
          delay: getDelayForEmail(i),
          approved: false,
          category: category,
          week: i + 1
        }));
      });
      
      setDripEmailsByCategory(initialEmailsByCategory);
      setIsLoadingEmails(false);
    } else {
      console.log("Found existing templates, no need to initialize");
      setIsLoadingEmails(false);
    }
    
    // If we don't already have templates, generate templates for all categories at once
    if (uniqueCategories.length > 0 && profile && Object.keys(dripEmailsByCategory).length === 0) {
      console.log("Starting template generation for all categories");
      uniqueCategories.forEach(cat => {
        generateTemplatesForCategory(cat);
      });
    }
  }, [campaign, enrichedLeads, profile]); 
  
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

  // Generate templates for a specific category
  const generateTemplatesForCategory = async (category: string) => {
    if (!profile || isGeneratingEmails) return;
    
    setIsGeneratingEmails(true);
    setGenerationError('');
    
    console.log(`Generating templates for category: ${category}`);
    console.log('Using profile:', profile);
    
    try {
      let attempts = 0;
      const maxAttempts = 3;
      let success = false;
      
      while (attempts < maxAttempts && !success) {
        attempts++;
        console.log(`Template generation attempt ${attempts} for ${category}`);
        
        try {
          const response = await fetch('/api/outreach/start', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              profile,
              category,
              campaignId: campaign?.name || undefined
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
          
          // Extract templates from response data (handle different response formats)
          let templateArray: string[] = [];
          
          if (data.data?.emailTemplates?.[category]) {
            // Format from /api/outreach/start
            templateArray = data.data.emailTemplates[category];
            console.log(`Found ${templateArray.length} templates in data.data.emailTemplates[${category}]`);
          } else if (data.templates?.templates) {
            // Alternative format
            templateArray = data.templates.templates;
            console.log(`Found ${templateArray.length} templates in data.templates.templates`);
          } else if (Array.isArray(data.templates)) {
            // Direct array format (from test page)
            templateArray = data.templates;
            console.log(`Found ${templateArray.length} templates in data.templates array`);
          } else {
            console.error("Unexpected response format:", data);
            throw new Error('Templates not found in API response');
          }
          
          if (!templateArray || templateArray.length === 0) {
            console.error("Empty template array after parsing");
            throw new Error('No templates returned from API');
          }
          
          console.log(`Template array sample: "${templateArray[0].substring(0, 100)}..."`);
          
          const formattedTemplates = templateArray.map((template: any, index: number) => {
            const emailTemplate: DripEmail = {
              id: `${category}-${index + 1}`,
              subject: extractSubjectLine(template) || `Email #${index + 1} for ${category}`,
              content: template,
              delay: getDelayForEmail(index),
              approved: false,
              category: category,
              week: index + 1
            };
            console.log(`Processed template ${index + 1}:`, {
              id: emailTemplate.id,
              subject: emailTemplate.subject,
              contentLength: emailTemplate.content?.length || 0
            });
            return emailTemplate;
          });
          
          console.log(`Successfully formatted ${formattedTemplates.length} templates for ${category}`);
          
          setDripEmailsByCategory(prev => {
            console.log(`Updating state with ${formattedTemplates.length} templates for ${category}`);
            return {
              ...prev,
              [category]: formattedTemplates
            };
          });
          
          console.log(`Successfully generated ${formattedTemplates.length} templates for ${category}`);
          
          // Explicitly set active email to the first one
          if (formattedTemplates.length > 0 && formattedTemplates[0].id) {
            console.log(`Setting active email to first template: ${formattedTemplates[0].id}`);
            setActiveDripEmail(formattedTemplates[0].id);
          }
          
          success = true;
          setGenerationError('');
          
        } catch (error: any) {
          console.error(`Error generating templates (attempt ${attempts}):`, error);
          if (attempts >= maxAttempts) {
            setGenerationError(`Failed to generate templates: ${error.message}`);
          }
        }
      }
      
    } catch (error: any) {
      console.error('Outer error in template generation:', error);
      setGenerationError(`Error generating templates: ${error.message}`);
    } finally {
      setIsGeneratingEmails(false);
      setIsLoadingEmails(false);
    }
  };

  // Auto-load templates when category changes
  useEffect(() => {
    if (activeCategory && !isGeneratingEmails) {
      const emails = dripEmailsByCategory[activeCategory] || [];
      
      // Only generate templates if we don't have any real templates yet
      if (emails.length === 0 || emails.every(email => email.content?.includes("Templates will appear here"))) {
        console.log(`Auto-generating templates for ${activeCategory} because none were found`);
        generateTemplatesForCategory(activeCategory);
      } else {
        console.log(`Found ${emails.length} templates for ${activeCategory}, no need to generate`);
      }
    }
  }, [activeCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  // Extract subject line from email content
  const extractSubjectLine = (content: string): string | null => {
    const match = content.match(/^Subject:\s*(.*)$/mi);
    return match ? match[1].trim() : null;
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
    } else {
      console.log(`No emails found for category ${category}, prompting generation`);
      generateTemplatesForCategory(category);
    }
  };

  // Handle launching the campaign
  const handleLaunchCampaign = async () => {
    try {
      // Collect all approved emails for each category
      const approvedTemplatesByCategory: Record<string, string[]> = {};
      
      Object.keys(dripEmailsByCategory).forEach(category => {
        const approvedEmails = dripEmailsByCategory[category]
          .filter(email => email.approved)
          .map(email => email.content);
          
        if (approvedEmails.length > 0) {
          approvedTemplatesByCategory[category] = approvedEmails;
        }
      });
      
      // Only proceed if we have at least one category with approved templates
      if (Object.keys(approvedTemplatesByCategory).length === 0) {
        console.error("No approved templates to launch");
        showStatus("No approved templates to launch", true);
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
          approvedTemplates: approvedTemplatesByCategory,
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
    } catch (error) {
      console.error("Error launching campaign:", error);
      showStatus("Error launching campaign", true);
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
    <div className="container mx-auto px-4 py-12 relative">
      {/* Background effects */}
      <div className="absolute -top-20 left-0 w-96 h-96 bg-purple-500/5 rounded-full filter blur-3xl animate-pulse-slow"></div>
      <div className="absolute bottom-20 -right-20 w-96 h-96 bg-blue-500/5 rounded-full filter blur-3xl animate-pulse-slow animation-delay-700"></div>
      
      {/* Status message notification */}
      {statusMessage && (
        <div className={`fixed top-4 right-4 p-4 rounded-md shadow-md z-50 max-w-md animate-fade-in ${statusMessage.includes('Error') || statusMessage.includes('Failed') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
          {statusMessage}
        </div>
      )}
      
      <div className="relative">
        <h1 className="text-4xl font-bold mb-2 text-center gradient-text">
          {isLaunched ? "Campaign Dashboard" : "Launch Your Campaign"}
        </h1>
        <p className="text-center text-foreground/80 mb-8">
          {isLaunched ? "Track your campaign performance in real-time" : "Review and approve your outreach strategy"}
        </p>

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
                <Button 
                  onClick={() => {
                    setCategories(['wedding', 'corporate', 'education']);
                    setActiveCategory('wedding');
                    generateTemplatesForCategory('wedding');
                  }}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-3"
                  disabled={isGeneratingEmails}
                >
                  {isGeneratingEmails ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating Templates...
                    </>
                  ) : (
                    "Generate Templates for All Categories"
                  )}
                </Button>
              </div>
            ) : null}
          </div>
        )}

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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Left Column - Email Preview */}
          <div>
            <Card className="h-full border border-purple-500/10 bg-card shadow-xl overflow-hidden">
              <CardHeader className="border-b border-purple-200/20 bg-purple-50/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></span>
                    <CardTitle className="text-blue-900">
                      {!isLaunched && activeDripEmail === 1 ? `Initial Email Template - ${activeCategory}` : "Email Preview"}
                    </CardTitle>
                  </div>
                  {!isLaunched && (
                    <Badge variant="outline" className="border-purple-200/30 text-purple-400">
                      {dripEmailsByCategory[activeCategory]?.find(email => email.id === activeDripEmail)?.delay || ""}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {isLoadingEmails ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-muted-foreground">Loading email templates...</p>
                    <p className="text-xs text-muted-foreground mt-2">Templates should appear automatically if they were pre-generated.</p>
                  </div>
                ) : !isLaunched ? (
                  <>
                    {/* Debug Info */}
                    {process.env.NODE_ENV === 'development' && (
                      <div className="mb-4 text-xs text-gray-500 p-2 bg-gray-100 rounded">
                        <p>Debug: Active Category: {activeCategory}</p>
                        <p>Debug: Active Email ID: {String(activeDripEmail)}</p>
                        <p>Debug: Email Count: {dripEmailsByCategory[activeCategory]?.length || 0}</p>
                        <p>Debug: Has Content: {getActiveEmailContent() !== "No email content available for this category." ? "Yes" : "No"}</p>
                      </div>
                    )}

                    {/* No Templates Message */}
                    {(!dripEmailsByCategory[activeCategory] || 
                      dripEmailsByCategory[activeCategory].length === 0 || 
                      dripEmailsByCategory[activeCategory][0]?.content?.includes("Templates will appear here")) ? (
                      <div className="flex flex-col items-center justify-center py-12 space-y-4">
                        <p className="text-muted-foreground">No templates found for {activeCategory} category.</p>
                        <Button 
                          onClick={() => generateTemplatesForCategory(activeCategory)}
                          className="bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                          disabled={isGeneratingEmails}
                        >
                          {isGeneratingEmails ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                              Generating...
                            </>
                          ) : (
                            "Generate Templates"
                          )}
                        </Button>
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
          </div>

          {/* Right Column - Dashboard or Drip Campaign Schedule */}
          <div>
            <Card className="h-full border border-blue-500/10 bg-card shadow-xl overflow-hidden">
              <CardHeader className="border-b border-blue-200/20 bg-blue-50/5">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-purple-500 animate-pulse"></span>
                  <CardTitle className="text-blue-900">
                    {isLaunched ? "Campaign Performance" : `12-Week Drip Campaign - ${activeCategory}`} 
                    {isLaunched && <Badge className="ml-2 bg-green-500/20 text-green-300" variant="secondary">Live</Badge>}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6 overflow-auto max-h-[600px]">
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
                          <p className="text-muted-foreground">No email templates found for this category.</p>
                          <Button 
                            onClick={() => generateTemplatesForCategory(activeCategory)}
                            className="mt-4 bg-purple-600 hover:bg-purple-700 text-white"
                            disabled={isGeneratingEmails}
                          >
                            Generate Email Templates
                          </Button>
                        </div>
                      ) : (
                      <div className="space-y-2">
                        <Accordion type="single" collapsible className="w-full">
                            {getActiveCategoryEmails().filter(email => email && !email.content?.includes("Templates will appear here")).map((email, index) => (
                            <AccordionItem key={index} value={`email-${email.id || index}`} className="border border-blue-200/10 rounded-lg mb-3 overflow-hidden">
                              <AccordionTrigger className="px-4 py-3 hover:bg-blue-50/5 text-left">
                                <div className="flex items-center justify-between w-full">
                                  <div className="flex items-center space-x-3">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${email.approved ? 'bg-green-500 text-white' : 'bg-blue-100 text-blue-800'}`}>
                                      {email.approved ? '✓' : (index + 1)}
                                    </div>
                                    <div className="text-sm font-medium">{email.subject || `Email #${index + 1}`}</div>
                                  </div>
                                  <Badge variant="outline" className="text-xs">
                                    {email.delay || `Week ${index + 1}`}
                                  </Badge>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="px-4 py-3 bg-blue-50/5 border-t border-blue-200/10">
                                <div className="flex flex-col space-y-3">
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
                  <Button 
                    onClick={handleLaunchCampaign} 
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-ai-glow transition-all duration-300"
                    size="lg"
                    disabled={!allEmailsApproved}
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
                    {allEmailsApproved 
                      ? "Launch 12-Week Campaign" 
                      : `Approve all emails across ${categories.length} categories`}
                  </Button>
                </CardFooter>
              )}
            </Card>
          </div>
        </div>

        {/* Controls for template generation and campaign launch - ONLY show if no templates are loaded */}
        {dripEmailsByCategory[activeCategory]?.every(email => 
          email.content?.includes("Templates will appear here")) && (
          <div className="flex flex-col space-y-4 pt-4">
            {generationError && (
              <Alert variant="destructive" className="mb-2">
                <AlertCircle className="h-4 w-4 mr-2" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{generationError}</AlertDescription>
              </Alert>
            )}
            
            <div className="flex items-center justify-between">
              <Button 
                onClick={() => generateTemplatesForCategory(activeCategory)}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-ai-glow transition-all duration-300"
                disabled={isGeneratingEmails}
              >
                {isGeneratingEmails ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Generating...
                  </>
                ) : (
                  "Generate Templates"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

