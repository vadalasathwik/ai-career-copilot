"use client"

import { useState } from "react"
import Navbar, { NavigationTab } from "./Navbar"
import AnalyticsCard from "./AnalyticsCard"
import Suggestions from "./Suggestions"
import ResumeUpload from "./ResumeUpload"
import ResumeAnalysisPanel from "./ResumeAnalysisPanel"
import MatchedOpportunitiesSection from "./MatchedOpportunitiesSection"
import ApplicationsTracker from "./ApplicationsTracker"
import CareerRecommendations from "./CareerRecommendations"
import type { DashboardData } from "@/backend/services/dashboardService"

interface AuthenticatedUser {
  id: number
  name: string
  email: string
  image: string | null
  provider: string
}

interface DashboardContainerProps {
  user: AuthenticatedUser
  dashboardData: DashboardData
}

export default function DashboardContainer({
  user,
  dashboardData
}: DashboardContainerProps) {
  const [activeTab, setActiveTab] = useState<NavigationTab>("dashboard")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedResumeForScan, setSelectedResumeForScan] = useState<number | undefined>(undefined)

  function handleSelectResumeForAnalysis(resumeId: number) {
    setSelectedResumeForScan(resumeId)
    setActiveTab("resumes")
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* SaaS Header & Navigation */}
      <Navbar
        user={user}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab)
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full flex flex-col gap-8">
        {/* VIEW 1: EXECUTIVE DASHBOARD OVERVIEW */}
        {activeTab === "dashboard" && (
          <div className="flex flex-col gap-8 animate-in fade-in duration-200">
            {/* Welcome Banner */}
            <div className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-neutral-950 p-6 sm:p-8 rounded-3xl border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-sm">
              <div className="flex flex-col gap-2 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                    SaaS Career Copilot
                  </span>
                  <span className="text-xs text-neutral-500">•</span>
                  <span className="text-xs text-neutral-400">Zero Paid APIs • Deterministic Scoring</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Welcome back, {user.name.split(" ")[0]}
                </h1>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                  Optimize your tech career with transparent mathematical job matching, automated resume skill extraction, and factual Gemini ATS scans.
                </p>
              </div>

              {/* Quick Actions Shortcuts */}
              <div className="flex sm:flex-col gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab("resumes")}
                  className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow-sm"
                >
                  <span>✨</span> Scan Resume ATS
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("jobs")}
                  className="text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2.5 rounded-xl border border-neutral-700 transition flex items-center gap-2"
                >
                  <span>🎯</span> Find Matched Jobs
                </button>
              </div>
            </div>

            {/* Core KPI Metrics Strip */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <AnalyticsCard
                title="Latest ATS Score"
                value={dashboardData.atsScoreValue}
                subtitle={dashboardData.atsScoreSubtitle}
                icon="📈"
                badge={dashboardData.targetRole ? "Scanned" : undefined}
                onClick={() => setActiveTab("resumes")}
              />

              <AnalyticsCard
                title="Relevant Job Matches"
                value={dashboardData.matchedJobsCount}
                subtitle={
                  dashboardData.matchedJobsCount > 0
                    ? `${dashboardData.matchedJobsCount} qualified matches found`
                    : "Based on extracted resume skills"
                }
                icon="🎯"
                badge="Deterministic"
                onClick={() => setActiveTab("jobs")}
              />

              <AnalyticsCard
                title="Submitted Applications"
                value={dashboardData.applicationsCount}
                subtitle={dashboardData.applicationsSubtitle}
                icon="📋"
                badge="Tracked"
                onClick={() => setActiveTab("applications")}
              />
            </div>

            {/* Actionable Recommendations Preview */}
            <Suggestions
              suggestions={dashboardData.suggestions}
              targetRole={dashboardData.targetRole}
              onViewAll={() => setActiveTab("recommendations")}
            />

            {/* Matched Opportunities Snapshot */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    Top Opportunities Preview
                  </h2>
                  <p className="text-xs text-neutral-400">
                    Highest scoring vacancies matching your extracted technical skills
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("jobs")}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
                >
                  View All Opportunities ({dashboardData.matchedJobsCount}) →
                </button>
              </div>

              <MatchedOpportunitiesSection
                searchQueryProp={searchQuery}
                onNavigateToResumes={() => setActiveTab("resumes")}
              />
            </div>
          </div>
        )}

        {/* VIEW 2: MY RESUMES & ATS SCANNER */}
        {activeTab === "resumes" && (
          <div className="flex flex-col gap-8 animate-in fade-in duration-200">
            <ResumeUpload onSelectForAnalysis={handleSelectResumeForAnalysis} />
            <ResumeAnalysisPanel initialResumeId={selectedResumeForScan} />
          </div>
        )}

        {/* VIEW 3: INTELLIGENT JOB MATCHES */}
        {activeTab === "jobs" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            <MatchedOpportunitiesSection
              searchQueryProp={searchQuery}
              onNavigateToResumes={() => setActiveTab("resumes")}
            />
          </div>
        )}

        {/* VIEW 4: APPLICATION PIPELINE TRACKER */}
        {activeTab === "applications" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            <ApplicationsTracker
              searchQuery={searchQuery}
              onNavigateToJobs={() => setActiveTab("jobs")}
            />
          </div>
        )}

        {/* VIEW 5: CAREER RECOMMENDATIONS */}
        {activeTab === "recommendations" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            <CareerRecommendations
              onNavigateToScanner={() => setActiveTab("resumes")}
              onNavigateToJobs={() => setActiveTab("jobs")}
            />
          </div>
        )}
      </main>

      {/* SaaS Footer */}
      <footer className="border-t border-neutral-800/80 bg-neutral-950 py-6 text-center text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-400">AI Career Copilot</span>
            <span>•</span>
            <span>Local Deterministic Heuristics & Gemini AI</span>
          </div>
          <div className="text-[11px] text-neutral-500">
            Private & Secure • All rights reserved
          </div>
        </div>
      </footer>
    </div>
  )
}
