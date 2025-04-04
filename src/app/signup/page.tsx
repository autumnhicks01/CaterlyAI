import { SignupForm } from "@/components/auth/signup-form"

export const metadata = {
  title: "Sign Up | CaterlyAI",
  description: "Create a new CaterlyAI account",
}

export default function SignupPage() {
  return (
    <div className="container flex items-center justify-center min-h-[80vh] py-12">
      <SignupForm />
    </div>
  )
} 