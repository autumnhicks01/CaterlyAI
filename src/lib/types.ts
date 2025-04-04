// Define types for the application

export type User = {
  email: string
  name: string
}

export type Profile = {
  photos: string[]
  menuLink: string
  managerContact: string
  orderingLink: string
  focus: string
  description: string
}

export type Campaign = {
  name: string
  eventType: string
  location: string
  radius: number
  budget: string
  startDate: string
  endDate: string
}

export type Lead = {
  id: number
  name: string
  company: string
  location: string
  category: string
  email?: string
  phone?: string
  industry?: string
  aiScore?: number
  lastEvent?: string
}

