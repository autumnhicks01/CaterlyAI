"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircleIcon, InfoIcon, ExternalLinkIcon, SendIcon, Loader2, RefreshCw } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { useCaterly } from "@/app/context/caterly-context"
import { mapToOutreachCategory } from "@/config/categoryMapping"
import axios from 'axios'
import { toast } from "@/hooks/use-toast"
import { businessService } from "@/lib/services/businessService"

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
  category?: string | null;
}

export default function EnrichedLeadsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  const [selectAll, setSelectAll] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isEnriching, setIsEnriching] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<'success' | 'warning' | 'error'>('success')
  const [loadingMessage, setLoadingMessage] = useState<string>('')
  const [statusMessage, setStatusMessage] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [enrichmentProgress, setEnrichmentProgress] = useState<number>(0)
  const [processingLeads, setProcessingLeads] = useState<string[]>([])

  const { setCampaign, setEnrichedLeads, setProfile } = useCaterly()
  const [isLaunchingCampaign, setIsLaunchingCampaign] = useState(false)

  // Show status message function similar to campaign-launch-page
  const showStatus = (message: string, isError = false) => {
    setStatusMessage({
      message,
      type: isError ? 'error' : 'success'
    });
    console.log(isError ? `Error: ${message}` : message);
    
    // Show toast notification
    toast({
      title: isError ? "Error" : "Success",
      description: message,
      variant: isError ? "destructive" : "default",
    });
    
    // Auto clear after 3 seconds
    setTimeout(() => {
      setStatusMessage(null);
    }, 3000);
  };

  // Fetch initial data and check for enrichment status
  useEffect(() => {
    // Check URL query parameters for loading state
    const status = searchParams.get('status');
    const count = searchParams.get('count');
    
    if (status === 'loading' && count) {
      setIsLoading(true);
      setLoadingMessage(`Enriching ${count} leads...`);
      
      // Block navigation during enrichment
      window.onbeforeunload = (e) => {
        e.preventDefault();
        e.returnValue = 'Enrichment in progress. Are you sure you want to leave?';
        return 'Enrichment in progress. Are you sure you want to leave?';
      };
      
      // Check localStorage for enrichment status updates
      const checkEnrichmentStatus = () => {
        const enrichmentStatus = localStorage.getItem('enrichment_status');
        const enrichmentCount = localStorage.getItem('enrichment_count');
        const enrichmentError = localStorage.getItem('enrichment_error');
        const startTime = localStorage.getItem('enrichment_start_time');
        
        console.log('Checking enrichment status:', {
          status: enrichmentStatus,
          count: enrichmentCount,
          error: enrichmentError,
          startTime
        });
        
        // If we have a status, process it
        if (enrichmentStatus) {
          if (enrichmentStatus === 'success') {
            setIsLoading(false);
            setLoadingMessage('');
            
            // Fetch the newly enriched leads
            console.log('Enrichment successful, fetching updated leads...');
            fetchLeads();
            
            setSuccessMessage(`Successfully enriched ${enrichmentCount} leads`);
            setMessageType('success');
            
            // Clear localStorage status
            localStorage.removeItem('enrichment_status');
            localStorage.removeItem('enrichment_count');
            localStorage.removeItem('enrichment_time');
            localStorage.removeItem('enrichment_error');
            localStorage.removeItem('enrichment_start_time');
            
            // Update URL to remove loading state
            router.replace('/leads/enriched');
          } else if (enrichmentStatus === 'error') {
            setIsLoading(false);
            setLoadingMessage('');
            setError(enrichmentError || 'Failed to enrich leads');
            setMessageType('error');
            
            // Try to fetch any enriched leads anyway in case some were successful
            fetchLeads();
            
            // Clear localStorage status
            localStorage.removeItem('enrichment_status');
            localStorage.removeItem('enrichment_count');
            localStorage.removeItem('enrichment_time');
            localStorage.removeItem('enrichment_error');
            localStorage.removeItem('enrichment_start_time');
            
            // Update URL to remove loading state
            router.replace('/leads/enriched');
          }
          
          // Clear the checking interval
          clearInterval(statusInterval);
        } else if (startTime) {
          // Calculate how long we've been waiting
          const start = new Date(startTime);
          const now = new Date();
          const elapsedSeconds = Math.floor((now.getTime() - start.getTime()) / 1000);
          
          // If we've been waiting more than 2 minutes, show a timeout error
          if (elapsedSeconds > 120) {
            setIsLoading(false);
            setLoadingMessage('');
            setError('Enrichment timed out. Please try again with fewer leads.');
            setMessageType('error');
            
            // Try to fetch any enriched leads anyway in case some were successful
            fetchLeads();
            
            // Clear localStorage status
            localStorage.removeItem('enrichment_status');
            localStorage.removeItem('enrichment_count');
            localStorage.removeItem('enrichment_time');
            localStorage.removeItem('enrichment_error');
            localStorage.removeItem('enrichment_start_time');
            
            // Update URL to remove loading state
            router.replace('/leads/enriched');
            
            // Clear the interval
            clearInterval(statusInterval);
          } else {
            // Update loading message with elapsed time
            setLoadingMessage(`Enriching ${count} leads... (${elapsedSeconds} seconds)`);
          }
        }
      };
      
      // Check status every 2 seconds
      const statusInterval = setInterval(checkEnrichmentStatus, 2000);
      
      // Initial check
      checkEnrichmentStatus();
      
      // Clean up interval and navigation blocker on unmount
      return () => {
        clearInterval(statusInterval);
        window.onbeforeunload = null;
      };
    } else {
      // Normal page load - fetch leads
      fetchLeads();
    }
  }, [searchParams, router]);

  // Fetch saved leads from Supabase
  async function fetchLeads(checkingForCompletion = false) {
    try {
      setIsRefreshing(true)
      setError(null)
      
      // Check if there's an active enrichment process going on
      const enrichmentStatus = localStorage.getItem('enrichment_status');
      const isFirecrawlProcessing = localStorage.getItem('firecrawl_processing') === 'true';
      
      // Force loading state if we're in processing mode
      if (isFirecrawlProcessing) {
        setIsLoading(true);
        const loadingMsg = localStorage.getItem('firecrawl_loading_message') || 'Processing leads...';
        setLoadingMessage(loadingMsg);
        
        // Block clicking on leads during processing
        if (window.location.pathname !== '/leads/enriched' || 
            !window.location.search.includes('status=loading')) {
          // If somehow we ended up on a different page, redirect back to loading page
          console.log('[ENRICHED-PAGE] Redirecting back to loading page during processing');
          const leadCount = localStorage.getItem('enrichment_count') || '0';
          router.replace(`/leads/enriched?status=loading&count=${leadCount}`);
          return false;
        }
      }
      
      const response = await fetch('/api/leads/enriched')
      
      if (!response.ok) {
        throw new Error(`Failed to fetch enriched leads: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log('[ENRICHED-PAGE] Fetched leads:', data.leads?.length)
      
      // Critical change: Never transition out of loading state if firecrawl is still processing
      // Even if we have started seeing some enriched leads
      if (isFirecrawlProcessing) {
        // Just update the leads data but STAY in loading state
        if (data.leads && data.leads.length > 0) {
          // Get the IDs of the leads being processed
          const processingIds = JSON.parse(localStorage.getItem('enrichment_leads') || '[]');
          
          // Check if all the leads we're processing are now enriched
          const enrichedCount = data.leads.filter((lead: Lead) => 
            processingIds.includes(lead.id) && 
            lead.status === 'enriched' && 
            lead.enrichment_data
          ).length;
          
          // Only exit loading state if ALL leads are enriched
          if (processingIds.length > 0 && enrichedCount >= processingIds.length) {
            console.log(`[ENRICHED-PAGE] All ${enrichedCount}/${processingIds.length} leads are now enriched`);
            
            // Clear the processing state
            localStorage.removeItem('firecrawl_processing');
            localStorage.removeItem('firecrawl_total_leads');
            localStorage.removeItem('firecrawl_expected_duration');
            localStorage.removeItem('firecrawl_start_time');
            localStorage.removeItem('enrichment_leads');
            localStorage.removeItem('firecrawl_loading_message');
            
            // Remove navigation blocker
            window.onbeforeunload = null;
            
            // Set success state
            localStorage.setItem('enrichment_status', 'success');
            setIsLoading(false);
            setLoadingMessage('');
            
            // Show success toast
            toast({
              title: "Enrichment Complete",
              description: `Successfully enriched ${enrichedCount} leads with Firecrawl`,
              variant: "default",
            });
            
            // If we're just checking, return true to indicate completion
            if (checkingForCompletion) {
              setIsRefreshing(false);
              return true;
            }
            
            // Update URL to remove loading state
            router.replace('/leads/enriched');
          } else {
            // Not all leads are enriched yet, stay in loading state
            console.log(`[ENRICHED-PAGE] Progress: ${enrichedCount}/${processingIds.length} leads enriched`);
            
            // Update loading message with progress
            if (processingIds.length > 0) {
              const progressPercent = Math.round((enrichedCount / processingIds.length) * 100);
              const loadingMessage = `Processing leads: ${progressPercent}% complete (${enrichedCount}/${processingIds.length})`;
              setLoadingMessage(loadingMessage);
              localStorage.setItem('firecrawl_loading_message', loadingMessage);
            }
            
            // Set the leads data but remain in loading state
            if (data.leads) {
              // Sort leads by lead score (highest first)
              const sortedLeads = [...data.leads].sort((a: Lead, b: Lead) => {
                const scoreA = a.lead_score || 0
                const scoreB = b.lead_score || 0
                return scoreB - scoreA
              });
              
              setLeads(sortedLeads);
            }
            
            // Return false (not complete yet)
            if (checkingForCompletion) {
              setIsRefreshing(false);
              return false;
            }
          }
        }
        
        // If we reach here and we're still processing, 
        // ensure we remain in loading state and return appropriately
        if (checkingForCompletion) {
          setIsRefreshing(false);
          return false;
        }
        
        // Always make sure we're in loading state if firecrawl is processing
        setIsLoading(true);
        return false;
      }
      
      // Normal flow (no Firecrawl processing)
      // Verify all leads have 'enriched' status and enrichment_data
      if (data.leads && data.leads.length > 0) {
        const notEnriched = data.leads.filter((lead: Lead) => lead.status !== 'enriched')
        const missingData = data.leads.filter((lead: Lead) => !lead.enrichment_data)
        
        if (notEnriched.length > 0) {
          console.warn(`[ENRICHED-PAGE] ${notEnriched.length} leads don't have 'enriched' status`)
        }
        
        if (missingData.length > 0) {
          console.warn(`[ENRICHED-PAGE] ${missingData.length} leads are missing enrichment_data`)
        }
        
        // Sort leads by lead score (highest first)
        const sortedLeads = [...data.leads].sort((a: Lead, b: Lead) => {
          const scoreA = a.lead_score || 0
          const scoreB = b.lead_score || 0
          return scoreB - scoreA
        })
        
        setLeads(sortedLeads)
      } else {
        setLeads([])
      }
      
      // Reset selection state
      setSelectedLeads([])
      setSelectAll(false)
      
      // Return false to indicate not complete (if we're checking)
      return false;
    } catch (err) {
      console.error('[ENRICHED-PAGE] Error fetching enriched leads:', err)
      setError(err instanceof Error ? err.message : 'Failed to load enriched leads')
      setLeads([]) // Clear leads on error
      return false;
    } finally {
      setIsRefreshing(false)
      // Only set isLoading to false if not in the middle of Firecrawl processing
      const isFirecrawlProcessing = localStorage.getItem('firecrawl_processing') === 'true';
      if (!isFirecrawlProcessing) {
        setIsLoading(false)
      }
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
      showStatus('Please select at least one lead to enrich', true);
      return;
    }
    
    try {
      setIsEnriching(true);
      setProcessingLeads(selectedLeads);
      setLoadingMessage(`Starting enrichment for ${selectedLeads.length} leads...`);
      setEnrichmentProgress(5);
      
      // Store the processing lead IDs for checking completion later
      localStorage.setItem('enrichment_leads', JSON.stringify(selectedLeads));
      
      // Create a new, more informative URL
      router.replace(`/leads/enriched?status=loading&count=${selectedLeads.length}`);
      
      // Fetch the selected leads from the database
      const response = await fetch('/api/leads/saved', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch leads: ${response.status}`);
      }
      
      const { leads } = await response.json();
      
      // Filter to just the selected leads
      const selectedLeadsData = leads.filter((lead: any) => selectedLeads.includes(lead.id));
      
      if (selectedLeadsData.length === 0) {
        throw new Error('No lead data found for the selected leads');
      }
      
      setLoadingMessage(`Processing ${selectedLeadsData.length} leads...`);
      setEnrichmentProgress(20);
      
      // Use the businessService to enrich the leads
      const enrichmentResult = await businessService.enrichBusinesses(selectedLeadsData);
      
      // Handle success or failure
      if (enrichmentResult.error) {
        throw new Error(enrichmentResult.error);
      }
      
      const enrichedLeads = enrichmentResult.businesses || [];
      
      // Calculate successful email count
      const emailCount = enrichedLeads.filter((lead: any) => 
        lead.contact_email || (lead.enrichment_data && lead.enrichment_data.eventManagerEmail)
      ).length;
      
      setEnrichmentProgress(100);
      
      // Clear processing state
      setIsEnriching(false);
      setLoadingMessage('');
      
      // Show success message
      setSuccessMessage(`Successfully enriched ${enrichedLeads.length} leads${
        emailCount > 0 ? ` (${emailCount} with emails)` : ''
      }`);
      setMessageType('success');
      
      // Show toast notification
      toast({
        title: "Enrichment Complete",
        description: `Successfully enriched ${enrichedLeads.length} leads${
          emailCount > 0 ? ` (${emailCount} with emails)` : ''
        }`,
        variant: "default",
      });
      
      // Reset selected leads
      setSelectedLeads([]);
      
      // Refresh the leads list to show the newly enriched data
      fetchLeads();
      
      // Update URL to remove loading state
      router.replace('/leads/enriched');
      
    } catch (error) {
      console.error('[ENRICHED-PAGE] Error enriching leads:', error);
      
      // Update error state
      setIsEnriching(false);
      setLoadingMessage('');
      setSuccessMessage('');
      setEnrichmentProgress(0);
      
      // Show error message
      setMessageType('error');
      setError(error instanceof Error ? error.message : 'An error occurred while enriching leads');
      
      // Show toast notification
      toast({
        title: "Enrichment Failed",
        description: error instanceof Error ? error.message : 'An error occurred while enriching leads',
        variant: "destructive",
      });
      
      // Update URL to remove loading state
      router.replace('/leads/enriched');
    }
  };

  // Add a function to poll for completion of the enrichment process
  const startPollingForCompletion = () => {
    console.log('[ENRICHED-PAGE] Starting polling for enrichment completion');
    
    // Create a polling interval that checks for completion
    const pollingInterval = setInterval(async () => {
      try {
        // Check if we've exceeded the timeout
        const startTimeStr = localStorage.getItem('firecrawl_start_time');
        const expectedDurationStr = localStorage.getItem('firecrawl_expected_duration');
        
        if (startTimeStr && expectedDurationStr) {
          const startTime = parseInt(startTimeStr, 10);
          const expectedDuration = parseInt(expectedDurationStr, 10);
          const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
          
          // Update the progress based on elapsed time vs expected duration
          const progressPercent = Math.min(90, Math.round((elapsedSeconds / expectedDuration) * 100));
          setEnrichmentProgress(progressPercent);
          
          // Update loading message with time info
          const timeRemaining = Math.max(0, expectedDuration - elapsedSeconds);
          setLoadingMessage(`Firecrawl processing: ${progressPercent}% complete. ${Math.ceil(timeRemaining/60)} minutes remaining...`);
          
          // Check if we need to fetch the leads to see if they're done
          const checkingLeads = await fetchLeads(true);
          
          // If leads are fully enriched, we're done
          if (checkingLeads) {
            console.log('[ENRICHED-PAGE] Polling detected completed leads, stopping');
            clearInterval(pollingInterval);
            
            // Remove processing flags
            localStorage.removeItem('firecrawl_processing');
            localStorage.removeItem('firecrawl_total_leads');
            localStorage.removeItem('firecrawl_expected_duration');
            localStorage.removeItem('firecrawl_start_time');
            
            // Set success state
            localStorage.setItem('enrichment_status', 'success');
            setSuccessMessage(`Successfully enriched leads with Firecrawl`);
            setMessageType('success');
            setIsEnriching(false);
            setLoadingMessage('');
            setEnrichmentProgress(100);
            
            // Remove URL params
            router.replace('/leads/enriched');
            
            return;
          }
          
          // If we're past the timeout, assume it's done (or stuck)
          if (elapsedSeconds > expectedDuration * 1.5) {
            console.log('[ENRICHED-PAGE] Polling exceeded max duration, assuming complete');
            clearInterval(pollingInterval);
            
            // Remove processing flags
            localStorage.removeItem('firecrawl_processing');
            localStorage.removeItem('firecrawl_total_leads');
            localStorage.removeItem('firecrawl_expected_duration');
            localStorage.removeItem('firecrawl_start_time');
            
            // Set completion state
            localStorage.setItem('enrichment_status', 'success');
            setSuccessMessage(`Enrichment process completed`);
            setMessageType('success');
            setIsEnriching(false);
            setLoadingMessage('');
            setEnrichmentProgress(100);
            
            // Refresh leads to see final state
            fetchLeads();
            
            // Remove URL params
            router.replace('/leads/enriched');
          }
        }
      } catch (error) {
        console.error('[ENRICHED-PAGE] Error in polling:', error);
      }
    }, 10000); // Check every 10 seconds
    
    // Store the interval ID for cleanup
    return pollingInterval;
  };

  // Navigate to lead profile page
  const viewLeadProfile = (leadId: string) => {
    // Don't allow navigation if we're in the middle of processing
    if (isLoading || localStorage.getItem('firecrawl_processing') === 'true') {
      console.log('[ENRICHED-PAGE] Navigation blocked during processing');
      return;
    }
    
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

  // Truncate URL to a maximum length
  const truncateUrl = (url: string | null, maxLength: number = 180): string => {
    if (!url) return 'Not available';
    if (url.length <= maxLength) return url;
    return url.slice(0, maxLength) + '...';
  };

  // Add a function to launch the AI campaign with selected leads
  const launchAICampaign = async () => {
    try {
      setIsLaunchingCampaign(true);
      showStatus("Creating AI campaign...");
      
      // Get selected leads
      if (!selectedLeads.length) {
        showStatus("Please select at least one lead", true);
        return;
      }
      
      // Get full data for selected leads
      const selectedLeadsData = leads.filter(lead => selectedLeads.includes(lead.id));
      
      // Organize leads by category
      const leadsByCategory: { [key: string]: Lead[] } = {};
      
      for (const lead of selectedLeadsData) {
        // Get the category for outreach
        let outreachCategory = mapToOutreachCategory(lead.category || "");
        
        // Initialize category array if needed
        if (!leadsByCategory[outreachCategory]) {
          leadsByCategory[outreachCategory] = [];
        }
        
        leadsByCategory[outreachCategory].push(lead);
      }
      
      // Create a campaign object with the leads grouped by category
      const campaignData = {
        name: `AI Campaign - ${new Date().toLocaleDateString()}`,
        eventType: Object.keys(leadsByCategory)[0] || "corporate", // Default to first category
        targetCategories: Object.keys(leadsByCategory),
        location: "",
        radius: 50,
      };
      
      // Format the leads for the campaign context
      const formattedLeadsData = selectedLeadsData.map(lead => ({
        id: typeof lead.id === 'string' ? parseInt(lead.id, 10) : lead.id,
        name: lead.name || "",
        company: lead.name || "",
        location: lead.address || "",
        category: mapToOutreachCategory(lead.category || ""),
        description: lead.enrichment_data?.aiOverview || "",
        website: lead.website_url || lead.enrichment_data?.website || "",
        contact: {
          email: lead.contact_email || lead.enrichment_data?.eventManagerEmail || "",
          phone: lead.contact_phone || lead.enrichment_data?.eventManagerPhone || "",
        }
      }));
      
      // Get profile first
      console.log("Fetching user profile for campaign...");
      let profileData: any = null;
      
      try {
        // Fetch the profile for the current user
        const profileResponse = await fetch('/api/profile/current');
        
        if (profileResponse.ok) {
          const profileDataResult = await profileResponse.json();
          const profileSource = profileDataResult.profile || profileDataResult;
          const userInputData = profileSource.user_input_data || {};
          
          // Normalize fields to match the expected Profile structure
          profileData = {
            companyName: profileSource.business_name || profileSource.companyName || userInputData.businessName || "",
            menuLink: profileSource.menuLink || profileSource.website_url || userInputData.website || "",
            managerContact: profileSource.managerContact || userInputData.managerContact || userInputData.ownerContact || "",
            orderingLink: profileSource.orderingLink || profileSource.website_url || "",
            focus: profileSource.focus || userInputData.cuisineSpecialties || userInputData.serviceTypes || "",
            description: profileSource.description || userInputData.uniqueSellingPoints || "",
            idealClients: profileSource.idealClients || userInputData.idealClients || "",
            location: profileSource.full_address || profileSource.location || "",
            photos: [], // Required by Profile type, but not needed for API
          };
        } else {
          throw new Error(`Failed to fetch profile: ${profileResponse.status}`);
        }
      } catch (error) {
        console.error("Error getting user profile:", error);
        
        // Fallback to empty profile with required fields
        profileData = {
          companyName: "", 
          menuLink: "",
          managerContact: "",
          orderingLink: "",
          focus: "",
          description: "", 
          idealClients: "",
          location: "",
          photos: [], // Required by Profile type, but not needed for API
        };
        
        showStatus("Warning: Using default profile data", true);
      }
      
      // Store campaign data in context
      setCampaign(campaignData);
      setEnrichedLeads(formattedLeadsData);
      setProfile(profileData);
      
      // Pre-generate templates for all categories before navigating
      const categories = Object.keys(leadsByCategory);
      console.log(`Pre-generating templates for ${categories.length} categories: ${categories.join(', ')}`);
      
      // Initialize template store in memory
      const templatesByCategory: Record<string, any[]> = {};
      let successCount = 0;
      
      // Generate templates for each category in parallel
      await Promise.all(
        categories.map(async (category) => {
          try {
            showStatus(`Generating templates for ${category}...`);
            
            // Get leads for this category
            const categoryLeads = formattedLeadsData.filter(lead => 
              lead.category.toLowerCase() === category.toLowerCase()
            );
            
            // Create request payload
            const payload = {
              category,
              leads: categoryLeads,
              profile: profileData,
              requestId: `${category}-${Date.now()}`
            };
            
            // Make API call
            const response = await fetch('/api/outreach/start', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-csrf-protection': '1',
                'x-request-id': payload.requestId
              },
              credentials: 'include',
              body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
              throw new Error(`Failed to generate templates for ${category}: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Process templates
            if (data.success) {
              let templates: string[] = [];
              
              // Handle different response formats
              if (data.templates?.templates) {
                templates = data.templates.templates;
              } else if (data.data?.emailTemplates?.[category]) {
                templates = data.data.emailTemplates[category];
              } else if (Array.isArray(data.templates)) {
                templates = data.templates;
              }
              
              if (templates.length > 0) {
                templatesByCategory[category] = templates;
                successCount++;
                showStatus(`Generated ${templates.length} templates for ${category}`);
              }
            }
          } catch (error) {
            console.error(`Error generating templates for ${category}:`, error);
            showStatus(`Failed to generate templates for ${category}`, true);
          }
        })
      );
      
      // After template generation, navigate to campaign page
      console.log("Template generation complete. Navigating to campaign page.");
      showStatus(`Successfully created campaign with ${formattedLeadsData.length} leads across ${successCount} categories.`);
      
      // Navigate to the campaign launch page
      router.push('/campaign/launch');
      
    } catch (error) {
      console.error("Error launching AI campaign:", error);
      showStatus("Failed to launch AI campaign. Please try again.", true);
    } finally {
      setIsLaunchingCampaign(false);
    }
  };

  return (
    <div className="container mx-auto p-4 pb-24">
      {/* Title and Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h1 className="text-2xl font-bold mb-4 md:mb-0">Enriched Leads</h1>
        
        <div className="flex flex-col sm:flex-row gap-2">
          {!isLoading && (
            <Button 
              onClick={launchAICampaign} 
              disabled={selectedLeads.length === 0 || isLaunchingCampaign || isLoading} 
              className="w-full sm:w-auto"
            >
              {isLaunchingCampaign ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <SendIcon className="mr-2 h-4 w-4" />
                  Launch Campaign
                </>
              )}
            </Button>
          )}
        </div>
      </div>
      
      {/* Loading overlay - render over everything when isLoading is true */}
      {isLoading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <Card className="w-[90%] max-w-md mx-auto p-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl text-center">Enriching Leads</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="flex justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
              <div className="w-full bg-secondary rounded-full h-2.5">
                <div 
                  className="bg-primary h-2.5 rounded-full transition-all duration-500" 
                  style={{ width: `${enrichmentProgress}%` }} 
                />
              </div>
              <p className="text-muted-foreground">{loadingMessage}</p>
              <p className="text-sm text-muted-foreground mt-4">
                This may take several minutes. Please don't close this page.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Status message notification */}
      {statusMessage && (
        <div className={`fixed top-4 right-4 p-4 rounded-md shadow-md z-50 max-w-md animate-fade-in ${
          statusMessage.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
        }`}>
          {statusMessage.message}
        </div>
      )}
      
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
        
        {successMessage && (
          <Alert className={`mb-6 ${
            messageType === 'success' ? 'bg-green-50/80 border border-green-200 text-green-800' :
            messageType === 'warning' ? 'bg-amber-50/80 border border-amber-200 text-amber-800' :
            'bg-red-50/80 border border-red-200 text-red-800'
          } max-w-7xl mx-auto`}>
            <span className={`h-5 w-5 ${
              messageType === 'success' ? 'text-green-600' :
              messageType === 'warning' ? 'text-amber-600' :
              'text-red-600'
            }`}>
              {messageType === 'success' ? '✓' : 
               messageType === 'warning' ? '⚠️' : 
               '❌'}
            </span>
            <AlertDescription className="ml-2">{successMessage}</AlertDescription>
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
                  <p className="text-lg mt-6 gradient-text-blue">{loadingMessage}</p>
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
                                className="text-blue-500 hover:underline block max-w-[180px] text-ellipsis whitespace-nowrap overflow-hidden"
                              >
                                {truncateUrl(lead.website_url)}
                              </a>
                            ) : lead.enrichment_data?.website ? (
                              <a 
                                href={lead.enrichment_data.website.startsWith('http') ? lead.enrichment_data.website : `https://${lead.enrichment_data.website}`}
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:underline block max-w-[180px] text-ellipsis whitespace-nowrap overflow-hidden"
                              >
                                {truncateUrl(lead.enrichment_data.website)}
                              </a>
                            ) : (
                              <span className="text-gray-400">Not available</span>
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
                              className={`text-white text-sm py-1 ${
                                lead.enrichment_data ? 
                                "bg-gradient-to-r from-purple-600 to-blue-600" : 
                                "bg-gradient-to-r from-amber-500 to-orange-600"
                              }`}
                              title={!lead.enrichment_data ? "This lead hasn't been enriched yet" : ""}
                            >
                              {lead.enrichment_data ? "View Profile" : "View (Not Enriched)"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
} 