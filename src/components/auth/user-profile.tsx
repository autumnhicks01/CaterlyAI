"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/app/context/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { LogoutButton } from "./logout-button"

export function UserProfile() {
  const { user, session } = useAuth()
  const [email, setEmail] = useState(user?.email || "")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  // Format the created at date if available
  const createdAt = user?.created_at 
    ? new Date(user.created_at).toLocaleDateString() 
    : "Unknown"

  // Format the last sign in date if available
  const lastSignIn = user?.last_sign_in_at 
    ? new Date(user.last_sign_in_at).toLocaleDateString() 
    : "Unknown"

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Your Profile</CardTitle>
        <CardDescription>View and manage your account details</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}
        
        {successMessage && (
          <Alert>
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            value={email}
            disabled
            className="bg-muted"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="userId">User ID</Label>
          <Input
            id="userId"
            value={user?.id || ""}
            disabled
            className="bg-muted text-xs"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm text-muted-foreground">Account Created</Label>
            <p className="text-sm">{createdAt}</p>
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Last Sign In</Label>
            <p className="text-sm">{lastSignIn}</p>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={() => router.push("/auth/reset-password")}
        >
          Change Password
        </Button>
        <LogoutButton />
      </CardFooter>
    </Card>
  )
} 