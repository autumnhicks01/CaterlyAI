"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { useCaterly, useCatering } from "../app/context/caterly-context"
import { useRouter } from "next/navigation"
import { useAuth } from "@/app/context/auth-context"
import { ThemeToggle } from "@/components/ui/theme-toggle"

export default function LandingPage() {
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const { user } = useAuth()

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleGetStarted = () => {
    if (user) {
      // User is logged in, redirect to profile
      router.push('/profile')
    } else {
      // User is not logged in, redirect to login
      router.push('/login')
    }
  }

  if (!mounted) {
    return null
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-background to-background/95">
      {/* Header with logo and theme toggle */}
      <header className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <Link href="/" className="flex items-center">
            <div className="text-purple-600 dark:text-purple-500 h-8 w-8 mr-2">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <path d="M8 13C8.5 14.5 10 16 12 16C14 16 15.5 14.5 16 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="8.5" cy="9.5" r="1.5" fill="currentColor" />
                <circle cx="15.5" cy="9.5" r="1.5" fill="currentColor" />
              </svg>
            </div>
            <span className="font-bold text-xl text-purple-600 dark:text-purple-500">CaterlyAI</span>
          </Link>
        </div>
        
        <div className="flex items-center">
          <ThemeToggle />
        </div>
      </header>

      {/* Hero Section with starry background */}
      <section className="relative min-h-[45vh] flex items-center justify-center overflow-hidden">
        {/* Animated background with stars */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(124,58,237,0.2)_0%,rgba(0,0,0,0)_70%)]"></div>
          <div className="absolute inset-0">
            {/* Generated stars pattern */}
            {Array.from({ length: 150 }).map((_, i) => (
              <div 
                key={i}
                className="absolute rounded-full bg-white"
                style={{
                  width: `${Math.random() * 3 + 1}px`,
                  height: `${Math.random() * 3 + 1}px`,
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  opacity: Math.random() * 0.9 + 0.1,
                  animation: `sparkle ${Math.random() * 3 + 2}s infinite`
                }}
              ></div>
            ))}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent"></div>
        </div>

        {/* Content */}
        <div className="container relative mx-auto px-4 z-10 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-bold mb-4 gradient-text animate-float">
              Catering Sales on Autopilot
            </h1>
            <p className="text-xl md:text-2xl mb-6 text-foreground/80 max-w-3xl mx-auto">
              Discover leads, send personalized emails, and grow your catering business on autopilot with our cutting-edge AI technology.
            </p>
            <Button 
              onClick={handleGetStarted}
              size="lg" 
              className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-600 text-white shadow-ai-glow transition-all duration-300 transform hover:scale-105"
            >
              <span className="mr-2">Get Started</span>
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
                className="h-4 w-4"
              >
                <path d="M5 12h14"></path>
                <path d="m12 5 7 7-7 7"></path>
              </svg>
            </Button>
          </div>
        </div>

        {/* Floating elements */}
        <div className="absolute left-10 top-1/4 w-20 h-20 opacity-20 bg-purple-500 rounded-full filter blur-3xl animate-pulse-glow"></div>
        <div className="absolute right-10 top-1/3 w-32 h-32 opacity-20 bg-blue-500 rounded-full filter blur-3xl animate-pulse-glow animation-delay-700"></div>
        <div className="absolute bottom-1/4 left-1/3 w-24 h-24 opacity-20 bg-pink-500 rounded-full filter blur-3xl animate-pulse-glow animation-delay-1000"></div>
      </section>

      {/* Features Section */}
      <section className="py-6 bg-background">
        <div className="container mx-auto px-4">

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-secondary/20 border-purple-500/10 shadow-medium overflow-hidden group">
              <CardContent className="p-6 relative">
                <div className="absolute inset-0 bg-gradient-shine bg-[length:100px_100px] opacity-0 group-hover:opacity-10 transition-opacity duration-700"></div>
                <div className="rounded-full bg-purple-500/40 w-12 h-12 flex items-center justify-center mb-4 ai-icon">
                  <span className="text-purple-700 text-xl font-bold">1</span>
                </div>
                <h3 className="text-xl font-semibold mb-2 text-foreground">Your Digital Mise en Place</h3>
                <p className="text-muted-foreground font-semibold mb-2">
                  "Prep once. Impress endlessly."
                </p>
                <p className="text-foreground/80">
                  We build your AI-powered brand kit—think of it as your marketing mise en place. From optimized business descriptions to customized social media images and posts, we ensure your catering business is dressed to impress, automatically.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-secondary/20 border-blue-500/10 shadow-medium overflow-hidden group">
              <CardContent className="p-6 relative">
                <div className="absolute inset-0 bg-gradient-shine bg-[length:100px_100px] opacity-0 group-hover:opacity-10 transition-opacity duration-700"></div>
                <div className="rounded-full bg-blue-500/40 w-12 h-12 flex items-center justify-center mb-4 ai-icon">
                  <span className="text-blue-700 text-xl font-bold">2</span>
                </div>
                <h3 className="text-xl font-semibold mb-2 text-foreground">Start Your Lead Engine <span className="sparkle-subtle"></span></h3>
                <p className="text-muted-foreground font-semibold mb-2">
                  "Fuel your pipeline with AI precision."
                </p>
                <p className="text-foreground/80">
                  Our system hunts for high-potential catering leads in your area—pulling names, emails, phone numbers, and key business insights directly from the web. Each lead comes enriched and ready to go, complete with a unique company profile and contact strategy.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-secondary/20 border-pink-500/10 shadow-medium overflow-hidden group">
              <CardContent className="p-6 relative">
                <div className="absolute inset-0 bg-gradient-shine bg-[length:100px_100px] opacity-0 group-hover:opacity-10 transition-opacity duration-700"></div>
                <div className="rounded-full bg-pink-500/40 w-12 h-12 flex items-center justify-center mb-4 ai-icon">
                  <span className="text-pink-700 text-xl font-bold">3</span>
                </div>
                <h3 className="text-xl font-semibold mb-2 text-foreground">Marketing While You Sleep</h3>
                <p className="text-muted-foreground font-semibold mb-2">
                  "Get a text when it's time to book the event."
                </p>
                <p className="text-foreground/80">
                  Your 12-week campaign? Handled. AI-generated emails are crafted, scheduled, and sent on autopilot. As soon as a lead is ready to talk, you'll get a real-time text alert—so you can focus on booking, not chasing.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}

