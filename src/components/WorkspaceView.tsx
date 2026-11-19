"use client"

import { useState } from "react"
import Navbar from "./Navbar"
import MyResumeSection from "./MyResumeSection"
import JobMatchSection from "./JobMatchSection"
import RecommendedJobsSection from "./RecommendedJobsSection"

interface AuthenticatedUser {
  id: number
  name: string
  email: string
  image: string | null
  provider: string
}

interface WorkspaceViewProps {
  user: AuthenticatedUser
}

export default function WorkspaceView({ user }: WorkspaceViewProps) {
  const [activeResume, setActiveResume] = useState<{ id: number; fileName: string } | null>(null)

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans">
      {/* Clean Navbar */}
      <Navbar user={user} />

      {/* Main Single-Page Workspace */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full flex flex-col gap-8">
        {/* Page Header */}
        <div className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-neutral-950 p-6 sm:p-7 rounded-3xl border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex flex-col gap-1.5 max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Your Career Workspace
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
              Improve your resume, match your skills to jobs, and discover opportunities that fit your experience.
            </p>
          </div>
          {user.name && (
            <div className="hidden sm:flex items-center gap-2 text-xs text-neutral-400 px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 self-start sm:self-center">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span>{user.name}</span>
            </div>
          )}
        </div>

        {/* 1. Resume Review (Upload, Audit & Quality Report) */}
        <MyResumeSection onActiveResumeChange={setActiveResume} />

        {/* 2. Job Match (Paste Description or Enter Job URL) */}
        <JobMatchSection currentResume={activeResume} />

        {/* 3. Jobs For You (Relevant Vacancies Based on Profile) */}
        <RecommendedJobsSection resumeId={activeResume?.id} />
      </main>

      {/* SaaS Footer */}
      <footer className="border-t border-neutral-800/80 bg-neutral-950 py-6 text-center text-xs text-neutral-500">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-400">AI Career Copilot</span>
            <span>•</span>
            <span>Minimal Resume Analyzer & Job Matcher</span>
          </div>
          <div className="text-[11px] text-neutral-500">
            Private & Secure • Free & Open • All rights reserved
          </div>
        </div>
      </footer>
    </div>
  )
}
