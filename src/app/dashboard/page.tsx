"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { MessageSquare } from "lucide-react"

export default function DashboardPage() {
  // Campaign statistics state
  const [stats, setStats] = useState({
    awareness: 2450,
    consideration: 1632,
    conversion: 485,
    retention: 378,
  })

  // Drip campaign stats
  const [dripStats, setDripStats] = useState({
    pending: 5,
    sent: 3243,
    opened: 1876,
    clicked: 632,
    replied: 198,
    meetings: 45,
    textsSent: 127, // Added text messages sent metric
  })

  // Sample drip campaign emails
  const [drips, setDrips] = useState([
    {
      id: 1,
      name: "Initial Outreach",
      subject: "Let's connect about your catering needs",
      status: "Active",
      sentCount: 1250,
      openRate: 58,
      clickRate: 32,
    },
    {
      id: 2,
      name: "Follow-up",
      subject: "Following up on catering options",
      status: "Active",
      sentCount: 982,
      openRate: 52,
      clickRate: 27,
    },
    {
      id: 3,
      name: "Case Study Share",
      subject: "How we helped [similar company] with their event",
      status: "Active",
      sentCount: 764,
      openRate: 61,
      clickRate: 38,
    },
    {
      id: 4,
      name: "Final Chance",
      subject: "Last opportunity to discuss your upcoming event",
      status: "Scheduled",
      sentCount: 247,
      openRate: 46,
      clickRate: 18,
    },
  ])

  // Text automation triggers
  interface TextTrigger {
    id: number;
    name: string;
    condition: string;
    status: string;
    textsSent: number;
    options: string[];
    selectedOption: string;
  }

  const [textTriggers, setTextTriggers] = useState<TextTrigger[]>([
    {
      id: 1,
      name: "Multiple Email Opens",
      condition: "Lead opens email 3 times",
      status: "Active",
      textsSent: 87,
      options: ["1 time", "2 times", "3 times", "5 times", "10 times"],
      selectedOption: "3 times"
    },
    {
      id: 2,
      name: "Email Response",
      condition: "Lead responds to email",
      status: "Active",
      textsSent: 40,
      options: ["Any response", "Positive response", "Question in response"],
      selectedOption: "Any response"
    }
  ]);

  // Catering manager contact information
  interface CateringManager {
    name: string;
    phone: string;
  }
  
  const [cateringManager, setCateringManager] = useState<CateringManager>({
    name: "John Smith",
    phone: "555-123-4567"
  });
  
  // Handle manager info change
  const handleManagerChange = (field: keyof CateringManager, value: string) => {
    setCateringManager({
      ...cateringManager,
      [field]: value
    });
  };
  
  // Handle trigger option change
  const handleTriggerOptionChange = (triggerId: number, option: string) => {
    setTextTriggers(prev => prev.map(trigger => {
      if (trigger.id === triggerId) {
        const newCondition = trigger.id === 1 
          ? `Lead opens email ${option}` 
          : option;
        
        return {
          ...trigger,
          selectedOption: option,
          condition: newCondition
        };
      }
      return trigger;
    }));
  };

  // Mock loading data
  useEffect(() => {
    const timer = setTimeout(() => {
      // Update with slightly different numbers to simulate real-time changes
      setStats({
        awareness: stats.awareness + Math.floor(Math.random() * 10),
        consideration: stats.consideration + Math.floor(Math.random() * 6),
        conversion: stats.conversion + Math.floor(Math.random() * 2),
        retention: stats.retention + Math.floor(Math.random() * 1),
      })
      
      // Update text metrics occasionally
      if (Math.random() > 0.7) {
        setDripStats(prev => ({
          ...prev,
          textsSent: prev.textsSent + Math.floor(Math.random() * 3)
        }));
        
        setTextTriggers(prev => prev.map(trigger => ({
          ...trigger,
          textsSent: trigger.textsSent + (Math.random() > 0.5 ? 1 : 0)
        })));
      }
    }, 5000)

    return () => clearTimeout(timer)
  }, [stats])

  return (
    <div className="container mx-auto px-4 py-12 relative">
      {/* Background effects */}
      <div className="absolute -top-20 left-0 w-96 h-96 bg-purple-500/5 rounded-full filter blur-3xl animate-pulse-slow"></div>
      <div className="absolute bottom-20 -right-20 w-96 h-96 bg-blue-500/5 rounded-full filter blur-3xl animate-pulse-slow animation-delay-700"></div>
      
      <div className="relative">
        <h1 className="text-4xl font-bold mb-2 text-center gradient-text">
          Marketing Dashboard
        </h1>
        <p className="text-center text-foreground/80 mb-8">
          Track your marketing funnel and campaign performance
        </p>

        {/* Drip Campaign Dashboard */}
        <div className="space-y-6 max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Drip Campaign Stats */}
            <Card className="border border-blue-500/10 bg-card shadow-xl overflow-hidden lg:col-span-2">
              <CardHeader className="border-b border-blue-200/20 bg-blue-50/5">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></span>
                  <CardTitle className="text-blue-900">
                    Drip Campaign Performance
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div className="grid grid-cols-4 gap-4">
                    <Card className="border border-green-500/10 bg-card/50">
                      <CardContent className="pt-6 p-4">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-green-600">{dripStats.sent}</div>
                          <div className="text-sm text-muted-foreground">Emails Sent</div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border border-blue-500/10 bg-card/50">
                      <CardContent className="pt-6 p-4">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-blue-600">{dripStats.opened}</div>
                          <div className="text-sm text-muted-foreground">Emails Opened</div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border border-purple-500/10 bg-card/50">
                      <CardContent className="pt-6 p-4">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-purple-600">{dripStats.clicked}</div>
                          <div className="text-sm text-muted-foreground">Links Clicked</div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="border border-teal-500/10 bg-card/50">
                      <CardContent className="pt-6 p-4">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-teal-600">{dripStats.textsSent}</div>
                          <div className="text-sm text-muted-foreground">Texts Sent</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Email performance metrics */}
                  <div>
                    <div className="mb-2 text-sm text-muted-foreground">Email Open Rate</div>
                    <div className="h-4 w-full bg-secondary/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                        style={{
                          width: `${Math.round((dripStats.opened / dripStats.sent) * 100)}%`,
                        }}
                      ></div>
                    </div>
                    <div className="mt-1 text-xs text-right text-muted-foreground">
                      {Math.round((dripStats.opened / dripStats.sent) * 100)}% opened
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-sm text-muted-foreground">Click-through Rate</div>
                    <div className="h-4 w-full bg-secondary/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                        style={{
                          width: `${Math.round((dripStats.clicked / dripStats.opened) * 100)}%`,
                        }}
                      ></div>
                    </div>
                    <div className="mt-1 text-xs text-right text-muted-foreground">
                      {Math.round((dripStats.clicked / dripStats.opened) * 100)}% clicked
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-sm text-muted-foreground">Response Rate</div>
                    <div className="h-4 w-full bg-secondary/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-pink-500 to-orange-500 rounded-full"
                        style={{
                          width: `${Math.round((dripStats.replied / dripStats.clicked) * 100)}%`,
                        }}
                      ></div>
                    </div>
                    <div className="mt-1 text-xs text-right text-muted-foreground">
                      {Math.round((dripStats.replied / dripStats.clicked) * 100)}% replied
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Campaign Summary */}
            <Card className="border border-purple-500/10 bg-card shadow-xl overflow-hidden">
              <CardHeader className="border-b border-purple-200/20 bg-purple-50/5">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-purple-500 animate-pulse"></span>
                  <CardTitle className="text-purple-900">
                    Campaign Summary
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="border border-indigo-500/10 bg-card/50">
                      <CardContent className="pt-6 p-4">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-indigo-600">{dripStats.replied}</div>
                          <div className="text-sm text-muted-foreground">Replies</div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border border-emerald-500/10 bg-card/50">
                      <CardContent className="pt-6 p-4">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-emerald-600">{dripStats.meetings}</div>
                          <div className="text-sm text-muted-foreground">Meetings</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="mt-6">
                    <div className="text-sm font-medium mb-3">Active Drips</div>
                    <div className="space-y-3">
                      {drips.map((drip) => (
                        <div key={drip.id} className="p-3 bg-card/60 border border-primary/10 rounded-lg">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium text-sm">{drip.name}</div>
                              <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                                {drip.subject}
                              </div>
                            </div>
                            <Badge 
                              variant={drip.status === "Active" ? "default" : "secondary"} 
                              className={drip.status === "Active" ? "bg-green-500/20 text-green-700" : "bg-gray-500/20 text-gray-700"}
                            >
                              {drip.status}
                            </Badge>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                            <div>Open rate: <span className="text-primary">{drip.openRate}%</span></div>
                            <div>Click rate: <span className="text-primary">{drip.clickRate}%</span></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Text Automation Section */}
          <Card className="border border-teal-500/10 bg-card shadow-xl overflow-hidden">
            <CardHeader className="border-b border-teal-200/20 bg-teal-50/5">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-teal-500 animate-pulse"></span>
                <CardTitle className="text-teal-900 flex items-center">
                  <MessageSquare className="w-5 h-5 mr-2" /> Text Automation
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                {/* Manager Contact Information */}
                <div className="bg-card/60 border border-teal-500/10 rounded-lg p-4">
                  <h3 className="text-sm font-medium mb-3">Catering Manager Contact</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Name</label>
                      <input 
                        type="text" 
                        value={cateringManager.name}
                        onChange={(e) => handleManagerChange('name', e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Phone Number</label>
                      <input 
                        type="text" 
                        value={cateringManager.phone}
                        onChange={(e) => handleManagerChange('phone', e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Text catering manager when:</div>
                  <div className="text-sm text-teal-600 font-medium">{dripStats.textsSent} texts sent</div>
                </div>
                
                <div className="space-y-4">
                  {textTriggers.map((trigger) => (
                    <div key={trigger.id} className="p-4 bg-card/60 border border-teal-500/10 rounded-lg">
                      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
                        <div>
                          <div className="font-medium">{trigger.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {trigger.condition}
                          </div>
                        </div>
                        <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                          <select 
                            className="px-2 py-1 text-sm rounded-md border border-input bg-background"
                            value={trigger.selectedOption}
                            onChange={(e) => handleTriggerOptionChange(trigger.id, e.target.value)}
                          >
                            {trigger.options.map(option => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                          <div className="text-sm font-medium text-teal-600">
                            {trigger.textsSent} sent
                          </div>
                          <Badge 
                            variant={trigger.status === "Active" ? "default" : "secondary"} 
                            className={trigger.status === "Active" ? "bg-green-500/20 text-green-700" : "bg-gray-500/20 text-gray-700"}
                          >
                            {trigger.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
} 