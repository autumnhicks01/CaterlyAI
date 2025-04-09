import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { firecrawlTool } from '@/tools/firecrawl';

/**
 * POST handler for extracting website content
 * 
 * This endpoint uses firecrawl to extract content from a website
 * without needing to store data in the database
 */
export async function POST(req: NextRequest) {
  // Authenticate the user session
  const session = await auth();
  
  if (!session || !session.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }
  
  try {
    // Parse the request body
    const { url, minimal = false } = await req.json();
    
    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }
    
    console.log(`Extracting content from ${url}, minimal mode: ${minimal}`);
    
    // Use firecrawl to extract website content
    const extractionOptions = {
      urls: [url]
    };
    
    const extractionResult = await firecrawlTool.extract(extractionOptions);
    
    if (!extractionResult.success) {
      return NextResponse.json(
        { error: extractionResult.error || "Extraction failed" },
        { status: 500 }
      );
    }
    
    // Extract content from the result
    let content = '';
    
    if (extractionResult.data) {
      if (typeof extractionResult.data.content === 'string') {
        content = extractionResult.data.content;
      } else if (extractionResult.data.formats) {
        // Try to get content from various formats
        content = extractionResult.data.formats.text || 
                 extractionResult.data.formats.markdown || 
                 extractionResult.data.formats.html || '';
      } else if (Array.isArray(extractionResult.data.content)) {
        // Join array content
        content = extractionResult.data.content
          .filter((item: any) => item && (item.content || item.text))
          .map((item: any) => item.content || item.text)
          .join('\n\n');
      }
    }
    
    // Return the extracted content
    return NextResponse.json({
      success: true,
      content,
      url,
      metadata: extractionResult.data.metadata || {},
      contentLength: content.length
    });
  } catch (error) {
    console.error("Error in extract-website API:", error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error occurred" },
      { status: 500 }
    );
  }
} 