import { LoginDebug } from "./login-debug"
import { AuthContextDebug } from "../context/auth-debug"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "Auth Tests | CaterlyAI",
  description: "Testing authentication functionality",
}

export default function AuthTestPage() {
  return (
    <div className="container py-12">
      <h1 className="text-3xl font-bold mb-8 text-center">Authentication Tests</h1>
      
      <div className="flex justify-center mb-8">
        <Link href="/tests/database">
          <Button variant="outline">
            Go to Database Test
          </Button>
        </Link>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
        <div>
          <h2 className="text-xl font-semibold mb-4">Direct Supabase Login</h2>
          <LoginDebug />
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-4">Auth Context State</h2>
          <AuthContextDebug />
        </div>
      </div>
    </div>
  )
} 