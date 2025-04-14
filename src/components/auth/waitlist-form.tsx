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
    <div className="w-full max-w-md mx-auto mt-8 p-6 border border-gray-100 rounded-lg shadow-sm bg-white">
      <div className="space-y-2 mb-4">
        <h2 className="text-xl font-semibold text-center">Join our Waitlist</h2>
        <p className="text-gray-500 text-sm text-center">Get early access when we launch</p>
      </div>

      {message && (
        <Alert variant={message.type === "error" ? "destructive" : "default"} className="mb-4">
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="waitlist-email">Email</Label>
          <Input
            id="waitlist-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
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
      </form>
    </div>
  )
} 