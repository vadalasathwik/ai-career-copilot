import { redirect } from "next/navigation"
import { getCurrentUser } from "@/backend/auth/session"
import { getDashboardData } from "@/backend/services/dashboardService"
import DashboardContainer from "@/components/DashboardContainer"

export default async function DashboardPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth")
  }

  let dashboardData
  try {
    dashboardData = await getDashboardData(user.id)
  } catch {
    dashboardData = {
      atsScoreValue: "Unavailable",
      atsScoreSubtitle: "Unable to load dashboard records",
      matchedJobsCount: 0,
      applicationsCount: 0,
      savedJobsCount: 0,
      applicationsSubtitle: "Unable to load application records",
      suggestions: [],
      targetRole: null,
      matchedJobs: []
    }
  }

  return <DashboardContainer user={user} dashboardData={dashboardData} />
}
