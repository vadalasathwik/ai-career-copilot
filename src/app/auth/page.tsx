import { redirect } from "next/navigation"
import { getCurrentUser } from "@/backend/auth/session"
import AuthForm from "@/components/AuthForm"

export default async function AuthPage() {
  const user = await getCurrentUser()

  if (user) {
    redirect("/")
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <AuthForm />
    </main>
  )
}
