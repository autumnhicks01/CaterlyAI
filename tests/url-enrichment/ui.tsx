"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, CheckCircle, XCircle, Info } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { processUrl, waitForCompletion, getProgressFromStatus } from "./index"
import { EnrichmentResult } from "./types"

/**
 * URL Enrichment Test Component
 * 
 * A self-contained test UI for the lead enrichment process
 */
export function UrlEnrichmentTest() {
  const [url, setUrl] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState<string>("")
  const [progress, setProgress] = useState<number>(0)
  const [result, setResult] = useState<EnrichmentResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const { toast } = useToast()

  // Function to add a log message
  const addLog = (message: string) => {
    console.log(message)
    setLogs(prev => [...prev, `${new Date().toISOString().slice(11, 19)} - ${message}`])
  }

  // Start the enrichment process
  async function handleProcessUrl() {
    if (!url) {
      toast({
        title: "Error",
        description: "Please enter a URL",
        variant: "destructive",
      })
      return
    }

    try {
      // Reset state
      setIsProcessing(true)
      setError(null)
      setResult(null)
      setLogs([])
      setStatus("Validating URL")
      setProgress(10)
      addLog(`Starting enrichment process for URL: ${url}`)

      // Step 1: Start the job
      addLog("Calling API to start enrichment job...")
      const { jobId } = await processUrl(url)
      addLog(`Job created with ID: ${jobId}`)
      
      // Step 2: Wait for completion with status updates
      addLog("Waiting for job to complete...")
      const result = await waitForCompletion(jobId, (status, progress) => {
        setStatus(status)
        setProgress(progress)
        addLog(`Status update: ${status} (${progress}%)`)
      })
      
      // Success!
      setStatus("Complete")
      setProgress(100)
      setResult(result)
      addLog("Enrichment process completed successfully")
      addLog(`Lead score: ${result.lead_score?.score || 0} (${result.lead_score?.potential || 'unknown'} potential)`)
      toast({
        title: "Success",
        description: "URL has been processed successfully",
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred"
      console.error("Error processing URL:", err)
      addLog(`ERROR: ${errorMessage}`)
      setError(errorMessage)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>URL Enrichment Test</CardTitle>
          <CardDescription>
            Test the new lead enrichment process with a single URL
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter website URL (e.g., https://venue-name.com)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isProcessing}
              className="flex-1"
            />
            <Button onClick={handleProcessUrl} disabled={isProcessing || !url}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing
                </>
              ) : (
                "Process URL"
              )}
            </Button>
          </div>

          {/* Log panel */}
          <div className="mt-4 border rounded-md">
            <div className="bg-muted p-2 border-b flex justify-between items-center">
              <h3 className="text-sm font-medium">Process Logs</h3>
              {logs.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setLogs([])}
                >
                  Clear
                </Button>
              )}
            </div>
            <div 
              className="p-2 text-xs font-mono bg-muted/30 h-[120px] overflow-y-auto" 
            >
              {logs.length > 0 ? (
                logs.map((log, index) => (
                  <div 
                    key={index} 
                    className={`py-0.5 ${log.includes('ERROR') ? 'text-red-500' : ''}`}
                  >
                    {log}
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground italic">Logs will appear here...</div>
              )}
            </div>
          </div>
          
          {isProcessing && (
            <div className="mt-6 space-y-4">
              <div className="flex justify-between text-sm">
                <span>{status}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-secondary h-2 rounded-full">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                Extracting content and analyzing with AI...
              </div>
            </div>
          )}
          
          {error && (
            <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 rounded-md flex items-start gap-3">
              <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-destructive">Error occurred</h3>
                <p className="text-sm text-destructive/80">{error}</p>
              </div>
            </div>
          )}
          
          {result && (
            <div className="mt-6 border rounded-md p-4">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <h3 className="font-medium">Enrichment Complete</h3>
              </div>
              
              {/* Full JSON Output */}
              <div className="bg-muted p-4 rounded-md max-h-[500px] overflow-auto">
                <pre className="text-xs">{JSON.stringify(result, null, 2)}</pre>
              </div>
              
              <div className="mt-6 flex items-center">
                <Info className="h-4 w-4 mr-2 text-blue-500" />
                <span className="text-sm text-muted-foreground">
                  This JSON data would be stored in the <code className="bg-muted px-1 py-0.5 rounded text-xs">enrichment_data</code> field of the lead
                </span>
              </div>
              
              <div className="mt-4 pt-4 border-t">
                <h3 className="font-medium mb-3">Key Extracted Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div>
                      <h4 className="text-sm font-medium">Lead Score</h4>
                      <div className="mt-1 text-3xl font-bold">
                        {result.lead_score?.score || 0}
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                          ({result.lead_score?.potential || 'unknown'} potential)
                        </span>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium">Venue Type</h4>
                      <p className="text-sm">{result.domain?.includes('restaurant') ? 'Restaurant' 
                        : result.domain?.includes('hotel') ? 'Hotel' 
                        : result.domain?.includes('wedding') ? 'Wedding Venue' 
                        : 'General Venue'}</p>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium">Domain</h4>
                      <p className="text-sm">{result.domain}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <h4 className="text-sm font-medium">Contact Person</h4>
                      <p className="text-sm">{result.event_manager_name || 'Not detected'}</p>
                      {result.event_manager_email && (
                        <p className="text-xs text-blue-600">{result.event_manager_email}</p>
                      )}
                      {result.event_manager_phone && (
                        <p className="text-xs">{result.event_manager_phone}</p>
                      )}
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium">Venue Details</h4>
                      <div className="flex gap-4 text-xs">
                        {result.venue_capacity && (
                          <span>Capacity: {result.venue_capacity}</span>
                        )}
                        <span>
                          In-house Catering: {result.in_house_catering ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium">Event Types</h4>
                      <div className="flex gap-1 flex-wrap mt-1">
                        {result.common_event_types?.map((type, i) => (
                          <span 
                            key={i} 
                            className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs"
                          >
                            {type}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4">
                  <h4 className="text-sm font-medium">AI Overview</h4>
                  <p className="mt-1 text-sm">{result.ai_overview || 'No overview available'}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between text-xs text-muted-foreground">
          <div>Results shown here represent the JSON that would be stored in <code>enrichment_data</code></div>
          <div>Tests use simulated data during development</div>
        </CardFooter>
      </Card>
    </div>
  )
} 