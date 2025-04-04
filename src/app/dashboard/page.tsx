"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"

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

        <Tabs defaultValue="funnel" className="max-w-6xl mx-auto">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="funnel">Marketing Funnel</TabsTrigger>
            <TabsTrigger value="drip">Drip Campaign</TabsTrigger>
          </TabsList>

          <TabsContent value="funnel" className="space-y-6">
            {/* Marketing Funnel Visualization */}
            <Card className="border border-blue-500/10 bg-card shadow-xl overflow-hidden">
              <CardHeader className="border-b border-blue-200/20 bg-blue-50/5">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></span>
                  <CardTitle className="text-blue-900">
                    Marketing Funnel
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-8">
                  {/* Funnel stages */}
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">Awareness</span>
                        <span className="text-sm text-muted-foreground">{stats.awareness} leads</span>
                      </div>
                      <div className="relative">
                        <Progress value={100} className="h-8 bg-blue-100 border-blue-200" />
                        <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-blue-900">
                          100%
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">Consideration</span>
                        <span className="text-sm text-muted-foreground">{stats.consideration} leads</span>
                      </div>
                      <div className="relative">
                        <Progress 
                          value={Math.round((stats.consideration / stats.awareness) * 100)} 
                          className="h-8 bg-indigo-100 border-indigo-200" 
                        />
                        <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-indigo-900">
                          {Math.round((stats.consideration / stats.awareness) * 100)}%
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">Conversion</span>
                        <span className="text-sm text-muted-foreground">{stats.conversion} leads</span>
                      </div>
                      <div className="relative">
                        <Progress 
                          value={Math.round((stats.conversion / stats.awareness) * 100)} 
                          className="h-8 bg-purple-100 border-purple-200" 
                        />
                        <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-purple-900">
                          {Math.round((stats.conversion / stats.awareness) * 100)}%
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">Retention</span>
                        <span className="text-sm text-muted-foreground">{stats.retention} leads</span>
                      </div>
                      <div className="relative">
                        <Progress 
                          value={Math.round((stats.retention / stats.awareness) * 100)} 
                          className="h-8 bg-pink-100 border-pink-200" 
                        />
                        <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-pink-900">
                          {Math.round((stats.retention / stats.awareness) * 100)}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Funnel summary */}
                  <div className="grid grid-cols-4 gap-4">
                    <Card className="border border-blue-500/10 bg-card/50">
                      <CardContent className="pt-6 p-4">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-blue-600">{stats.awareness}</div>
                          <div className="text-sm text-muted-foreground">Total Leads</div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border border-indigo-500/10 bg-card/50">
                      <CardContent className="pt-6 p-4">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-indigo-600">{stats.consideration}</div>
                          <div className="text-sm text-muted-foreground">Engaged</div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border border-purple-500/10 bg-card/50">
                      <CardContent className="pt-6 p-4">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-purple-600">{stats.conversion}</div>
                          <div className="text-sm text-muted-foreground">Converted</div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border border-pink-500/10 bg-card/50">
                      <CardContent className="pt-6 p-4">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-pink-600">{stats.retention}</div>
                          <div className="text-sm text-muted-foreground">Retained</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="drip" className="space-y-6">
            {/* Drip Campaign Dashboard */}
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
                    <div className="grid grid-cols-3 gap-4">
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
} 