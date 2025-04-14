"use client"

import { redirect } from "next/navigation"

export default function HomePage() {
  redirect("/login")
  
  // This won't render, but is needed to satisfy TypeScript
  return null
}

