"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCaterly } from "../app/context/caterly-context"
import { Badge } from "@/components/ui/badge"
import { Business } from "@/types/business"
import { businessService } from "@/lib/services/businessService"
import { useToast } from "@/hooks/use-toast"

// Extended Business interface with website_url property
interface EnrichableBusiness extends Business {
  website_url?: string;
}

// Simple spinner component
function Spinner({ className = "", size = "lg" }: { className?: string, size?: "sm" | "default" | "lg" | "xl" }) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    default: "h-5 w-5 border-2",
    lg: "h-8 w-8 border-3",
    xl: "h-12 w-12 border-4"
  };
  
  return (
    <div 
      className={`inline-block animate-spin rounded-full border-current border-solid border-r-transparent ${sizeClasses[size]} ${className}`} 
      role="status" 
      aria-label="Loading"
    />
  );
}

/**
 * Smart URL truncation function
 * Truncates long URLs intelligently while keeping the domain and important path parts
 */
function truncateUrl(url: string, maxLength: number = 30): string {
  // Remove protocol and www.
  let cleanUrl = url.replace(/^https?:\/\/(www\.)?/, '');
  
  // If URL is already short enough, return it
  if (cleanUrl.length <= maxLength) {
    return cleanUrl;
  }
  
  // Extract domain name (everything before the first slash)
  const domainMatch = cleanUrl.match(/^([^/]+)/);
  const domain = domainMatch ? domainMatch[1] : cleanUrl;
  
  // If the domain alone is too long, truncate it
  if (domain.length >= maxLength - 3) {
    return domain.substring(0, maxLength - 3) + "...";
  }
  
  // Get the path part
  const path = cleanUrl.substring(domain.length);
  
  // If we have a path, truncate it in the middle
  if (path) {
    // Always show the domain
    const availableChars = maxLength - domain.length - 3; // 3 chars for "..."
    
    if (availableChars <= 0) {
      return domain;
    }
    
    // Show the beginning of the path (including the first slash)
    const pathStart = path.substring(0, Math.floor(availableChars / 2));
    return domain + pathStart + "...";
  }
  
  return domain;
}

// Map Business type to Lead type for context compatibility
const businessToLead = (business: Business) => {
  // Ensure id is a number
  const id = business.id 
    ? (typeof business.id === 'string' ? parseInt(business.id, 10) : business.id) 
    : Math.floor(Math.random() * 10000);
  
  // Construct a Lead object with required properties
  return {
    id,
    name: business.name,
    company: business.name,
    location: business.address,
    category: business.category || (business.hasEventSpace ? "Event Space" : (business.type || "Business")),
    description: business.description || "",
    contact: business.contact || {
      phone: business.phone,
      website: business.website
    },
    website: business.website || business.contact?.website || "",
    address: business.address,
    hasEventSpace: business.hasEventSpace,
    photos: business.photos
  };
};

export default function LeadsDiscoveryPage() {
  const router = useRouter()
  const { setLeads, campaign } = useCaterly()
  const { toast } = useToast()
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  const [selectAll, setSelectAll] = useState(false)
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{step: string; status: string; count?: number; total?: number; message?: string} | null>(null)
  const [receivedFirstBusiness, setReceivedFirstBusiness] = useState(false)
  const [isEnrichingLeads, setIsEnrichingLeads] = useState(false)

  // Load businesses on component mount
  useEffect(() => {
    let mounted = true;

    async function fetchBusinesses() {
      if (!campaign) {
        setError("No campaign data found. Please set up a campaign first.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setBusinesses([]);
        setError(null);
        setProgress({
          step: 'search',
          status: 'started',
          message: 'Searching for businesses...'
        });
        
        // Build query from campaign categories
        const categoryQueries = campaign.targetCategories || [];
        let query = categoryQueries.length > 0 
          ? categoryQueries.join(" OR ") 
          : "event venue OR wedding venue";

        console.log(`Starting fast search for: ${query} in location: ${campaign.coordinates?.lat},${campaign.coordinates?.lng}`);
        
        // Use fast search for immediate results
        const results = await businessService.fastSearch({
          query,
          location: campaign.coordinates 
            ? `${campaign.coordinates.lat},${campaign.coordinates.lng}` 
            : '',
          radius: campaign.radius,
          coordinates: campaign.coordinates as any
        });
        
        console.log("Fast search complete:", results);
        
        if (results.error) {
          throw new Error(results.error);
        }
        
        // Update state with results
        if (mounted) {
          setBusinesses(results.businesses || []);
          setLoading(false);
          
          // Update progress to show completion
          setProgress({
            step: 'complete',
            status: 'completed',
            count: results.businesses?.length || 0,
            total: results.businesses?.length || 0,
            message: `Found ${results.businesses?.length || 0} businesses matching your criteria`
          });
        }
      } catch (err) {
        console.error("Error fetching businesses:", err);
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load businesses. Please try again later.");
          setLoading(false);
        }
      }
    }

    fetchBusinesses();

    // Cleanup function
    return () => {
      mounted = false;
    };
  }, [campaign]);

  // Add a useEffect to track changes to the businesses state
  useEffect(() => {
    console.log(`Businesses state updated: ${businesses.length} businesses available for display`);
    if (businesses.length > 0) {
      console.log("First business in state:", businesses[0]);
    }
  }, [businesses]);

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(businesses.map((business) => business.id || ''));
    }
    setSelectAll(!selectAll);
  }

  const toggleLeadSelection = (id: string) => {
    // Use non-empty string fallback to prevent empty IDs
    const safeId = id || `business-${Math.random()}`; 
    
    if (selectedLeads.includes(safeId)) {
      setSelectedLeads(selectedLeads.filter((leadId) => leadId !== safeId));
      setSelectAll(false);
    } else {
      setSelectedLeads([...selectedLeads, safeId]);
      if (selectedLeads.length + 1 === businesses.length) {
        setSelectAll(true);
      }
    }
  }

  const handleEnrichLeads = async () => {
    if (selectedLeads.length === 0) {
      setIsEnrichingLeads(false);
      toast({
        title: 'No leads selected',
        description: 'Please select at least one lead to enrich.',
        variant: 'destructive',
      });
      return;
    }

    setIsEnrichingLeads(true);
    
    try {
      // STEP 1: Get the selected businesses
      console.log(`[DISCOVERY] Starting enrichment for ${selectedLeads.length} selected leads`);
      
      // Convert selectedLeads (string IDs) to actual business objects
      const selectedBusinesses = businesses.filter(business => 
        selectedLeads.includes(business.id || '')
      );
      
      // STEP 2: Check if all selected businesses have website URLs
      console.log(`[DISCOVERY] Checking website URLs for ${selectedBusinesses.length} leads`);
      
      const businessesWithoutWebsites = selectedBusinesses.filter(
        (business) => {
          const b = business as EnrichableBusiness;
          return !b.website_url && !business.website && !business.contact?.website;
        }
      );
      
      if (businessesWithoutWebsites.length > 0) {
        console.error('[DISCOVERY] Some leads are missing website URLs:', 
          businessesWithoutWebsites.map(b => b.name).join(', '));
        
        toast({
          title: 'Missing website URLs',
          description: `${businessesWithoutWebsites.length} leads are missing website URLs and cannot be enriched.`,
          variant: 'destructive',
        });
        
        setIsEnrichingLeads(false);
        return;
      }

      // STEP 3: Ensure all leads have website_url field properly set
      const businessesToEnrich = selectedBusinesses.map(business => {
        const b = business as EnrichableBusiness;
        
        // If website_url is missing but website is available, use that
        if (!b.website_url && business.website) {
          console.log(`[DISCOVERY] Setting website_url for ${business.name} from website field: ${business.website}`);
          return {
            ...business,
            website_url: business.website
          } as EnrichableBusiness;
        }
        
        // If contact.website is available but no website_url, use that
        if (!b.website_url && business.contact?.website) {
          console.log(`[DISCOVERY] Setting website_url for ${business.name} from contact.website: ${business.contact.website}`);
          return {
            ...business,
            website_url: business.contact.website
          } as EnrichableBusiness;
        }
        
        return business as EnrichableBusiness;
      });

      // STEP 4: Redirect to the enriched leads page with loading state
      console.log(`[DISCOVERY] Redirecting to enriched leads page with loading state`);
      router.push(`/leads/enriched?status=processing&count=${businessesToEnrich.length}`);
      
      // STEP 5: Call the business enrichment service to process leads with AI
      console.log(`[DISCOVERY] Calling businessService.enrichBusinesses with ${businessesToEnrich.length} leads`);
      const enrichmentResult = await businessService.enrichBusinesses(businessesToEnrich);
      
      // STEP 6: Handle any errors from the enrichment process
      if (enrichmentResult.error) {
        console.error(`[DISCOVERY] Enrichment failed with error:`, enrichmentResult.error);
      }
      
      // STEP 7: Clean up
      console.log(`[DISCOVERY] Enrichment process complete`);
      setSelectedLeads([]);
      setIsEnrichingLeads(false);

    } catch (error) {
      console.error('[DISCOVERY] Unhandled error in handleEnrichLeads:', error);
      setIsEnrichingLeads(false);
      
      // Store error status in localStorage for the enriched page to display
      localStorage.setItem('enrichment_status', 'error');
      localStorage.setItem('enrichment_error', error instanceof Error ? error.message : 'Failed to enrich leads');
      
      // Show an error message to the user
      toast({
        title: 'Enrichment failed',
        description: error instanceof Error ? error.message : 'Failed to enrich leads',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 relative">
      {/* Background effects - adjusted position to reduce whitespace */}
      <div className="absolute -top-8 -right-8 w-64 h-64 bg-purple-500/10 rounded-full filter blur-3xl animate-pulse-slow"></div>
      <div className="absolute -bottom-8 -left-8 w-80 h-80 bg-blue-500/10 rounded-full filter blur-3xl animate-pulse-slow"></div>
      
      <div className="relative">
        <h1 className="text-3xl font-bold mb-2 text-center gradient-text">Discovered Leads</h1>
        <p className="text-center text-muted-foreground mb-6">AI-powered lead discovery for your catering business</p>

        {/* Display streaming progress */}
        {progress && (
          <div className="max-w-5xl mx-auto mb-4">
            <div className="p-3 rounded-md bg-secondary/30 border border-purple-500/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                  <span className="font-medium text-foreground/90">{progress.step}</span>
                </div>
                <Badge variant="outline" className={`
                  ${progress.status === 'started' ? 'bg-amber-100/30 text-amber-800 border-amber-300' : ''}
                  ${progress.status === 'processing' ? 'bg-blue-100/30 text-blue-800 border-blue-300' : ''}
                  ${progress.status === 'completed' ? 'bg-green-100/30 text-green-800 border-green-300' : ''}
                `}>
                  {progress.status}
                </Badge>
              </div>
              
              {progress.message && (
                <p className="text-sm text-muted-foreground">{progress.message}</p>
              )}
              
              {progress.count !== undefined && progress.total !== undefined && (
                <div className="mt-2">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${Math.min(100, (progress.count / progress.total) * 100)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs mt-1 text-muted-foreground">
                    <span>{progress.count} of {progress.total}</span>
                    <span>{Math.min(100, Math.round((progress.count / progress.total) * 100))}%</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="max-w-5xl mx-auto">
          <Card className="border border-purple-500/20 bg-secondary/10 backdrop-blur-sm shadow-medium overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-secondary/30 py-3">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-purple-500 animate-pulse"></span>
                <CardTitle>
                  <span className="gradient-text-blue">Potential Leads</span>
                  <Badge className="ml-2 bg-purple-500/20 text-purple-300 hover:bg-purple-500/30" variant="secondary">
                    AI Generated
                  </Badge>
                </CardTitle>
              </div>
              {!loading && businesses.length > 0 && (
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="selectAll" 
                    checked={selectAll} 
                    onCheckedChange={toggleSelectAll}
                    className="border-purple-500/50 data-[state=checked]:bg-purple-500 data-[state=checked]:text-white" 
                  />
                  <label htmlFor="selectAll" className="text-sm font-medium text-foreground/80">
                    Select All
                  </label>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center items-center p-8">
                  <Spinner size="lg" className="text-purple-500" />
                  <span className="ml-3 text-muted-foreground">Discovering potential leads...</span>
                </div>
              ) : error ? (
                <div className="p-6 text-center">
                  <div className="text-red-500 mb-2">{error}</div>
                  <Button 
                    onClick={() => router.push("/campaign/setup")}
                    variant="outline"
                    className="mt-4"
                  >
                    Return to Campaign Setup
                  </Button>
                </div>
              ) : businesses.length === 0 ? (
                <div className="p-6 text-center">
                  <div className="text-muted-foreground">No leads found. Try adjusting your search criteria.</div>
                  <Button 
                    onClick={() => router.push("/campaign/setup")}
                    variant="outline"
                    className="mt-4"
                  >
                    Return to Campaign Setup
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {/* Log the rendering of businesses */}
                  {(() => { console.log(`Rendering table with ${businesses.length} businesses`); return null; })()}
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/50 bg-secondary/20">
                        <th className="py-2 px-3 text-left w-10"></th>
                        <th className="py-2 px-3 text-left font-medium text-foreground/90">Name</th>
                        <th className="py-2 px-3 text-left font-medium text-foreground/90">Address</th>
                        <th className="py-2 px-3 text-left font-medium text-foreground/90">Phone</th>
                        <th className="py-2 px-3 text-left font-medium text-foreground/90 w-44">Website</th>
                        <th className="py-2 px-3 text-left font-medium text-foreground/90">Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {businesses.map((business, index) => {
                        console.log(`Rendering business ${index}: ${business.name}`);
                        // Generate a safe ID for businesses without one
                        const businessId = business.id || `business-${business.name.replace(/\s+/g, '-').toLowerCase()}`;
                        
                        const website = business.website || business.contact?.website;
                        const truncatedWebsite = website ? truncateUrl(website, 28) : '';
                        
                        return (
                          <tr 
                            key={businessId} 
                            className={`border-b border-border/30 hover:bg-secondary/30 transition-colors 
                                        ${selectedLeads.includes(businessId) ? 'bg-secondary/20' : ''}`}
                          >
                            <td className="py-2 px-3">
                              <Checkbox
                                checked={selectedLeads.includes(businessId)}
                                onCheckedChange={() => toggleLeadSelection(businessId)}
                                className="border-purple-500/50 data-[state=checked]:bg-purple-500 data-[state=checked]:text-white"
                              />
                            </td>
                            <td className="py-2 px-3 font-medium">{business.name}</td>
                            <td className="py-2 px-3 text-foreground/90 text-sm">{business.address}</td>
                            <td className="py-2 px-3 text-foreground/90 text-sm">
                              {business.phone ? (
                                <a 
                                  href={`tel:${business.phone}`} 
                                  className="text-blue-500 hover:underline"
                                >
                                  {business.phone}
                                </a>
                              ) : business.contact?.phone ? (
                                <a 
                                  href={`tel:${business.contact.phone}`} 
                                  className="text-blue-500 hover:underline"
                                >
                                  {business.contact.phone}
                                </a>
                              ) : (
                                <span className="text-gray-400">Not available</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-foreground/90 text-sm">
                              {website ? (
                                <a 
                                  href={website} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-500 hover:underline block max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap"
                                  title={website}
                                >
                                  {truncatedWebsite}
                                </a>
                              ) : (
                                <span className="text-gray-400">Not available</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-foreground/90">
                              <Badge variant="outline" className="bg-secondary/40 border-purple-500/20 text-foreground/80">
                                {business.category ? business.category : business.hasEventSpace ? "Event Space" : (business.type || "Business")}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {!loading && businesses.length > 0 && (
                <div className="p-3 mt-1 flex justify-between items-center border-t border-border/30">
                  <div className="text-sm text-muted-foreground flex items-center">
                    <div className="w-2 h-2 rounded-full bg-purple-500 mr-2"></div>
                    {selectedLeads.length} of {businesses.length} leads selected
                  </div>

                  <Button
                    onClick={handleEnrichLeads}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-ai-glow transition-all duration-300 transform hover:scale-105"
                    disabled={selectedLeads.length === 0}
                  >
                    <span className="mr-2">Enrich Selected Leads</span>
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
                      <path d="M5 12h14"></path>
                      <path d="m12 5 7 7-7 7"></path>
                    </svg>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

