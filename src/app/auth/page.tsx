import { redirect } from "next/navigation"
import { getCurrentUser } from "@/backend/auth/session"
import AuthForm from "@/components/AuthForm"

export default async function AuthPage() {
  const user = await getCurrentUser()

  if (user) {
    redirect("/dashboard")
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <AuthForm />
    </main>
  )
}
