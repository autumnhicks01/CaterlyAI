import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

const SERPER_API_KEY = process.env.SERPER_API_KEY || process.env.NEXT_PUBLIC_SERPER_API_KEY;

/**
 * Handler for web search API requests
 * Uses Serper.dev Google Search API to find business websites
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate the user
    const session = await auth();
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    // Get the search query from URL parameters
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q');
    
    if (!query) {
      return NextResponse.json(
        { error: "Search query is required" },
        { status: 400 }
      );
    }
    
    console.log(`Search API request for: "${query}"`);
    
    // If we have a Serper API key, use it
    if (SERPER_API_KEY) {
      try {
        const response = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': SERPER_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            q: query,
            num: 5
          })
        });
        
        if (!response.ok) {
          throw new Error(`Serper API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log(`Search returned ${data.organic?.length || 0} organic results`);
        
        return NextResponse.json({
          results: data.organic?.map((result: any) => ({
            title: result.title,
            link: result.link,
            snippet: result.snippet
          })) || [],
          count: data.organic?.length || 0
        });
      } catch (error) {
        console.error("Error with Serper API:", error);
        // Fall back to the fallback search method below
      }
    }
    
    // Fallback to a simpler search approach (limited functionality)
    console.log("Using fallback search method (limited to prepopulated results)");
    
    // This is a very basic fallback that searches for venues in a predefined list
    // In a real app, you'd have a more sophisticated fallback
    const venueWebsites: Record<string, string> = {
      "The Farm at 95": "https://thefarmat95.com",
      "The Cotton Room": "https://thecottonroomdurham.com",
      "Carrollock Farms": "https://carrollockfarms.com",
      "Rose Hill Estate": "https://visitrosehill.com",
      "Rand-Bryan House": "https://rand-bryanhouse.com",
      "The Evermore": "https://theevermoreevents.com"
    };
    
    // Check if query contains any known venue names
    const results = Object.keys(venueWebsites)
      .filter(venueName => query.toLowerCase().includes(venueName.toLowerCase()))
      .map(venueName => ({
        title: venueName,
        link: venueWebsites[venueName],
        snippet: `Official website for ${venueName}`
      }));
    
    // If no direct matches, do fuzzy matching on venue names
    if (results.length === 0) {
      // Simple fuzzy match by finding venues where parts of the query match parts of the venue name
      const queryWords = query.toLowerCase().split(/\s+/);
      
      const fuzzyMatches = Object.keys(venueWebsites)
        .filter(venueName => {
          const venueWords = venueName.toLowerCase().split(/\s+/);
          return queryWords.some(qWord => 
            venueWords.some(vWord => vWord.includes(qWord) || qWord.includes(vWord))
          );
        })
        .map(venueName => ({
          title: venueName,
          link: venueWebsites[venueName],
          snippet: `Official website for ${venueName}`
        }));
      
      results.push(...fuzzyMatches);
    }
    
    return NextResponse.json({
      results,
      count: results.length,
      fallback: true
    });
  } catch (error) {
    console.error("Error in search API:", error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error occurred" },
      { status: 500 }
    );
  }
} 