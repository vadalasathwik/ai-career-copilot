import Navbar from "@/components/Navbar"
import ResumeUpload from "@/components/ResumeUpload"
import AnalyticsCard from "@/components/AnalyticsCard"
import Suggestions from "@/components/Suggestions"
import MatchCard from "@/components/MatchCard"

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-black text-white">

      <Navbar />

      <div className="p-6 flex flex-col gap-6">

        <ResumeUpload />

        <div className="grid grid-cols-3 gap-6">

          <AnalyticsCard
            title="ATS Score"
            value="87%"
          />

          <AnalyticsCard
            title="Matched Jobs"
            value="24"
          />

          <AnalyticsCard
            title="Applications"
            value="12"
          />

        </div>

        <Suggestions />

        <div className="grid grid-cols-2 gap-6">

          <MatchCard
            company="Google"
            role="Frontend Developer"
          />

          <MatchCard
            company="Microsoft"
            role="React Engineer"
          />

        </div>

      </div>

    </main>
  )
}