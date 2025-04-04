"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ExternalLinkIcon, MapPinIcon, PhoneIcon, MailIcon, CalendarIcon, BuildingIcon, InfoIcon, ArrowLeftIcon } from "lucide-react"

interface EnrichmentData {
  venueCapacity?: number;
  inHouseCatering?: boolean;
  eventManagerName?: string;
  eventManagerEmail?: string;
  eventManagerPhone?: string;
  lastPublishedEvent?: string;
  eventFrequency?: string;
  commonEventTypes?: string[];
  aiOverview?: string;
  website?: string;
  eventTypes?: string[];
  amenities?: string[] | string;
  pricingInformation?: string;
  preferredCaterers?: string[];
  leadScore?: {
    score: number;
    reasons: string[];
    potential: 'high' | 'medium' | 'low';
    lastCalculated: string;
  };
  eventsInformation?: string;
  lastUpdated?: string;
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
  [key: string]: any;
}

interface LeadProfilePageProps {
  lead: Lead;
}

export default function LeadProfilePage({ lead }: LeadProfilePageProps) {
  const router = useRouter()
  const enrichmentData = lead.enrichment_data || {}
  
  // Format the business overview
  const businessOverview = enrichmentData.aiOverview || "No overview available";
  
  // Format amenities as list if it's an array
  const amenities = 
    Array.isArray(enrichmentData.amenities) 
      ? enrichmentData.amenities 
      : typeof enrichmentData.amenities === 'string'
        ? [enrichmentData.amenities]
        : [];
  
  // Format event types as list
  const eventTypes = 
    Array.isArray(enrichmentData.commonEventTypes) 
      ? enrichmentData.commonEventTypes 
      : Array.isArray(enrichmentData.eventTypes)
        ? enrichmentData.eventTypes
        : [];
  
  // Format preferred caterers as list
  const preferredCaterers = 
    Array.isArray(enrichmentData.preferredCaterers) 
      ? enrichmentData.preferredCaterers 
      : [];

  // Determine contact info
  const contactName = enrichmentData.eventManagerName || enrichmentData.managementContactName || lead.contact_name || "No contact name available";
  const contactEmail = enrichmentData.eventManagerEmail || enrichmentData.managementContactEmail || lead.contact_email || null;
  const contactPhone = enrichmentData.eventManagerPhone || enrichmentData.managementContactPhone || lead.contact_phone || null;
  
  // Format venue capacity
  const venueCapacity = enrichmentData.venueCapacity 
    ? `${enrichmentData.venueCapacity} people` 
    : "Not specified";
  
  // Format website URL for display and linking
  const websiteUrl = lead.website_url || enrichmentData.website || null;
  const displayWebsite = websiteUrl 
    ? websiteUrl.replace(/^https?:\/\//, '') 
    : "Not available";
    
  // Format score
  const score = enrichmentData.leadScore?.score || 0;
  const potential = enrichmentData.leadScore?.potential || "low";
  
  // Get scoring reasons
  const scoringReasons = enrichmentData.leadScore?.reasons || [];
  
  // Get CSS class for lead score
  const getScoreClass = () => {
    if (score >= 70) {
      return 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-glow';
    } else if (score >= 40) {
      return 'bg-gradient-to-r from-amber-500 to-orange-600 text-white';
    } else {
      return 'bg-gradient-to-r from-red-500 to-rose-600 text-white';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 relative min-h-screen">
      {/* Background effects */}
      <div className="absolute -top-12 -right-12 w-64 h-64 bg-purple-500/10 rounded-full filter blur-3xl animate-pulse-slow"></div>
      <div className="absolute -bottom-12 -left-12 w-80 h-80 bg-blue-500/10 rounded-full filter blur-3xl animate-pulse-slow"></div>
      
      <div className="relative max-w-6xl mx-auto">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back to Leads
          </Button>
          
          <div className="flex flex-col md:flex-row md:items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold gradient-text-blue">{lead.name}</h1>
            
            {lead.type && (
              <Badge className="bg-blue-500/20 text-blue-300 self-start" variant="secondary">
                {lead.type}
              </Badge>
            )}
            
            {score > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-sm text-muted-foreground">Lead Score:</span>
                <span
                  className={`inline-flex items-center justify-center rounded-full px-4 py-1 text-sm font-semibold ${getScoreClass()}`}
                >
                  {score}
                </span>
                <span className="text-sm capitalize text-muted-foreground">
                  ({potential} potential)
                </span>
              </div>
            )}
          </div>
          
          {lead.address && (
            <div className="flex items-center text-muted-foreground mb-2">
              <MapPinIcon className="w-4 h-4 mr-1" />
              <span>{lead.address}</span>
            </div>
          )}
          
          {websiteUrl && (
            <div className="flex items-center">
              <a 
                href={websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-600 flex items-center"
              >
                <ExternalLinkIcon className="w-4 h-4 mr-1" />
                {displayWebsite}
              </a>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left column - Business Details */}
          <div className="md:col-span-2 space-y-6">
            <Card className="border border-purple-500/20 bg-secondary/10 backdrop-blur-sm shadow-medium overflow-hidden">
              <CardHeader className="border-b border-border/50 bg-secondary/30">
                <CardTitle className="flex items-center">
                  <InfoIcon className="w-5 h-5 mr-2 text-purple-500" />
                  Business Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-foreground/90 leading-relaxed">
                  {businessOverview}
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <div>
                    <h3 className="font-medium text-foreground/80 mb-2 border-b border-border/30 pb-1">Venue Details</h3>
                    <div className="space-y-3">
                      <div className="flex items-start">
                        <BuildingIcon className="w-5 h-5 mr-2 text-purple-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-foreground/90 font-medium">Capacity</p>
                          <p className="text-foreground/80">{venueCapacity}</p>
                        </div>
                      </div>
                      
                      {(enrichmentData.inHouseCatering !== undefined) && (
                        <div className="flex items-start">
                          <InfoIcon className="w-5 h-5 mr-2 text-purple-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-foreground/90 font-medium">In-house Catering</p>
                            <p className="text-foreground/80">
                              {enrichmentData.inHouseCatering ? "Yes" : "No"}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-medium text-foreground/80 mb-2 border-b border-border/30 pb-1">Contact Information</h3>
                    <div className="space-y-3">
                      <div className="flex items-start">
                        <MailIcon className="w-5 h-5 mr-2 text-purple-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-foreground/90 font-medium">Email</p>
                          {contactEmail ? (
                            <a href={`mailto:${contactEmail}`} className="text-blue-500 break-all">
                              {contactEmail}
                            </a>
                          ) : (
                            <p className="text-foreground/70 italic">Not available</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-start">
                        <PhoneIcon className="w-5 h-5 mr-2 text-purple-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-foreground/90 font-medium">Phone</p>
                          {contactPhone ? (
                            <a href={`tel:${contactPhone}`} className="text-blue-500">
                              {contactPhone}
                            </a>
                          ) : (
                            <p className="text-foreground/70 italic">Not available</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {enrichmentData.pricingInformation && (
                  <div className="mt-6">
                    <h3 className="font-medium text-foreground/80 mb-2 border-b border-border/30 pb-1">Pricing Information</h3>
                    <p className="text-foreground/90">{enrichmentData.pricingInformation}</p>
                  </div>
                )}
                
                {enrichmentData.eventsInformation && (
                  <div className="mt-6">
                    <h3 className="font-medium text-foreground/80 mb-2 border-b border-border/30 pb-1">Events Information</h3>
                    <p className="text-foreground/90">{enrichmentData.eventsInformation}</p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {eventTypes.length > 0 && (
                <Card className="border border-blue-500/20 bg-secondary/10 backdrop-blur-sm shadow-medium overflow-hidden">
                  <CardHeader className="border-b border-border/50 bg-secondary/30">
                    <CardTitle className="flex items-center">
                      <CalendarIcon className="w-5 h-5 mr-2 text-blue-500" />
                      Event Types
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="flex flex-wrap gap-2">
                      {eventTypes.map((type, index) => (
                        <Badge key={index} className="bg-blue-500/20 text-blue-300" variant="secondary">
                          {type}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {amenities.length > 0 && (
                <Card className="border border-purple-500/20 bg-secondary/10 backdrop-blur-sm shadow-medium overflow-hidden">
                  <CardHeader className="border-b border-border/50 bg-secondary/30">
                    <CardTitle className="flex items-center">
                      <BuildingIcon className="w-5 h-5 mr-2 text-purple-500" />
                      Amenities
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <ul className="list-disc list-inside space-y-1 text-foreground/90">
                      {amenities.map((amenity, index) => (
                        <li key={index}>{amenity}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
            
            {preferredCaterers.length > 0 && (
              <Card className="border border-green-500/20 bg-secondary/10 backdrop-blur-sm shadow-medium overflow-hidden">
                <CardHeader className="border-b border-border/50 bg-secondary/30">
                  <CardTitle className="flex items-center">
                    <InfoIcon className="w-5 h-5 mr-2 text-green-500" />
                    Preferred Caterers
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <ul className="list-disc list-inside space-y-1 text-foreground/90">
                    {preferredCaterers.map((caterer, index) => (
                      <li key={index}>{caterer}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
          
          {/* Right column - Contact & Scoring */}
          <div className="space-y-6">
            <Card className="border border-emerald-500/20 bg-secondary/10 backdrop-blur-sm shadow-medium overflow-hidden">
              <CardHeader className="border-b border-border/50 bg-secondary/30">
                <CardTitle className="flex items-center">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse mr-2"></span>
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-foreground/70 block mb-1">Contact Name</label>
                    <p className="text-foreground font-medium">{contactName}</p>
                  </div>
                  
                  {contactEmail && (
                    <div>
                      <label className="text-xs font-medium text-foreground/70 block mb-1">Email</label>
                      <a 
                        href={`mailto:${contactEmail}`}
                        className="text-blue-500 hover:text-blue-600 flex items-center"
                      >
                        <MailIcon className="w-4 h-4 mr-2" />
                        {contactEmail}
                      </a>
                    </div>
                  )}
                  
                  {contactPhone && (
                    <div>
                      <label className="text-xs font-medium text-foreground/70 block mb-1">Phone</label>
                      <a 
                        href={`tel:${contactPhone}`}
                        className="text-blue-500 hover:text-blue-600 flex items-center"
                      >
                        <PhoneIcon className="w-4 h-4 mr-2" />
                        {contactPhone}
                      </a>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <Card className="border border-blue-500/20 bg-secondary/10 backdrop-blur-sm shadow-medium overflow-hidden">
              <CardHeader className="border-b border-border/50 bg-secondary/30">
                <CardTitle className="flex items-center">
                  <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse mr-2"></span>
                  Lead Scoring
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex flex-col items-center mb-4">
                  <div 
                    className={`w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold ${getScoreClass()}`}
                  >
                    {score}
                  </div>
                  <p className="mt-2 text-foreground/90 font-medium capitalize">{potential} Potential</p>
                </div>
                
                {scoringReasons.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-foreground/80 mb-2">Scoring Factors</h3>
                    <ul className="list-disc list-inside space-y-1 text-foreground/90 text-sm">
                      {scoringReasons.map((reason, index) => (
                        <li key={index}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <div className="mt-4 text-xs text-muted-foreground">
                  <p>Last updated: {enrichmentData.lastUpdated ? new Date(enrichmentData.lastUpdated).toLocaleString() : 'Unknown'}</p>
                </div>
                
                <div className="mt-6">
                  <Button 
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                    onClick={() => router.push('/campaign/launch')}
                  >
                    Add to Campaign
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
} 