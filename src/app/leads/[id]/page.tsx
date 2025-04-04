import LeadProfilePage from "@/components/lead-profile-page"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

// Get lead data from Supabase
async function getLead(id: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("saved_leads")
    .select("*")
    .eq("id", id)
    .single()
    
  if (error || !data) {
    return null
  }
  
  return data
}

export default async function LeadPage({ params }: { params: { id: string } }) {
  const lead = await getLead(params.id)
  
  if (!lead) {
    notFound()
  }

  return <LeadProfilePage lead={lead} />
} 