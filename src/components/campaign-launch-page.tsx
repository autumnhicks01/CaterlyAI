"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCaterly, useCatering } from "../app/context/caterly-context"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

// Define type for drip emails
type DripEmail = {
  id: number;
  subject: string;
  content: string;
  delay: string;
  approved: boolean;
};

export default function CampaignLaunchPage() {
  const router = useRouter()
  const { campaign, enrichedLeads, profile } = useCaterly()
  const [emailContent, setEmailContent] = useState("")
  const [isLaunched, setIsLaunched] = useState(false)
  const [stats, setStats] = useState({
    sent: 0,
    opened: 0,
    replied: 0,
    clicked: 0,
  })
  const [activities, setActivities] = useState<any[]>([])
  
  // State for drip campaign sequence
  const [dripEmails, setDripEmails] = useState<DripEmail[]>([
    {
      id: 1,
      subject: "Exceptional Catering Services for Your Upcoming Event",
      content: "",
      delay: "Day 1 (Initial Contact)",
      approved: false,
    },
    {
      id: 2,
      subject: "Special Discount for Your First Catering Order",
      content: "Dear [Lead Name],\n\nThank you for considering our catering services. We'd like to offer you a special 15% discount on your first order with us.\n\nBest regards,\n[Your Name]",
      delay: "Day 3",
      approved: false,
    },
    {
      id: 3,
      subject: "Custom Menu Options for Your Event",
      content: "Dear [Lead Name],\n\nWe offer a variety of custom menu options that can be tailored to your specific event needs. Would you like to discuss some possibilities?\n\nBest regards,\n[Your Name]",
      delay: "Week 2",
      approved: false,
    },
    {
      id: 4,
      subject: "Success Story: How We Helped a Similar Event",
      content: "Dear [Lead Name],\n\nWe recently catered an event similar to yours and received excellent feedback. I thought you might be interested in learning about how we handled it.\n\nBest regards,\n[Your Name]",
      delay: "Week 3",
      approved: false,
    },
    {
      id: 5,
      subject: "Follow-up on Your Catering Needs",
      content: "Dear [Lead Name],\n\nI'm following up to see if you've had a chance to consider our catering services for your upcoming event. Is there any additional information I can provide?\n\nBest regards,\n[Your Name]",
      delay: "Week 5",
      approved: false,
    },
    {
      id: 6,
      subject: "Limited Time Seasonal Menu Options",
      content: "Dear [Lead Name],\n\nWe're currently offering some seasonal menu options that would be perfect for your event. These are only available for a limited time.\n\nBest regards,\n[Your Name]",
      delay: "Week 7",
      approved: false,
    },
    {
      id: 7,
      subject: "Free Tasting Session Invitation",
      content: "Dear [Lead Name],\n\nWe'd like to invite you to a free tasting session to sample some of our most popular dishes before making your final decision.\n\nBest regards,\n[Your Name]",
      delay: "Week 9",
      approved: false,
    },
    {
      id: 8,
      subject: "Last Chance: Book Your Catering Now",
      content: "Dear [Lead Name],\n\nAs your event date approaches, we wanted to reach out one last time to see if you'd like to secure our catering services. Our calendar is filling up quickly.\n\nBest regards,\n[Your Name]",
      delay: "Week 12",
      approved: false,
    }
  ]);
  
  const [activeDripEmail, setActiveDripEmail] = useState<number>(1);
  const [allEmailsApproved, setAllEmailsApproved] = useState<boolean>(false);

  useEffect(() => {
    // Generate email content based on campaign and profile
    const generateEmail = () => {
      const eventType = campaign?.eventType || "event"
      const companyName = "Your Catering Company"

      return `Subject: Exceptional Catering Services for Your Upcoming ${eventType.charAt(0).toUpperCase() + eventType.slice(1)}

Dear [Lead Name],

I noticed that you're planning an upcoming ${eventType} and wanted to introduce our catering services that might be a perfect fit for your needs.

${profile?.description || "We specialize in creating memorable dining experiences with fresh, locally-sourced ingredients and exceptional service."}

Our clients consistently praise our attention to detail and ability to accommodate special dietary requirements. We'd love to discuss how we can make your ${eventType} a culinary success.

You can view our full menu here: ${profile?.menuLink || "[Menu Link]"}

Would you be available for a quick call this week to discuss your catering needs?

Best regards,
[Your Name]
${profile?.managerContact || "[Contact Information]"}

P.S. You can also place orders directly through our website: ${profile?.orderingLink || "[Ordering Link]"}`
    }

    // Set the initial email content
    const initialEmail = generateEmail();
    setEmailContent(initialEmail);
    
    // Update the first drip email content
    setDripEmails(emails => 
      emails.map(email => 
        email.id === 1 
          ? { ...email, content: initialEmail }
          : email
      )
    );
  }, [campaign, profile]);

  // Check if all emails are approved
  useEffect(() => {
    const approved = dripEmails.every(email => email.approved);
    setAllEmailsApproved(approved);
  }, [dripEmails]);

  useEffect(() => {
    if (isLaunched) {
      // Simulate campaign progress over time
      const interval = setInterval(() => {
        setStats((prev) => {
          const newOpened = Math.min(prev.opened + 1, enrichedLeads.length)
          const newReplied = Math.min(prev.replied + (Math.random() > 0.7 ? 1 : 0), Math.floor(newOpened * 0.4))
          const newClicked = Math.min(prev.clicked + (Math.random() > 0.6 ? 1 : 0), Math.floor(newOpened * 0.6))

          return {
            sent: enrichedLeads.length,
            opened: newOpened,
            replied: newReplied,
            clicked: newClicked,
          }
        })

        // Add new activity if conditions are met
        if (Math.random() > 0.5) {
          const randomLead = enrichedLeads[Math.floor(Math.random() * enrichedLeads.length)]
          const actionTypes = [
            "opened your email",
            "clicked your menu link",
            "viewed your ordering page",
            "replied to your email",
          ]
          const randomAction = actionTypes[Math.floor(Math.random() * actionTypes.length)]

          setActivities((prev) => [
            {
              id: Date.now(),
              lead: randomLead,
              action: randomAction,
              time: new Date().toLocaleTimeString(),
            },
            ...prev.slice(0, 9), // Keep only the 10 most recent activities
          ])
        }
      }, 3000)

      return () => clearInterval(interval)
    }
  }, [isLaunched, enrichedLeads])

  const handleDripEmailContentChange = (content: string) => {
    // Update the active drip email content
    setDripEmails(emails => 
      emails.map(email => 
        email.id === activeDripEmail 
          ? { ...email, content }
          : email
      )
    );
  };

  const handleDripEmailApproval = (id: number) => {
    // Mark the drip email as approved
    setDripEmails(emails => 
      emails.map(email => 
        email.id === id 
          ? { ...email, approved: true }
          : email
      )
    );
  };

  const handleDripEmailEdit = (id: number) => {
    setActiveDripEmail(id);
  };

  const handleLaunchCampaign = () => {
    setIsLaunched(true)
    setStats({
      sent: enrichedLeads.length,
      opened: 0,
      replied: 0,
      clicked: 0,
    })
  }

  // Get active drip email content
  const activeDripEmailContent = dripEmails.find(email => email.id === activeDripEmail)?.content || "";

  return (
    <div className="container mx-auto px-4 py-12 relative">
      {/* Background effects */}
      <div className="absolute -top-20 left-0 w-96 h-96 bg-purple-500/5 rounded-full filter blur-3xl animate-pulse-slow"></div>
      <div className="absolute bottom-20 -right-20 w-96 h-96 bg-blue-500/5 rounded-full filter blur-3xl animate-pulse-slow animation-delay-700"></div>
      
      <div className="relative">
        <h1 className="text-4xl font-bold mb-2 text-center gradient-text">
          {isLaunched ? "Campaign Dashboard" : "Launch Your Campaign"}
        </h1>
        <p className="text-center text-foreground/80 mb-8">
          {isLaunched ? "Track your campaign performance in real-time" : "Review and approve your outreach strategy"}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Left Column - Email Preview */}
          <div>
            <Card className="h-full border border-purple-500/10 bg-card shadow-xl overflow-hidden">
              <CardHeader className="border-b border-purple-200/20 bg-purple-50/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></span>
                    <CardTitle className="text-blue-900">
                      {!isLaunched && activeDripEmail === 1 ? "Initial Email Template" : "Email Preview"}
                    </CardTitle>
                  </div>
                  {!isLaunched && (
                    <Badge variant="outline" className="border-purple-200/30 text-purple-400">
                      {dripEmails.find(email => email.id === activeDripEmail)?.delay}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {!isLaunched ? (
                  <>
                    <Textarea
                      value={activeDripEmailContent}
                      onChange={(e) => handleDripEmailContentChange(e.target.value)}
                      className="min-h-[400px] font-mono text-sm bg-white text-gray-800 border-gray-200 focus:border-purple-500/50"
                    />
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
                  {!dripEmails.find(email => email.id === activeDripEmail)?.approved ? (
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
                      Approve Email #{activeDripEmail}
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
                      Email #{activeDripEmail} Approved
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
                    {isLaunched ? "Campaign Performance" : "12-Week Drip Campaign"} 
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
                        Email Sequence
                      </h3>
                      
                      <div className="space-y-2">
                        <Accordion type="single" collapsible className="w-full">
                          {dripEmails.map((email) => (
                            <AccordionItem key={email.id} value={`email-${email.id}`} className="border border-blue-200/10 rounded-lg mb-3 overflow-hidden">
                              <AccordionTrigger className="px-4 py-3 hover:bg-blue-50/5 text-left">
                                <div className="flex items-center justify-between w-full">
                                  <div className="flex items-center space-x-3">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${email.approved ? 'bg-green-500 text-white' : 'bg-blue-100 text-blue-800'}`}>
                                      {email.approved ? '✓' : email.id}
                                    </div>
                                    <div className="text-sm font-medium">{email.subject}</div>
                                  </div>
                                  <Badge variant="outline" className="text-xs">
                                    {email.delay}
                                  </Badge>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="px-4 py-3 bg-blue-50/5 border-t border-blue-200/10">
                                <div className="flex flex-col space-y-3">
                                  <div className="text-sm whitespace-pre-line text-muted-foreground">
                                    {email.content.substring(0, 150)}...
                                  </div>
                                  <div className="flex items-center space-x-2 pt-2">
                                    <Button 
                                      onClick={() => handleDripEmailEdit(email.id)} 
                                      size="sm"
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {activeDripEmail === email.id ? 'Currently Editing' : 'Edit Email'}
                                    </Button>
                                    
                                    {!email.approved ? (
                                      <Button 
                                        onClick={() => handleDripEmailApproval(email.id)} 
                                        size="sm"
                                        variant="default"
                                        className="text-xs bg-green-600 hover:bg-green-700"
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
                              You need to approve all {dripEmails.length} emails in the sequence before launching your campaign.
                            </div>
                          </div>
                          <div className="mt-3 w-full bg-secondary/30 h-2 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                              style={{width: `${(dripEmails.filter(e => e.approved).length / dripEmails.length) * 100}%`}}
                            ></div>
                          </div>
                          <div className="mt-1 text-xs text-right text-muted-foreground">
                            {dripEmails.filter(e => e.approved).length}/{dripEmails.length} emails approved
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

                      <div>
                        <div className="mb-2 text-sm text-muted-foreground">Email Open Rate</div>
                        <div className="h-4 w-full bg-secondary/50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                            style={{
                              width: `${stats.sent === 0 ? 0 : Math.round((stats.opened / stats.sent) * 100)}%`,
                            }}
                          ></div>
                        </div>
                        <div className="mt-1 text-xs text-right text-muted-foreground">
                          {stats.sent === 0 ? 0 : Math.round((stats.opened / stats.sent) * 100)}% opened
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="text-sm font-medium">Upcoming Emails in Sequence</div>
                        
                        <div className="space-y-2">
                          {dripEmails.filter((_, i) => i > 0 && i < 4).map((email) => (
                            <div key={email.id} className="p-3 bg-card/60 border border-purple-200/10 rounded-lg">
                              <div className="flex justify-between">
                                <div className="text-sm font-medium">{email.subject}</div>
                                <Badge variant="outline" className="text-xs">
                                  {email.delay}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TabsContent>
                  
                    <TabsContent value="activity">
                      <div className="space-y-6">
                        <div className="space-y-3">
                          {activities.map((activity) => (
                            <Card key={activity.id} className="bg-card/50 border-border/10">
                              <CardContent className="p-3">
                                <div className="flex items-center space-x-3">
                                  <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-8 w-8 rounded-full flex items-center justify-center text-white font-medium">
                                    {activity.lead.name.charAt(0)}
                                  </div>
                                  <div className="text-sm flex-1">
                                    <span className="font-medium">{activity.lead.name}</span>{" "}
                                    {activity.action}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {activity.time}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
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
                      : `Approve all ${dripEmails.length - dripEmails.filter(e => e.approved).length} remaining emails`}
                  </Button>
                </CardFooter>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

