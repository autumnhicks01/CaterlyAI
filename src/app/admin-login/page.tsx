import { Suspense } from "react"
import { LoginForm } from "@/components/auth/login-form"
import Link from "next/link"

export default function AdminLoginPage() {
  return (
    <div className="container flex flex-col items-center justify-center min-h-[80vh] py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Admin Login</h1>
        <p className="text-gray-600">
          <Link href="/login" className="text-blue-600 hover:underline">
            Return to waitlist
          </Link>
        </p>
      </div>
      
      <Suspense fallback={<div className="text-center">Loading login form...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
} 