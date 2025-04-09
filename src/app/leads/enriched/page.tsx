import { Suspense } from "react"
import EnrichedLeadsPage from "@/components/enriched-leads-page"

export default function EnrichedLeads() {
  return (
    <Suspense fallback={<div className="container mx-auto py-6">Loading enriched leads...</div>}>
      <EnrichedLeadsPage />
    </Suspense>
  )
} 