'use client';

import { useState, useEffect } from 'react';
import { Business } from '@/types/business';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, MapPin, Phone, Globe, Building, CheckCircle, Clock } from 'lucide-react';

/**
 * Streaming Business Search Component
 * 
 * This component performs a business search with streaming results,
 * showing businesses as they become available for faster user experience.
 */
export function StreamingBusinessSearch({ 
  query, 
  location, 
  radius = 25,
  onResultsComplete 
}: { 
  query: string; 
  location: string; 
  radius?: number;
  onResultsComplete?: (businesses: Business[]) => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<{ step: string; message: string; count?: number; total?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  
  // Start the search with streaming
  const startSearch = async () => {
    if (!query || !location) {
      setError('Query and location are required');
      return;
    }
    
    setIsLoading(true);
    setBusinesses([]);
    setError(null);
    setProgress({ step: 'starting', message: 'Starting search...' });
    
    try {
      // Call the streaming API endpoint
      const response = await fetch(`/api/leads/streaming?query=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}&radius=${radius}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to search for businesses');
      }
      
      // Get the response body as a readable stream
      const reader = response.body?.getReader();
      
      if (!reader) {
        throw new Error('Stream reader not available');
      }
      
      // Process the stream chunks
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete lines from the buffer
        const lines = buffer.split('\n');
        
        // Keep the last line if it's incomplete
        buffer = lines.pop() || '';
        
        // Process complete lines
        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const data = JSON.parse(line);
            
            // Handle progress updates
            if (data.type === 'progress') {
              setProgress({
                step: data.step,
                message: data.message,
                count: data.count,
                total: data.total
              });
            }
            
            // Handle business data
            else if (data.type === 'business' && data.data) {
              const newBusiness = data.data;
              setBusinesses(prev => [...prev, newBusiness]);
            }
            
            // Handle completion
            else if (data.type === 'complete') {
              setProgress({ 
                step: 'complete', 
                message: data.message || 'Search complete',
                count: data.results?.length || businesses.length,
                total: data.results?.length || businesses.length
              });
              
              // Update with complete results
              if (data.results && Array.isArray(data.results)) {
                setBusinesses(data.results);
                if (onResultsComplete) {
                  onResultsComplete(data.results);
                }
              }
            }
            
            // Handle errors
            else if (data.type === 'error') {
              setError(data.error || 'An error occurred during the search');
            }
          } catch (e) {
            console.error('Error parsing stream line:', e);
          }
        }
      }
      
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred during the search');
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (query && location) {
      startSearch();
    }
  }, []);
  
  return (
    <div className="space-y-4">
      <Card className="w-full">
        <CardHeader className="pb-2">
          <CardTitle className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-purple-500" />
              <span>Streaming Business Search</span>
            </div>
            {isLoading && (
              <Badge variant="outline" className="bg-amber-100/30 text-amber-800 border-amber-300 animate-pulse">
                Streaming Results...
              </Badge>
            )}
            {!isLoading && businesses.length > 0 && (
              <Badge variant="outline" className="bg-green-100/30 text-green-800 border-green-300">
                {businesses.length} Businesses Found
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Progress indicator */}
          {progress && (
            <div className="mb-4 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-md">
              <div className="flex items-center gap-2 mb-1">
                {isLoading ? (
                  <Clock className="h-4 w-4 text-amber-500 animate-pulse" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
                <span className="font-medium">{progress.step}</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{progress.message}</p>
              
              {progress.count !== undefined && progress.total !== undefined && (
                <div className="mt-2">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div 
                      className="bg-gradient-to-r from-purple-600 to-blue-600 h-2.5 rounded-full" 
                      style={{ width: `${Math.min(100, (progress.count / progress.total * 100))}%` }}
                    />
                  </div>
                  <div className="text-xs mt-1 text-gray-500 dark:text-gray-400 text-right">
                    {progress.count} of {progress.total}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-800 dark:text-red-300">
              {error}
            </div>
          )}
          
          {/* Businesses list */}
          {businesses.length > 0 ? (
            <div className="space-y-3">
              {businesses.map((business, index) => (
                <div 
                  key={business.id || index} 
                  className="p-3 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex justify-between">
                    <h3 className="font-medium text-lg">{business.name}</h3>
                    <Badge variant="outline" className="bg-secondary/40 border-purple-500/20 text-foreground/80">
                      {business.hasEventSpace ? "Event Space" : (business.type || "Business")}
                    </Badge>
                  </div>
                  
                  <div className="flex items-start gap-2 mt-2 text-sm text-gray-600 dark:text-gray-400">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{business.address}</span>
                  </div>
                  
                  {business.contact?.phone && (
                    <div className="flex items-center gap-2 mt-2 text-sm">
                      <Phone className="h-4 w-4 text-blue-500" />
                      <a href={`tel:${business.contact.phone}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                        {business.contact.phone}
                      </a>
                    </div>
                  )}
                  
                  {business.contact?.website && (
                    <div className="flex items-center gap-2 mt-2 text-sm">
                      <Globe className="h-4 w-4 text-blue-500" />
                      <a 
                        href={business.contact.website.startsWith('http') ? business.contact.website : `https://${business.contact.website}`} 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {business.contact.website.replace(/^https?:\/\/(www\.)?/, '')}
                      </a>
                    </div>
                  )}
                  
                  {business.description && (
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                      {business.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : isLoading ? (
            // Loading skeletons
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="p-3 border border-gray-200 dark:border-gray-800 rounded-lg">
                  <div className="flex justify-between">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                  <Skeleton className="h-4 w-full mt-2" />
                  <Skeleton className="h-4 w-32 mt-2" />
                  <Skeleton className="h-4 w-40 mt-2" />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center p-8 text-gray-500 dark:text-gray-400">
              {query && location ? 'No businesses found' : 'Enter search criteria to find businesses'}
            </div>
          )}
          
          {/* Retry button */}
          {!isLoading && (
            <div className="mt-4 flex justify-center">
              <Button 
                onClick={startSearch}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-ai-glow transition-all duration-300"
              >
                {businesses.length > 0 ? 'Refresh Results' : 'Start Search'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 