import { Suspense } from "react"
import { LoginForm } from "@/components/auth/login-form"

export default function LoginPage() {
  return (
    <div className="container flex items-center justify-center min-h-[80vh] py-12">
      <Suspense fallback={<div className="text-center">Loading login form...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
} 