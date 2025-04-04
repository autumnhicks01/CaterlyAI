import Link from "next/link"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "Authentication Error | CaterlyAI",
  description: "There was an error with authentication",
}

export default function AuthErrorPage() {
  return (
    <div className="container flex flex-col items-center justify-center min-h-[80vh] py-12 text-center">
      <h1 className="text-3xl font-bold mb-4">Authentication Error</h1>
      <p className="text-gray-600 mb-8 max-w-md">
        We encountered an error during the authentication process. This could be due to an expired link
        or an issue with your authentication session.
      </p>
      <div className="flex gap-4">
        <Button asChild variant="outline">
          <Link href="/login">Return to Login</Link>
        </Button>
        <Button asChild>
          <Link href="/">Go to Homepage</Link>
        </Button>
      </div>
    </div>
  )
} 