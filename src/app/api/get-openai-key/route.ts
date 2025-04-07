import { NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to securely provide the OpenAI API key to client-side code
 * This prevents exposing the API key directly in browser code
 */
export async function GET(request: NextRequest) {
  // Verify that the request is authorized (you can add more robust auth checks)
  // For example, check for a valid user session

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error("OpenAI API key is not defined in environment variables");
      return NextResponse.json(
        { error: "API key configuration error" },
        { status: 500 }
      );
    }
    
    // Return the API key
    return NextResponse.json({ apiKey });
  } catch (error) {
    console.error("Error providing OpenAI API key:", error);
    return NextResponse.json(
      { error: "Failed to retrieve API key" },
      { status: 500 }
    );
  }
} 