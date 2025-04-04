"use client"

import React from "react"
import { CaterlyProvider } from "../app/context/caterly-context"
import { AuthProvider } from "../app/context/auth-context"

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <CaterlyProvider>{children}</CaterlyProvider>
    </AuthProvider>
  )
} 