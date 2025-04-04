import { UserProfile } from "@/components/auth/user-profile"

export const metadata = {
  title: "Account | CaterlyAI",
  description: "Manage your account settings",
}

export default function AccountPage() {
  return (
    <div className="container py-12">
      <h1 className="text-3xl font-bold mb-8 text-center">Account Settings</h1>
      <UserProfile />
    </div>
  )
} 