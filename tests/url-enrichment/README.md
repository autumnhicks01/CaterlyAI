# URL Enrichment Test

This test module provides a simplified implementation of the lead enrichment process with real-time progress tracking. It demonstrates the improved workflow for processing venue websites:

1. Extract content using Firecrawl
2. Process with GPT-4o for analysis
3. Generate lead scoring data 
4. Save enrichment results

## Usage

### Command Line Usage
```bash
# Run from project root
pnpm test:url-enrichment
```

### Integration in Pages

```tsx
import { UrlEnrichmentTest } from "../../tests/url-enrichment/ui";

export default function TestPage() {
  return (
    <div>
      <h1>URL Enrichment Test</h1>
      <UrlEnrichmentTest />
    </div>
  );
}
```

### Programmatic Usage

```typescript
import { processUrl, waitForCompletion } from "../../tests/url-enrichment";

async function enrichUrl(url: string) {
  try {
    // Start the enrichment process
    const { jobId } = await processUrl(url);
    
    // Wait for completion with status updates
    const result = await waitForCompletion(jobId, (status, progress) => {
      console.log(`Status: ${status}, Progress: ${progress}%`);
    });
    
    console.log("Enrichment complete:", result);
    return result;
  } catch (error) {
    console.error("Enrichment failed:", error);
    throw error;
  }
}
```

## Test Implementation Details

This test implementation simulates the actual enrichment process with realistic delays:

- URL validation: ~500ms
- Content extraction (Firecrawl): ~3 seconds
- AI processing (GPT-4o): ~4 seconds 
- Data formatting and enrichment: ~1 second

Total processing time: ~8-9 seconds per URL

## API Endpoints

The test implementation includes two API endpoints:

- `POST /api/tests/enrich-url`: Start the enrichment process with a URL
- `GET /api/tests/enrich-status/:jobId`: Check the status of an enrichment job

## Notes

- This implementation uses an in-memory job storage for simplicity
- In production, jobs would be stored in a database for persistence
- The simulated content extraction and AI analysis provide realistic examples
- The UI component shows progress in real-time with status updates 