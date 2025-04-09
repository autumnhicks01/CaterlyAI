"use client"

import React from "react"
import { CaterlyProvider } from "../app/context/caterly-context"
import { AuthProvider } from "../app/context/auth-context"
import { ProfileLoader } from "./profile-loader"
import { ThemeProvider } from "@/components/ui/theme-provider"

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider 
      attribute="class" 
      defaultTheme="system" 
      enableSystem 
      disableTransitionOnChange
    >
      <AuthProvider>
        <CaterlyProvider>
          <ProfileLoader>
            {children}
          </ProfileLoader>
        </CaterlyProvider>
      </AuthProvider>
    </ThemeProvider>
  )
} 