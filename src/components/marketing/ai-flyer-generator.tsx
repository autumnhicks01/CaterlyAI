"use client"

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Download, Image, FileText, Sparkles, Share2 } from 'lucide-react'
import { ProfileResponse } from '@/app/marketing/ai-profile/[id]/page'

interface AISocialMediaGeneratorProps {
  profileId: string;
  profileData: any;
  aiProfileData: ProfileResponse;
}

export default function AISocialMediaGenerator({
  profileId,
  profileData,
  aiProfileData
}: AISocialMediaGeneratorProps) {
  const [generating, setGenerating] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [marketingConcept, setMarketingConcept] = useState<string>('')
  const [socialMediaCaption, setSocialMediaCaption] = useState<string>('')
  const [processedCaption, setProcessedCaption] = useState<string>('')
  const [imageUrl, setImageUrl] = useState<string>('')
  const [streamComplete, setStreamComplete] = useState<boolean>(false)
  const [currentSection, setCurrentSection] = useState<string>('idle')
  const streamOutputRef = useRef<HTMLDivElement>(null)
  
  // Function to clean caption by removing JSON data
  const cleanCaption = (caption: string) => {
    if (!caption) return '';
    
    // If caption contains 'IMAGE GENERATION DATA:', remove it and everything after
    const jsonMarker = caption.indexOf('IMAGE GENERATION DATA:');
    if (jsonMarker !== -1) {
      return caption.substring(0, jsonMarker).trim();
    }
    
    // If caption contains a JSON object in the format of {, try to remove it
    const jsonStart = caption.indexOf('{');
    if (jsonStart !== -1) {
      const jsonEnd = caption.lastIndexOf('}');
      if (jsonEnd > jsonStart) {
        // Check if there's text before the JSON
        if (jsonStart > 0) {
          return caption.substring(0, jsonStart).trim();
        }
        // Check if there's text after the JSON
        if (jsonEnd < caption.length - 1) {
          return caption.substring(jsonEnd + 1).trim();
        }
        // If it's just JSON, return empty string
        return '';
      }
    }
    
    return caption.trim();
  };
  
  // Update processed caption whenever socialMediaCaption changes
  useEffect(() => {
    setProcessedCaption(cleanCaption(socialMediaCaption));
  }, [socialMediaCaption]);
  
  // Function to handle the streaming response
  const handleStream = async (stream: ReadableStream) => {
    setGenerating(true)
    setError(null)
    setMarketingConcept('')
    setSocialMediaCaption('')
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
        } else if (chunk.includes('## SOCIAL MEDIA CAPTION ##')) {
          // Save marketing concept and start collecting social caption
          setMarketingConcept(currentSectionContent.trim())
          setCurrentSection('caption')
          currentSectionContent = ''
        } else if (chunk.includes('## GENERATING SOCIAL MEDIA IMAGE ##')) {
          // Save social caption and start waiting for image
          setSocialMediaCaption(currentSectionContent.trim())
          setCurrentSection('image')
          currentSectionContent = ''
        } else if (chunk.includes('## SOCIAL MEDIA IMAGE URL ##')) {
          setCurrentSection('url')
          currentSectionContent = ''
        } else if (chunk.includes('## SOCIAL_MEDIA_DATA_JSON ##')) {
          // Extract and process the JSON data
          const jsonMatch = result.match(/## SOCIAL_MEDIA_DATA_JSON ##\s*\n\n([\s\S]*?)$/);
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
              if (jsonData.socialMediaCaption) {
                setSocialMediaCaption(jsonData.socialMediaCaption);
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
        const fullUrlMatch = result.match(/## SOCIAL MEDIA IMAGE URL ##\s*\n\n(https?:\/\/\S+)/);
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
      setError(`Error generating social media post: ${error.message}`)
      setGenerating(false)
    }
  }
  
  // Function to generate the social media post
  const generateSocialMedia = async () => {
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
      
      console.log("Sending social media generation data:", JSON.stringify({
        businessName: data.profileData.businessName,
        hasTagline: !!data.profileData.tagline,
        hasEnhancedDescription: !!data.profileData.enhancedDescription
      }));
      
      // Call the API endpoint with streaming support
      const response = await fetch('/api/profile/social-media', {
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
      console.error("Error generating social media post:", error)
      setError(`Failed to generate social media post: ${error.message}`)
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
      a.download = `${businessName.replace(/\s+/g, '-').toLowerCase()}-social-media-post.png`
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
          <Share2 className="w-5 h-5 mr-2 text-purple-500" />
          AI Social Media Post Generator
        </CardTitle>
        <CardDescription>
          Generate a professional social media post for your catering business using AI
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
            <h3 className="text-xl font-medium mb-2">Create a Social Media Post</h3>
            <p className="text-muted-foreground mb-6">
              Our AI will design a beautiful social media post based on your business profile.
              The post will showcase your catering services with appealing imagery and compelling caption.
              The process includes concept creation, caption writing, and image generation.
            </p>
            <Button 
              onClick={generateSocialMedia}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Social Post
            </Button>
          </div>
        )}
        
        {generating && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Spinner size="sm" className="text-purple-500" />
              <span>
                {currentSection === 'marketing' && 'Creating marketing concept...'}
                {currentSection === 'caption' && 'Writing social media caption...'}
                {currentSection === 'image' && 'Generating post image...'}
                {currentSection === 'url' && 'Finalizing social media post...'}
              </span>
            </div>
            <div 
              ref={streamOutputRef}
              className="bg-gradient-to-b from-purple-50 to-blue-50 rounded-md p-6 h-[300px] overflow-y-auto font-medium text-sm whitespace-pre-wrap shadow-inner border border-purple-100"
            >
              {currentSection === 'marketing' && marketingConcept}
              {currentSection === 'caption' && processedCaption}
              {currentSection === 'image' && (
                <div className="flex flex-col items-center justify-center h-full">
                  <Spinner size="lg" className="text-purple-500 mb-4" />
                  <p className="text-center text-purple-700 font-medium">Creating your beautiful social media image...</p>
                  <p className="text-center text-purple-500 mt-2 text-sm">This may take a moment</p>
                </div>
              )}
            </div>
          </div>
        )}
        
        {!generating && imageUrl && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-medium">Your AI-Generated Social Media Post</h3>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline" className="bg-purple-500/10 text-purple-600">
                  Eye-catching Design
                </Badge>
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600">
                  Engaging Caption
                </Badge>
                <Badge variant="outline" className="bg-green-500/10 text-green-600">
                  Catering-focused
                </Badge>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center">
                  <FileText className="h-4 w-4 mr-1 text-blue-500" />
                  Social Media Caption
                </h4>
                <div className="bg-gradient-to-b from-purple-50 to-blue-50 rounded-md p-6 h-auto min-h-[300px] overflow-y-auto whitespace-pre-wrap text-sm border border-purple-100 shadow-sm">
                  {processedCaption}
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center">
                  <Image className="h-4 w-4 mr-1 text-blue-500" />
                  Social Media Image
                </h4>
                <div className="bg-gradient-to-b from-purple-50 to-blue-50 rounded-md p-4 overflow-hidden relative border border-purple-100 shadow-sm flex items-center justify-center">
                  {imageUrl ? (
                    <div className="relative max-w-[350px] mx-auto">
                      <img 
                        src={imageUrl} 
                        alt="Generated Social Media Post" 
                        className="w-full h-auto rounded-md"
                      />
                      <div className="absolute bottom-2 right-2 flex gap-2">
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
              </div>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="border-t border-border/50 bg-secondary/30 flex justify-between">
        <div className="text-xs text-muted-foreground">
          Generated using Flux Schnell image model
        </div>
        {!generating && imageUrl && (
          <Button
            variant="outline"
            size="sm"
            onClick={generateSocialMedia}
          >
            <Sparkles className="h-3 w-3 mr-1" />
            Regenerate
          </Button>
        )}
      </CardFooter>
    </Card>
  )
} 