"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCaterly, useCatering } from "../app/context/caterly-context"
import { Badge } from "@/components/ui/badge"

export default function EnrichmentPage() {
  const router = useRouter()
  const { leads, setEnrichedLeads } = useCaterly()
  const [selectedLeads, setSelectedLeads] = useState<number[]>([])
  const [enrichedData, setEnrichedData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate API call to enrich leads with additional data
    const timer = setTimeout(() => {
      const enriched = leads.map((lead) => ({
        ...lead,
        email: `${lead.name.toLowerCase().replace(" ", ".")}@${lead.company.toLowerCase().replace(" ", "")}.com`,
        phone: `(${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
        industry: getRandomIndustry(),
        aiScore: Math.floor(Math.random() * 100) + 1,
        lastEvent: getRandomEvent(),
      }))

      // Sort by AI score (descending)
      enriched.sort((a, b) => b.aiScore - a.aiScore)

      setEnrichedData(enriched)
      setSelectedLeads(enriched.map((lead) => lead.id))
      setLoading(false)
    }, 2000)

    return () => clearTimeout(timer)
  }, [leads])

  const getRandomIndustry = () => {
    const industries = ["Technology", "Finance", "Healthcare", "Education", "Retail", "Manufacturing", "Hospitality"]
    return industries[Math.floor(Math.random() * industries.length)]
  }

  const getRandomEvent = () => {
    const events = ["Conference", "Wedding", "Corporate Party", "Fundraiser", "Product Launch", "Holiday Party"]
    return events[Math.floor(Math.random() * events.length)]
  }

  const toggleLeadSelection = (id: number) => {
    if (selectedLeads.includes(id)) {
      setSelectedLeads(selectedLeads.filter((leadId) => leadId !== id))
    } else {
      setSelectedLeads([...selectedLeads, id])
    }
  }

  const handleStartCampaign = () => {
    const finalSelectedLeads = enrichedData.filter((lead) => selectedLeads.includes(lead.id))
    setEnrichedLeads(finalSelectedLeads)
    router.push("/campaign/launch")
  }

  return (
    <div className="container mx-auto px-4 py-12 relative">
      {/* Background effects */}
      <div className="absolute -top-12 -left-12 w-64 h-64 bg-blue-500/10 rounded-full filter blur-3xl animate-pulse-slow"></div>
      <div className="absolute -bottom-12 -right-12 w-80 h-80 bg-purple-500/10 rounded-full filter blur-3xl animate-pulse-slow"></div>
      
      <div className="relative">
        <h1 className="text-4xl font-bold mb-2 text-center gradient-text-blue">
          <span className="sparkle">AI</span> Lead Enrichment & Scoring
        </h1>
        <p className="text-center text-muted-foreground mb-8">Using AI to identify your most promising leads</p>

        <div className="max-w-5xl mx-auto">
          <Card className="border border-blue-500/20 bg-secondary/10 backdrop-blur-sm shadow-medium overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-secondary/30">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></span>
                <CardTitle>
                  <span className="gradient-text">Enriched Leads</span>
                  <Badge className="ml-2 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30" variant="secondary">
                    AI Scored
                  </Badge>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className={loading ? "p-0" : "p-0"}>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-4 border-background/20"></div>
                    <div className="absolute inset-0 rounded-full border-t-4 border-l-4 border-blue-500 animate-spin"></div>
                    <div className="absolute inset-1 rounded-full bg-blue-500/10 animate-pulse"></div>
                  </div>
                  <p className="text-lg mt-6 gradient-text-blue">Processing leads with AI...</p>
                  <p className="text-sm text-muted-foreground mt-2">Analyzing data and calculating opportunity scores</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border/50 bg-secondary/20">
                          <th className="py-3 px-2 text-left w-12"></th>
                          <th className="py-3 px-2 text-left font-medium text-foreground/90">Name</th>
                          <th className="py-3 px-2 text-left font-medium text-foreground/90">Company</th>
                          <th className="py-3 px-2 text-left font-medium text-foreground/90">Email</th>
                          <th className="py-3 px-2 text-left font-medium text-foreground/90">Industry</th>
                          <th className="py-3 px-2 text-left font-medium text-foreground/90">Last Event</th>
                          <th className="py-3 px-2 text-center font-medium text-foreground/90">AI Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {enrichedData.map((lead) => (
                          <tr 
                            key={lead.id} 
                            className={`border-b border-border/30 hover:bg-secondary/30 transition-colors 
                                        ${selectedLeads.includes(lead.id) ? 'bg-secondary/20' : ''}`}
                          >
                            <td className="py-3 px-2">
                              <Checkbox
                                checked={selectedLeads.includes(lead.id)}
                                onCheckedChange={() => toggleLeadSelection(lead.id)}
                                className="border-blue-500/50 data-[state=checked]:bg-blue-500 data-[state=checked]:text-white"
                              />
                            </td>
                            <td className="py-3 px-2 font-medium">{lead.name}</td>
                            <td className="py-3 px-2 text-foreground/90">{lead.company}</td>
                            <td className="py-3 px-2 text-foreground/90">{lead.email}</td>
                            <td className="py-3 px-2 text-foreground/90">{lead.industry}</td>
                            <td className="py-3 px-2 text-foreground/90">
                              <Badge variant="outline" className="bg-secondary/40 border-blue-500/20 text-foreground/80">
                                {lead.lastEvent}
                              </Badge>
                            </td>
                            <td className="py-3 px-2 text-center">
                              <span
                                className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold shadow-ai-glow ${
                                  lead.aiScore >= 70 
                                    ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white ai-glow" 
                                    : lead.aiScore >= 40 
                                      ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white" 
                                      : "bg-gradient-to-r from-red-500 to-rose-600 text-white"
                                }`}
                              >
                                {lead.aiScore >= 70 && (
                                  <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none">
                                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" />
                                  </svg>
                                )}
                                {lead.aiScore}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-4 mt-2 flex justify-between items-center">
                    <div className="text-sm text-muted-foreground flex items-center">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                      {selectedLeads.length} of {enrichedData.length} leads selected
                    </div>

                    <Button
                      onClick={handleStartCampaign}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-ai-glow transition-all duration-300 transform hover:scale-105"
                      disabled={selectedLeads.length === 0}
                    >
                      <span className="mr-2">Start Campaign</span>
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        width="24" 
                        height="24" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        className="h-4 w-4 sparkle"
                      >
                        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"></path>
                        <path d="M9 18h6"></path>
                        <path d="M10 22h4"></path>
                      </svg>
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

