"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createClient } from "@/utils/supabase/client"

export function WaitlistForm() {
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    
    if (!email) return
    
    setIsLoading(true)
    setMessage(null)
    
    try {
      const supabase = createClient()
      
      const { error } = await supabase
        .from("waitlist")
        .insert({ email })
      
      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          setMessage({ 
            text: "This email is already on our waitlist. Thank you for your interest!", 
            type: "success" 
          })
        } else {
          throw error
        }
      } else {
        setMessage({ 
          text: "Thank you! You've been added to our waitlist.", 
          type: "success" 
        })
        setEmail("")
      }
    } catch (error: any) {
      console.error("Waitlist error:", error)
      setMessage({ 
        text: "Something went wrong. Please try again later.", 
        type: "error" 
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-8 border border-gray-200 rounded-xl shadow-md bg-white">
      <div className="space-y-3 mb-6">
        <h2 className="text-2xl font-bold text-center">Join our Waitlist</h2>
        <p className="text-gray-600 text-center max-w-md mx-auto">
          Be the first to get access to our AI-powered catering platform when we launch. 
          Sign up today to secure your spot!
        </p>
      </div>

      {message && (
        <Alert 
          variant={message.type === "error" ? "destructive" : "default"} 
          className={`mb-6 ${message.type === "success" ? "bg-green-50 border-green-200 text-green-800" : ""}`}
        >
          <AlertDescription className="text-center">{message.text}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-grow space-y-2">
            <Label htmlFor="waitlist-email" className="text-sm font-medium">
              Email Address
            </Label>
            <Input
              id="waitlist-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12"
              required
            />
          </div>
          <div className="md:self-end">
            <Button 
              type="submit" 
              className="w-full md:w-auto h-12 px-6 bg-blue-600 hover:bg-blue-700" 
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Submitting...
                </span>
              ) : "Join Waitlist"}
            </Button>
          </div>
        </div>
        <p className="text-xs text-gray-500 text-center pt-2">
          We respect your privacy. Your information will never be shared with third parties.
        </p>
      </form>
    </div>
  )
} 