import { redirect } from "next/navigation"
import { getCurrentUser } from "@/backend/auth/session"
import WorkspaceView from "@/components/WorkspaceView"

export default async function HomePage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth")
  }

  return <WorkspaceView user={user} />
}
