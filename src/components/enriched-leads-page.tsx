"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircleIcon, InfoIcon, ExternalLinkIcon } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"

// Define interfaces for Lead and EnrichmentData based on the Supabase schema
interface EnrichmentData {
  venueCapacity?: number;
  inHouseCatering?: boolean;
  eventManagerName?: string;
  eventManagerEmail?: string;
  eventManagerPhone?: string;
  commonEventTypes?: string[];
  aiOverview?: string;
  website?: string;
  leadScore?: {
    score: number;
    reasons: string[];
    potential: 'high' | 'medium' | 'low';
    lastCalculated: string;
  };
  [key: string]: any;
}

interface Lead {
  id: string;
  name: string;
  address?: string | null;
  website_url?: string | null;
  contact_email?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  type?: string | null;
  status?: string | null;
  enrichment_data?: EnrichmentData | null;
  lead_score?: number | null;
  lead_score_label?: string | null;
  created_at?: string | null;
}

export default function EnrichedLeadsPage() {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  const [selectAll, setSelectAll] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isEnriching, setIsEnriching] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch saved leads from Supabase
  async function fetchLeads() {
    try {
      setIsRefreshing(true)
      setError(null)
      const response = await fetch('/api/leads/saved')
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch leads')
      }
      
      const data = await response.json()
      setLeads(data.leads || [])
    } catch (err) {
      console.error('Error fetching leads:', err)
      setError(err instanceof Error ? err.message : 'An error occurred while fetching leads')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }
  
  useEffect(() => {
    fetchLeads()
  }, [])

  // Toggle select all leads
  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedLeads([])
    } else {
      const allLeadIds = leads.map(lead => lead.id)
      setSelectedLeads(allLeadIds)
    }
    setSelectAll(!selectAll)
  }

  // Toggle selection of individual lead
  const toggleLeadSelection = (id: string) => {
    if (selectedLeads.includes(id)) {
      setSelectedLeads(selectedLeads.filter(leadId => leadId !== id))
      setSelectAll(false)
    } else {
      setSelectedLeads([...selectedLeads, id])
      // Check if all leads are now selected
      if (selectedLeads.length + 1 === leads.length) {
        setSelectAll(true)
      }
    }
  }

  // Manual enrichment process for leads
  const enrichSelectedLeads = async () => {
    if (selectedLeads.length === 0) {
      setError("Please select at least one lead to enrich");
      return;
    }
    
    setIsEnriching(true);
    setError(null);
    
    try {
      const response = await fetch('/api/leads/enrich', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leadIds: selectedLeads
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to enrich leads');
      }
      
      // Refresh leads after enrichment
      await fetchLeads();
      // Clear selections after successful enrichment
      setSelectedLeads([]);
      setSelectAll(false);
    } catch (err) {
      console.error('Error enriching leads:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while enriching leads');
    } finally {
      setIsEnriching(false);
    }
  };

  // Navigate to lead profile page
  const viewLeadProfile = (leadId: string) => {
    router.push(`/leads/${leadId}`)
  }

  // Get CSS class for lead score
  const getScoreClass = (lead: Lead) => {
    if (!lead.lead_score) return 'bg-gray-100 text-gray-500'
    
    if (lead.lead_score >= 70) {
      return 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-glow'
    } else if (lead.lead_score >= 40) {
      return 'bg-gradient-to-r from-amber-500 to-orange-600 text-white'
    } else {
      return 'bg-gradient-to-r from-red-500 to-rose-600 text-white'
    }
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

        {error && (
          <Alert className="mb-6 bg-red-50/80 border border-red-200 text-red-800 max-w-7xl mx-auto">
            <AlertCircleIcon className="h-5 w-5 text-red-600" />
            <AlertDescription className="ml-2">{error}</AlertDescription>
          </Alert>
        )}

        <div className="max-w-7xl mx-auto">
          <Card className="border border-blue-500/20 bg-secondary/10 backdrop-blur-sm shadow-medium overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-secondary/30">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></span>
                <CardTitle>
                  <span className="gradient-text">Enriched Leads</span>
                  <Badge className="ml-2 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30" variant="secondary">
                    AI Enriched
                  </Badge>
                </CardTitle>
              </div>
              <div className="flex items-center space-x-3">
                {isEnriching && (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm text-muted-foreground">Enriching leads...</span>
                  </div>
                )}
                <Button 
                  onClick={enrichSelectedLeads}
                  size="sm"
                  variant="outline"
                  disabled={isEnriching || selectedLeads.length === 0}
                  className="border-blue-500/20 hover:bg-blue-500/10 mr-2"
                >
                  Enrich with AI
                </Button>
                <Button 
                  onClick={fetchLeads} 
                  size="sm"
                  variant="outline"
                  disabled={isRefreshing}
                  className="border-blue-500/20 hover:bg-blue-500/10"
                >
                  {isRefreshing ? (
                    <>
                      <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                      Refreshing...
                    </>
                  ) : (
                    'Refresh Leads'
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-4 border-background/20"></div>
                    <div className="absolute inset-0 rounded-full border-t-4 border-l-4 border-blue-500 animate-spin"></div>
                    <div className="absolute inset-1 rounded-full bg-blue-500/10 animate-pulse"></div>
                  </div>
                  <p className="text-lg mt-6 gradient-text-blue">Loading leads...</p>
                </div>
              ) : leads.length === 0 ? (
                <div className="py-16 px-4 text-center">
                  <div className="mb-4">
                    <InfoIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-muted-foreground mb-6">No leads found. Start by discovering potential venues.</p>
                  </div>
                  <Button 
                    onClick={() => router.push('/leads/discovery')}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6"
                    size="lg"
                  >
                    Discover Leads
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed">
                    <thead>
                      <tr className="border-b border-border/50 bg-secondary/20">
                        <th className="py-3 px-4 text-left font-medium text-foreground/90 w-8">
                          <Checkbox 
                            id="selectAll" 
                            checked={selectAll}
                            onCheckedChange={toggleSelectAll}
                            className="border-blue-500/50 data-[state=checked]:bg-blue-500"
                          />
                        </th>
                        <th className="py-3 px-4 text-left font-medium text-foreground/90 w-[16%]">Name</th>
                        <th className="py-3 px-4 text-left font-medium text-foreground/90 w-[25%]">Website</th>
                        <th className="py-3 px-4 text-left font-medium text-foreground/90 w-[12%]">Type</th>
                        <th className="py-3 px-4 text-left font-medium text-foreground/90 w-[22%]">Contact</th>
                        <th className="py-3 px-4 text-center font-medium text-foreground/90 w-[10%]">Score</th>
                        <th className="py-3 px-4 text-right font-medium text-foreground/90 w-[10%]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads.map((lead) => (
                        <tr 
                          key={lead.id} 
                          className="border-b border-border/30 hover:bg-secondary/30 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <Checkbox
                              checked={selectedLeads.includes(lead.id)}
                              onCheckedChange={() => toggleLeadSelection(lead.id)}
                              className="border-blue-500/50 data-[state=checked]:bg-blue-500"
                            />
                          </td>
                          <td className="py-3 px-4 font-medium">
                            <div className="flex flex-col">
                              <div className="truncate">{lead.name}</div>
                              {lead.status === 'enriched' && (
                                <Badge className="mt-1 self-start bg-green-500/20 text-green-300" variant="secondary">
                                  Enriched
                                </Badge>
                              )}
                              {lead.status === 'saved' && (
                                <Badge className="mt-1 self-start bg-amber-500/20 text-amber-300" variant="secondary">
                                  Saved
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-foreground/90">
                            {lead.website_url ? (
                              <a 
                                href={lead.website_url.startsWith('http') ? lead.website_url : `https://${lead.website_url}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:text-blue-600 flex items-center"
                                title={lead.website_url}
                              >
                                <span className="truncate">{lead.website_url.replace(/^https?:\/\//, '')}</span>
                                <ExternalLinkIcon className="ml-1 flex-shrink-0 h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground italic">Not available</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-foreground/90 truncate">
                            {lead.type || 'N/A'}
                          </td>
                          <td className="py-3 px-4 text-foreground/90">
                            <div className="space-y-1">
                              {lead.enrichment_data?.eventManagerEmail || lead.enrichment_data?.managementContactEmail || lead.contact_email ? (
                                <div className="truncate">
                                  {lead.enrichment_data?.eventManagerEmail || lead.enrichment_data?.managementContactEmail || lead.contact_email}
                                </div>
                              ) : (
                                <span className="text-muted-foreground italic">Email not available</span>
                              )}
                              {(lead.enrichment_data?.eventManagerPhone || lead.enrichment_data?.managementContactPhone) && (
                                <div className="text-sm text-muted-foreground truncate">
                                  {lead.enrichment_data?.eventManagerPhone || lead.enrichment_data?.managementContactPhone}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {lead.enrichment_data?.leadScore ? (
                              <div className="flex flex-col items-center">
                                <span
                                  className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${getScoreClass(lead)}`}
                                >
                                  {lead.enrichment_data.leadScore.score}
                                </span>
                                <span className="text-xs text-muted-foreground mt-1 capitalize">
                                  {lead.enrichment_data.leadScore.potential} potential
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic">Pending</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              onClick={() => viewLeadProfile(lead.id)}
                              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm py-1"
                              disabled={lead.status !== 'enriched'}
                            >
                              View Profile
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {leads.length > 0 && (
                <div className="p-4 mt-2 flex justify-between items-center border-t border-border/30">
                  <div className="text-sm text-muted-foreground flex items-center">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                    {selectedLeads.length} of {leads.length} leads selected
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
} 