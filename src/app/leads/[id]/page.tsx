import LeadProfilePage from "@/components/lead-profile-page"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

// Get lead data from Supabase
async function getLead(id: string) {
  console.log(`Fetching lead with ID: ${id}`)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("saved_leads")
    .select("*")
    .eq("id", id)
    .single()
    
  if (error) {
    console.error(`Error fetching lead ${id}:`, error)
    return null
  }
  
  if (!data) {
    console.log(`No lead found with ID: ${id}`)
    return null
  }
  
  console.log(`Successfully fetched lead: ${data.name}`)
  return data
}

export default async function LeadPage({ params }: { params: { id: string } }) {
  const lead = await getLead(params.id)
  
  if (!lead) {
    console.log(`Lead not found, redirecting to 404 page`)
    notFound()
  }

  return <LeadProfilePage lead={lead} />
} 