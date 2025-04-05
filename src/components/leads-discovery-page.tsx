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
    category: business.hasEventSpace ? "Event Space" : (business.type || "Business"),
    description: business.description || "",
    contact: business.contact,
    website: business.contact?.website || "",
    address: business.address,
    hasEventSpace: business.hasEventSpace,
    photos: business.photos
  };
};

export default function LeadsDiscoveryPage() {
  const router = useRouter()
  const { setLeads, campaign } = useCaterly()
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  const [selectAll, setSelectAll] = useState(false)
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        // Build query from campaign categories
        const categoryQueries = campaign.targetCategories || [];
        let query = categoryQueries.length > 0 
          ? categoryQueries.join(" OR ") 
          : "event venue OR wedding venue";

        // Execute the search
        const result = await businessService.searchBusinesses({
          query,
          radius: campaign.radius,
          coordinates: campaign.coordinates as any
        });

        // If component was unmounted during the search, do nothing
        if (!mounted) return;

        if (result.error) {
          throw new Error(result.error);
        }

        if (result.businesses && result.businesses.length > 0) {
          // Limit to 20 results for faster rendering
          const limitedResults = result.businesses.slice(0, 20);
          setBusinesses(limitedResults);
        } else {
          setError("No businesses found matching your criteria.");
        }
      } catch (err) {
        console.error("Error fetching businesses:", err);
        setError("Failed to load businesses. Please try again later.");
      } finally {
        if (mounted) {
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
    try {
      setLoading(true);
      setError(null);
      
      // Select the businesses that match the selected IDs
      const selectedBusinesses = businesses.filter(business => 
        selectedLeads.includes(business.id || '')
      );
      
      if (selectedBusinesses.length === 0) {
        setError("Please select at least one lead to enrich.");
        setLoading(false);
        return;
      }
      
      console.log(`Starting enrichment process for ${selectedBusinesses.length} leads`);
      
      // First, enrich the data using the AI agent via OpenAI
      // This step adds enrichment data to the business objects
      try {
        const enrichResult = await businessService.enrichBusinesses(selectedBusinesses);
        
        if (enrichResult.error) {
          throw new Error(enrichResult.error);
        }
        
        // Extract enriched businesses
        const enrichedBusinesses = enrichResult.businesses || [];
        console.log(`Successfully enriched ${enrichedBusinesses.length} businesses`);
        
        let successMessage = "";
        let saveSuccessful = false;
        
        // Now save the enriched businesses to Supabase
        try {
          const saveResponse = await fetch('/api/leads/save', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              businesses: enrichedBusinesses,
              skipEnrichment: false // Indicating these are already enriched
            }),
          });
          
          if (!saveResponse.ok) {
            const errorData = await saveResponse.json();
            console.error('Save response error:', errorData);
            successMessage = `Leads were enriched but couldn't be saved. ${errorData.error || ''}`;
          } else {
            // Get the saved leads data
            const saveData = await saveResponse.json();
            console.log('Leads saved successfully:', saveData);
            saveSuccessful = true;
            successMessage = `Successfully enriched and saved ${saveData.count || selectedBusinesses.length} leads`;
          }
        } catch (saveErr) {
          console.error("Error in save process:", saveErr);
          successMessage = "Leads were enriched but couldn't be saved due to a server error";
        }
        
        // Clear loading state before redirecting
        setLoading(false);
        
        // Navigate to enriched leads page with appropriate message
        router.push(`/leads/enriched?success=${encodeURIComponent(successMessage)}&status=${saveSuccessful ? 'success' : 'warning'}`);
      } catch (err) {
        console.error("Error in enrichment process:", err);
        setError(err instanceof Error ? err.message : 'An error occurred while processing leads');
        setLoading(false);
        
        // Still redirect to enriched leads page, but with error message
        router.push(`/leads/enriched?error=${encodeURIComponent(err instanceof Error ? err.message : 'Failed to enrich leads')}`);
      }
    } catch (err) {
      console.error("Error handling leads:", err);
      setError(err instanceof Error ? err.message : 'An error occurred while handling leads');
      setLoading(false);
      
      // Always redirect to enriched leads page
      router.push('/leads/enriched?error=Failed to process leads');
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
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/50 bg-secondary/20">
                        <th className="py-2 px-3 text-left w-10"></th>
                        <th className="py-2 px-3 text-left font-medium text-foreground/90">Name</th>
                        <th className="py-2 px-3 text-left font-medium text-foreground/90">Address</th>
                        <th className="py-2 px-3 text-left font-medium text-foreground/90">Website</th>
                        <th className="py-2 px-3 text-left font-medium text-foreground/90">Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {businesses.map((business) => {
                        // Generate a safe ID for businesses without one
                        const businessId = business.id || `business-${business.name.replace(/\s+/g, '-').toLowerCase()}`;
                        
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
                              {business.contact?.website ? (
                                <a 
                                  href={business.contact.website} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-500 hover:underline"
                                >
                                  {business.contact.website.replace(/^https?:\/\/(www\.)?/, '')}
                                </a>
                              ) : (
                                <span className="text-gray-400">Not available</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-foreground/90">
                              <Badge variant="outline" className="bg-secondary/40 border-purple-500/20 text-foreground/80">
                                {business.hasEventSpace ? "Event Space" : (business.type || "Business")}
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

