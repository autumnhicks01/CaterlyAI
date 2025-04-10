import { UrlEnrichmentTest } from "../../../tests/url-enrichment/ui";

export default function TestUrlEnrichmentPage() {
  return (
    <div className="container py-10">
      <h1 className="text-2xl font-bold mb-8">URL Enrichment Test Page</h1>
      <p className="mb-6 text-muted-foreground">
        This page allows you to test the URL enrichment API with real Firecrawl and OpenAI API calls.
      </p>
      
      <UrlEnrichmentTest />
    </div>
  );
} 