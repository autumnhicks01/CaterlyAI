"use client"

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Download, Image, FileText, Sparkles } from 'lucide-react'
import { ProfileResponse } from '@/app/marketing/ai-profile/[id]/page'

interface AIFlyerGeneratorProps {
  profileId: string;
  profileData: any;
  aiProfileData: ProfileResponse;
}

export default function AIFlyerGenerator({
  profileId,
  profileData,
  aiProfileData
}: AIFlyerGeneratorProps) {
  const [generating, setGenerating] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [marketingConcept, setMarketingConcept] = useState<string>('')
  const [refinedCopy, setRefinedCopy] = useState<string>('')
  const [imageUrl, setImageUrl] = useState<string>('')
  const [streamComplete, setStreamComplete] = useState<boolean>(false)
  const [currentSection, setCurrentSection] = useState<string>('idle')
  const streamOutputRef = useRef<HTMLDivElement>(null)
  
  // Function to handle the streaming response
  const handleStream = async (stream: ReadableStream) => {
    setGenerating(true)
    setError(null)
    setMarketingConcept('')
    setRefinedCopy('')
    setImageUrl('')
    setStreamComplete(false)
    setCurrentSection('marketing')
    
    try {
      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let result = ''
      let currentSectionContent = ''
      
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        
        // Handle different types of chunk data
        let chunk: string;
        if (value instanceof Uint8Array) {
          // If it's already a Uint8Array, decode it
          chunk = decoder.decode(value, { stream: true });
        } else if (typeof value === 'string') {
          // If it's already a string, use it directly
          chunk = value;
        } else if (value && typeof value === 'object') {
          // For other object types, try to stringify
          try {
            chunk = JSON.stringify(value);
          } catch (e) {
            console.warn('Could not stringify stream value:', e);
            chunk = String(value);
          }
        } else {
          // For any other type, convert to string
          chunk = String(value || '');
        }
        
        result += chunk
        console.log("Stream chunk:", chunk.substring(0, 100)); // Log the beginning of each chunk for debugging
        
        // Determine which section we're in based on markers in the stream
        if (chunk.includes('## MARKETING CONCEPT ##')) {
          setCurrentSection('marketing')
          currentSectionContent = ''
        } else if (chunk.includes('## REFINED COPY ##')) {
          // Save marketing concept and start collecting refined copy
          setMarketingConcept(currentSectionContent.trim())
          setCurrentSection('refined')
          currentSectionContent = ''
        } else if (chunk.includes('## GENERATING FLYER IMAGE ##')) {
          // Save refined copy and start waiting for image
          setRefinedCopy(currentSectionContent.trim())
          setCurrentSection('image')
          currentSectionContent = ''
        } else if (chunk.includes('## FLYER IMAGE URL ##')) {
          setCurrentSection('url')
          currentSectionContent = ''
        } else if (chunk.includes('## FLYER_DATA_JSON ##')) {
          // Extract and process the JSON data
          const jsonMatch = result.match(/## FLYER_DATA_JSON ##\s*\n\n([\s\S]*?)$/);
          if (jsonMatch && jsonMatch[1]) {
            try {
              const jsonData = JSON.parse(jsonMatch[1].trim());
              console.log("Extracted JSON data:", jsonData);
              if (jsonData.imageUrl) {
                setImageUrl(jsonData.imageUrl);
                console.log("Setting image URL to:", jsonData.imageUrl);
              }
              if (jsonData.marketingConcept) {
                setMarketingConcept(jsonData.marketingConcept);
              }
              if (jsonData.refinedCopy) {
                setRefinedCopy(jsonData.refinedCopy);
              }
            } catch (e) {
              console.error("Error parsing JSON data from stream:", e)
            }
          }
          break
        } else {
          // Add to current section's content
          currentSectionContent += chunk
          
          // If we're in the URL section, try to extract the URL
          if (currentSection === 'url' && !imageUrl) {
            // Look for a URL in the current section content
            const urlMatch = currentSectionContent.trim().match(/^(https?:\/\/\S+)$/);
            if (urlMatch && urlMatch[1]) {
              const extractedUrl = urlMatch[1];
              console.log("Extracted image URL from stream:", extractedUrl);
              setImageUrl(extractedUrl);
            }
          }
        }
        
        // Scroll to the bottom of the output
        if (streamOutputRef.current) {
          streamOutputRef.current.scrollTop = streamOutputRef.current.scrollHeight
        }
      }
      
      // Check if we still don't have an image URL
      if (!imageUrl) {
        // Try one more time to extract URL from the complete result
        const fullUrlMatch = result.match(/## FLYER IMAGE URL ##\s*\n\n(https?:\/\/\S+)/);
        if (fullUrlMatch && fullUrlMatch[1]) {
          console.log("Extracted image URL from complete result:", fullUrlMatch[1]);
          setImageUrl(fullUrlMatch[1]);
        }
      }
      
      // Ensure the stream complete state is set regardless
      setStreamComplete(true);
      setGenerating(false);
      
      console.log("Stream processing complete. Image URL:", imageUrl);
      
    } catch (error: any) {
      console.error("Error handling stream:", error)
      setError(`Error generating flyer: ${error.message}`)
      setGenerating(false)
    }
  }
  
  // Function to generate the flyer
  const generateFlyer = async () => {
    try {
      setGenerating(true)
      setError(null)
      
      // Extract business name and other essential info
      const businessName = profileData.business_name || 
                           profileData.businessName || 
                           aiProfileData?.tagline?.split(' - ')?.[0] || 
                           "Catering Business";
      
      // Prepare data for the API
      const data = {
        profileId,
        profileData: {
          businessName,
          // Include profile data
          ...(typeof profileData === 'object' ? profileData : {}),
          // Include AI profile data if available
          ...(aiProfileData ? aiProfileData : {}),
          // Ensure contact information is available
          contactInformation: {
            ...(profileData.contactInformation || {}),
            phone: profileData.contact_phone || profileData.contactInformation?.phone || "",
            email: profileData.email || profileData.contactInformation?.email || "",
            website: profileData.website_url || profileData.contactInformation?.website || ""
          }
        }
      }
      
      console.log("Sending flyer generation data:", JSON.stringify({
        businessName: data.profileData.businessName,
        hasTagline: !!data.profileData.tagline,
        hasEnhancedDescription: !!data.profileData.enhancedDescription
      }));
      
      // Call the API endpoint with streaming support
      const response = await fetch('/api/profile/flyer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })
      
      if (!response.ok || !response.body) {
        throw new Error(`API error: ${response.status}`)
      }
      
      // Handle the stream
      await handleStream(response.body)
    } catch (error: any) {
      console.error("Error generating flyer:", error)
      setError(`Failed to generate flyer: ${error.message}`)
      setGenerating(false)
    }
  }
  
  // Function to download the image
  const downloadImage = async () => {
    if (!imageUrl) return
    
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      // Use a better filename with dimensions included
      const businessName = profileData.business_name || profileData.businessName || 'catering';
      a.download = `${businessName.replace(/\s+/g, '-').toLowerCase()}-promotional-flyer.png`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      a.remove()
    } catch (error) {
      console.error("Error downloading image:", error)
      setError("Failed to download image. Please try again or right-click the image to save it.")
    }
  }
  
  return (
    <Card className="w-full border border-purple-500/20 bg-secondary/10 backdrop-blur-sm shadow-medium overflow-hidden">
      <CardHeader className="border-b border-border/50 bg-secondary/30">
        <CardTitle className="flex items-center">
          <Image className="w-5 h-5 mr-2 text-purple-500" />
          AI Marketing Flyer Generator
        </CardTitle>
        <CardDescription>
          Generate a professional promotional flyer for your catering business using AI
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {!generating && !imageUrl && (
          <div className="text-center py-8">
            <Sparkles className="h-16 w-16 mx-auto mb-4 text-purple-500 opacity-60" />
            <h3 className="text-xl font-medium mb-2">Create a Professional Flyer</h3>
            <p className="text-muted-foreground mb-6">
              Our AI will design a beautiful promotional flyer based on your business profile.
              The flyer will showcase your catering services with appealing imagery and compelling text.
              The process includes concept creation, copy refinement, and image generation.
            </p>
            <Button 
              onClick={generateFlyer}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Flyer
            </Button>
          </div>
        )}
        
        {generating && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Spinner size="sm" className="text-purple-500" />
              <span>
                {currentSection === 'marketing' && 'Creating marketing concept...'}
                {currentSection === 'refined' && 'Refining copy...'}
                {currentSection === 'image' && 'Generating flyer image...'}
                {currentSection === 'url' && 'Finalizing flyer...'}
              </span>
            </div>
            <div 
              ref={streamOutputRef}
              className="bg-black/20 rounded-md p-4 h-[300px] overflow-y-auto font-mono text-sm whitespace-pre-wrap"
            >
              {currentSection === 'marketing' && marketingConcept}
              {currentSection === 'refined' && refinedCopy}
              {currentSection === 'image' && 'Creating your beautiful flyer image...'}
            </div>
          </div>
        )}
        
        {!generating && imageUrl && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-medium">Your AI-Generated Flyer</h3>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline" className="bg-purple-500/10 text-purple-600">
                  Promotional Design
                </Badge>
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600">
                  Compelling Copy
                </Badge>
                <Badge variant="outline" className="bg-green-500/10 text-green-600">
                  Catering-focused
                </Badge>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center">
                  <FileText className="h-4 w-4 mr-1 text-blue-500" />
                  Flyer Concept
                </h4>
                <div className="bg-black/20 rounded-md p-4 h-[300px] overflow-y-auto whitespace-pre-wrap text-sm">
                  {marketingConcept}
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="text-sm font-medium mb-2 flex items-center">
                  <Image className="h-4 w-4 mr-1 text-blue-500" />
                  Flyer Image
                </h4>
                <div className="bg-black/20 rounded-md p-2 overflow-hidden relative">
                  {imageUrl ? (
                    <div className="relative" style={{ width: '100%' }}>
                      <img 
                        src={imageUrl} 
                        alt="Generated Flyer" 
                        className="w-full h-auto rounded-md border border-gray-200"
                      />
                      <div className="absolute bottom-4 right-4 flex gap-2">
                        <Button 
                          variant="secondary"
                          size="sm"
                          className="bg-black/60 hover:bg-black/80 text-white"
                          onClick={downloadImage}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center">
                      <p className="text-muted-foreground">Image not available</p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  This is a preview - download the image for the full-resolution promotional flyer
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="border-t border-border/50 bg-secondary/30 flex justify-between">
        <div className="text-xs text-muted-foreground">
          Generated using DALL-E 3 image model
        </div>
        {!generating && imageUrl && (
          <Button
            variant="outline"
            size="sm"
            onClick={generateFlyer}
          >
            <Sparkles className="h-3 w-3 mr-1" />
            Regenerate
          </Button>
        )}
      </CardFooter>
    </Card>
  )
} 