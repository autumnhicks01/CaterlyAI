import '@/utils/crypto-polyfill';
import type React from "react"
import { Inter } from "next/font/google"
import "./globals.css"
import Navbar from "../components/navbar"
import Providers from "../components/providers"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "CaterlyAI - Automate Your Catering Sales",
  description: "Automate your catering sales with AI-powered lead generation and outreach",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <Navbar />
          <main className="min-h-screen bg-neutral-50">{children}</main>
        </Providers>
      </body>
    </html>
  )
}

