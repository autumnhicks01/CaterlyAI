import { createTool } from 'ai'
import OpenAI from 'openai'
import { EnrichmentInput, EnrichmentResponse } from '@/types/business'

export const openAIEnrichmentTool = createTool({
  name: 'openai-enrichment',
  description: 'Enrich business data (phone, website, desc) using GPT-like calls',
  schema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      address: { type: 'string' },
      phone: { type: 'string' },
      website: { type: 'string' }
    },
    required: ['name', 'address']
  },
  execute: async ({ name, address, phone, website }: EnrichmentInput): Promise<EnrichmentResponse> => {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a business researcher. Extract missing business details."
          },
          {
            role: "user",
            content: `Research this business and provide missing information:
              Name: ${name}
              Address: ${address}
              Phone: ${phone || 'Unknown'}
              Website: ${website || 'Unknown'}
              
              Provide:
              1. Most likely website URL (if missing)
              2. Brief description of business type and services
              3. Whether this business likely hosts events
              
              Format as JSON with fields: website, description, phoneNumber, hasEventSpace`
          }
        ],
        response_format: { type: "json_object" }
      })
      
      const result = JSON.parse(completion.choices[0].message.content) as EnrichmentResponse
      
      return {
        ...result,
        website: website || result.website || '',
        phone: phone || result.phoneNumber || ''
      }
    } catch (error) {
      console.error('OpenAI enrichment error:', error)
      return { error: String(error) }
    }
  }
})