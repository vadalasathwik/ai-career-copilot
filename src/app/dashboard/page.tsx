import { redirect } from "next/navigation"

export default function DashboardPage() {
  // Main workspace is now unified at '/'
  redirect("/")
}
