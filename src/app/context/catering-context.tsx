"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

// Define types
type User = {
  email: string
  name: string
}

type Profile = {
  photos: string[]
  menuLink: string
  managerContact: string
  orderingLink: string
  focus: string
  description: string
  idealClients: string
  location: string
}

type Campaign = {
  name: string
  eventType: string
  location: string
  radius: number
  budget?: string
  startDate?: string
  endDate?: string
  targetCategories?: string[]
  idealCustomerType?: string
  additionalCustomerTypes?: string
}

type Lead = {
  id: number
  name: string
  company: string
  location: string
  category: string
  [key: string]: any // For enriched data
}

type CaterlyContextType = {
  user: User | null
  setUser: (user: User | null) => void
  profile: Profile | null
  setProfile: (profile: Profile) => void
  campaign: Campaign | null
  setCampaign: (campaign: Campaign) => void
  leads: Lead[]
  setLeads: (leads: Lead[]) => void
  enrichedLeads: Lead[]
  setEnrichedLeads: (leads: Lead[]) => void
}

// Create context
const CaterlyContext = createContext<CaterlyContextType | undefined>(undefined)

// Provider component
export function CaterlyProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [enrichedLeads, setEnrichedLeads] = useState<Lead[]>([])

  return (
    <CaterlyContext.Provider
      value={{
        user,
        setUser,
        profile,
        setProfile,
        campaign,
        setCampaign,
        leads,
        setLeads,
        enrichedLeads,
        setEnrichedLeads,
      }}
    >
      {children}
    </CaterlyContext.Provider>
  )
}

// Custom hook to use the context
export function useCaterly() {
  const context = useContext(CaterlyContext)
  if (context === undefined) {
    throw new Error("useCaterly must be used within a CaterlyProvider")
  }
  return context
}

// Legacy hook for compatibility
export function useCatering() {
  return useCaterly()
}

