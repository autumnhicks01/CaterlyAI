"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCaterly, useCatering } from "../app/context/caterly-context"
import { Badge } from "@/components/ui/badge"

// Dummy data for leads
const dummyLeads = [
  { id: 1, name: "John Doe", company: "ABC Corporation", location: "New York, NY", category: "Corporate Events" },
  { id: 2, name: "Sarah Williams", company: "Elegant Weddings", location: "Boston, MA", category: "Wedding Planner" },
  {
    id: 3,
    name: "Michael Johnson",
    company: "Tech Innovations",
    location: "San Francisco, CA",
    category: "Tech Conferences",
  },
  {
    id: 4,
    name: "Emily Davis",
    company: "Celebration Planners",
    location: "Chicago, IL",
    category: "Birthday Parties",
  },
  {
    id: 5,
    name: "Robert Wilson",
    company: "Corporate Solutions",
    location: "Dallas, TX",
    category: "Business Lunches",
  },
  { id: 6, name: "Jennifer Brown", company: "Dream Weddings", location: "Miami, FL", category: "Wedding Venue" },
  { id: 7, name: "David Miller", company: "Annual Gatherings", location: "Seattle, WA", category: "Annual Events" },
  { id: 8, name: "Lisa Anderson", company: "Party Perfect", location: "Denver, CO", category: "Social Events" },
  {
    id: 9,
    name: "James Taylor",
    company: "Executive Meetings",
    location: "Atlanta, GA",
    category: "Executive Retreats",
  },
  {
    id: 10,
    name: "Patricia Martinez",
    company: "Festive Occasions",
    location: "Phoenix, AZ",
    category: "Holiday Parties",
  },
]

export default function LeadsDiscoveryPage() {
  const router = useRouter()
  const { setLeads } = useCaterly()
  const [selectedLeads, setSelectedLeads] = useState<number[]>([])
  const [selectAll, setSelectAll] = useState(false)

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedLeads([])
    } else {
      setSelectedLeads(dummyLeads.map((lead) => lead.id))
    }
    setSelectAll(!selectAll)
  }

  const toggleLeadSelection = (id: number) => {
    if (selectedLeads.includes(id)) {
      setSelectedLeads(selectedLeads.filter((leadId) => leadId !== id))
      setSelectAll(false)
    } else {
      setSelectedLeads([...selectedLeads, id])
      if (selectedLeads.length + 1 === dummyLeads.length) {
        setSelectAll(true)
      }
    }
  }

  const handleEnrichLeads = () => {
    const selectedLeadData = dummyLeads.filter((lead) => selectedLeads.includes(lead.id))
    setLeads(selectedLeadData)
    router.push("/leads/enrich")
  }

  return (
    <div className="container mx-auto px-4 py-12 relative">
      {/* Background effects */}
      <div className="absolute -top-12 -right-12 w-64 h-64 bg-purple-500/10 rounded-full filter blur-3xl animate-pulse-slow"></div>
      <div className="absolute -bottom-12 -left-12 w-80 h-80 bg-blue-500/10 rounded-full filter blur-3xl animate-pulse-slow"></div>
      
      <div className="relative">
        <h1 className="text-4xl font-bold mb-2 text-center gradient-text">Discovered Leads</h1>
        <p className="text-center text-muted-foreground mb-8">AI-powered lead discovery for your catering business</p>

        <div className="max-w-5xl mx-auto">
          <Card className="border border-purple-500/20 bg-secondary/10 backdrop-blur-sm shadow-medium overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-secondary/30">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-purple-500 animate-pulse"></span>
                <CardTitle>
                  <span className="gradient-text-blue">Potential Leads</span>
                  <Badge className="ml-2 bg-purple-500/20 text-purple-300 hover:bg-purple-500/30" variant="secondary">
                    AI Generated
                  </Badge>
                </CardTitle>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="selectAll" 
                  checked={selectAll} 
                  onCheckedChange={toggleSelectAll}
                  className="border-purple-500/50 data-[state=checked]:bg-purple-500 data-[state=checked]:text-white" 
                />
                <label htmlFor="selectAll" className="text-sm font-medium text-foreground/80">
                  Select All
                </label>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50 bg-secondary/20">
                      <th className="py-3 px-4 text-left w-12"></th>
                      <th className="py-3 px-4 text-left font-medium text-foreground/90">Name</th>
                      <th className="py-3 px-4 text-left font-medium text-foreground/90">Company</th>
                      <th className="py-3 px-4 text-left font-medium text-foreground/90">Location</th>
                      <th className="py-3 px-4 text-left font-medium text-foreground/90">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dummyLeads.map((lead) => (
                      <tr 
                        key={lead.id} 
                        className={`border-b border-border/30 hover:bg-secondary/30 transition-colors 
                                    ${selectedLeads.includes(lead.id) ? 'bg-secondary/20' : ''}`}
                      >
                        <td className="py-3 px-4">
                          <Checkbox
                            checked={selectedLeads.includes(lead.id)}
                            onCheckedChange={() => toggleLeadSelection(lead.id)}
                            className="border-purple-500/50 data-[state=checked]:bg-purple-500 data-[state=checked]:text-white"
                          />
                        </td>
                        <td className="py-3 px-4 font-medium">{lead.name}</td>
                        <td className="py-3 px-4 text-foreground/90">{lead.company}</td>
                        <td className="py-3 px-4 text-foreground/90">{lead.location}</td>
                        <td className="py-3 px-4 text-foreground/90">
                          <Badge variant="outline" className="bg-secondary/40 border-purple-500/20 text-foreground/80">
                            {lead.category}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-4 mt-2 flex justify-between items-center">
                <div className="text-sm text-muted-foreground flex items-center">
                  <div className="w-2 h-2 rounded-full bg-purple-500 mr-2"></div>
                  {selectedLeads.length} of {dummyLeads.length} leads selected
                </div>

                <Button
                  onClick={handleEnrichLeads}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-ai-glow transition-all duration-300 transform hover:scale-105"
                  disabled={selectedLeads.length === 0}
                >
                  <span className="mr-2">Enrich Selected Leads</span>
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="24" 
                    height="24" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className="h-4 w-4 sparkle"
                  >
                    <path d="M5 12h14"></path>
                    <path d="m12 5 7 7-7 7"></path>
                  </svg>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

