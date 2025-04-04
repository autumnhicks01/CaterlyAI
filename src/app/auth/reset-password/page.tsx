import { ResetPasswordForm } from "@/components/auth/reset-password-form"

export const metadata = {
  title: "Reset Password | CaterlyAI",
  description: "Reset your CaterlyAI account password",
}

export default function ResetPasswordPage() {
  return (
    <div className="container flex items-center justify-center min-h-[80vh] py-12">
      <ResetPasswordForm />
    </div>
  )
} 