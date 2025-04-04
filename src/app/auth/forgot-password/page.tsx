import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"

export const metadata = {
  title: "Forgot Password | CaterlyAI",
  description: "Reset your CaterlyAI account password",
}

export default function ForgotPasswordPage() {
  return (
    <div className="container flex items-center justify-center min-h-[80vh] py-12">
      <ForgotPasswordForm />
    </div>
  )
} 