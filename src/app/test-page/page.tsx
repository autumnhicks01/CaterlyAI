"use client"

import { UrlEnrichmentTest } from "../../../tests/url-enrichment/ui"

export default function TestPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">URL Enrichment Test Page</h1>
      <p className="mb-8 text-muted-foreground">
        This page demonstrates the new lead enrichment process that extracts website content
        using Firecrawl, processes it with GPT-4o, and generates enrichment data.
      </p>
      
      <UrlEnrichmentTest />
    </div>
  )
} 