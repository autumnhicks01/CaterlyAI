"use client"

import React from "react"
import { CaterlyProvider } from "../app/context/caterly-context"
import { AuthProvider } from "../app/context/auth-context"
import { ProfileLoader } from "./profile-loader"

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <CaterlyProvider>
        <ProfileLoader>
          {children}
        </ProfileLoader>
      </CaterlyProvider>
    </AuthProvider>
  )
} 