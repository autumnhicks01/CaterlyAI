// Import the LangSmith initialization module to set up tracing
import '@/lib/langsmith-init';
import { createTracedOpenAIClient, createTraceableFunction } from '@/lib/langsmith-client';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    
    // Get traced OpenAI client
    const openai = await createTracedOpenAIClient();
    
    // Create a traced chat function
    const tracedChat = await createTraceableFunction(
      'chat-api-completion',
      async (messages: any[]) => {
        // Call OpenAI with tracing
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages,
          temperature: 0.7,
          stream: false,
        });
        
        return response.choices[0].message.content || '';
      }
    );
    
    // Execute the traced function
    const content = await tracedChat(messages);
    
    // Return the response
    return NextResponse.json({ content });
  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    );
  }
} 