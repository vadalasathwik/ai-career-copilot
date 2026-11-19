"use client"

import { useState, useEffect } from "react"

interface RecommendedJob {
  jobId: number
  jobTitle: string
  company: string
  location: string | null
  remoteStatus: "REMOTE" | "HYBRID" | "ON_SITE" | string | null
  source: string
  url: string | null
  salary: string | null
  isSample: boolean
  lastVerifiedAt: string
  matchScore: number
  summary: string
  reasonsForMatch: string[]
  requiredSkillsMatched: string[]
}

interface RecommendedJobsSectionProps {
  resumeId?: number | null
}

export default function RecommendedJobsSection({ resumeId }: RecommendedJobsSectionProps) {
  const [jobs, setJobs] = useState<RecommendedJob[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadMatches() {
      try {
        setLoading(true)
        const endpoint = resumeId ? `/api/jobs/matches?resumeId=${resumeId}` : "/api/jobs/matches"
        const res = await fetch(endpoint)
        if (res.ok && active) {
          const data = await res.json()
          if (data.success && Array.isArray(data.matches)) {
            setJobs(data.matches)
          }
        }
      } catch {
        // Quiet fail
      } finally {
        if (active) setLoading(false)
      }
    }

    loadMatches()

    return () => {
      active = false
    }
  }, [resumeId])

  function getWorkModeBadge(mode?: string | null, location?: string | null) {
    const inferredMode = !mode && location
      ? /\bremote\b/i.test(location) ? "REMOTE" : /\bhybrid\b/i.test(location) ? "HYBRID" : /\bon[ -]?site\b/i.test(location) ? "ON_SITE" : null
      : null
    const supportedMode = mode === "REMOTE" || mode === "HYBRID" || mode === "ON_SITE" ? mode : inferredMode
    if (supportedMode === "REMOTE") {
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-medium">
          🌐 Remote
        </span>
      )
    }
    if (supportedMode === "HYBRID") {
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800 font-medium">
          🏢 Hybrid
        </span>
      )
    }
    if (supportedMode === "ON_SITE") return (
      <span className="rounded-full border border-stone-300 bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
        📍 On-site
      </span>
    )
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-900 text-neutral-500 border border-neutral-800 font-medium">Work mode not listed</span>
  }

  function getLocationLabel(location?: string | null) {
    if (!location || /\b(remote|hybrid|on[ -]?site)\b/i.test(location)) return null
    return location
  }

  function getScoreBadgeColor(score: number) {
    if (score >= 80) return "bg-emerald-950 text-emerald-300 border-emerald-800"
    if (score >= 60) return "bg-amber-950 text-amber-300 border-amber-800"
    return "bg-neutral-800 text-neutral-300 border-neutral-700"
  }

  return (
    <div className="bg-neutral-900/80 p-6 sm:p-7 rounded-3xl border border-neutral-800 flex flex-col gap-6 shadow-sm">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-xl">💼</span>
            <h2 className="text-xl font-bold text-white tracking-tight">Jobs For You</h2>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Discover opportunities that align with your verified skills and experience.
          </p>
        </div>

        {jobs.length > 0 && (
          <span className="text-xs font-mono bg-neutral-950 text-neutral-400 border border-neutral-800 px-3 py-1 rounded-full self-start sm:self-auto">
            {jobs.length} relevant {jobs.length === 1 ? "opening" : "openings"}
          </span>
        )}
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>Evaluating relevant openings against your profile...</span>
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-neutral-950/60 p-8 rounded-2xl border border-neutral-800/80 text-center flex flex-col items-center justify-center gap-2.5">
          <span className="text-2xl text-neutral-500">🔍</span>
          <h3 className="text-sm font-semibold text-white">No Matching Job Openings Found</h3>
          <p className="text-xs text-neutral-400 max-w-md leading-relaxed">
            {resumeId
              ? "No verified active job openings currently match your extracted skill set. Paste a job description in Job Match to evaluate any target role on-demand."
              : "Upload a resume in Resume Review to receive personalized job recommendations scored against your technical skills."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {jobs.map((job) => (
            <div
              key={job.jobId}
              className="bg-neutral-950 p-5 rounded-2xl border border-neutral-800 flex flex-col justify-between gap-4 hover:border-neutral-700 transition group"
            >
              <div className="flex flex-col gap-2.5">
                {/* Header: Title, company, score */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition truncate">
                        {job.jobTitle}
                      </h3>
                      {job.isSample ? (
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-neutral-900 text-neutral-400 border border-neutral-800">
                          Sample Vacancy
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/80">
                          Verified Listing
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-400 flex-wrap">
                      <span className="font-semibold text-neutral-200">{job.company}</span>
                      {getLocationLabel(job.location) && <span>• {getLocationLabel(job.location)}</span>}
                      {getWorkModeBadge(job.remoteStatus, job.location)}
                    </div>
                  </div>

                  <span
                    className={`text-xs font-bold font-mono px-2.5 py-1 rounded-xl border shrink-0 ${getScoreBadgeColor(
                      job.matchScore
                    )}`}
                  >
                    {job.matchScore}% Match
                  </span>
                </div>

                {/* Match Explanation */}
                <p className="text-xs text-neutral-300 leading-relaxed line-clamp-2">
                  {job.summary ||
                    (job.reasonsForMatch && job.reasonsForMatch.length > 0
                      ? job.reasonsForMatch[0]
                      : "Strong alignment with candidate skills.")}
                </p>

                {/* Overlapping skills */}
                {job.requiredSkillsMatched && job.requiredSkillsMatched.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] text-neutral-500 font-medium">Matches:</span>
                    {job.requiredSkillsMatched.slice(0, 4).map((skill, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-800/80"
                      >
                        {skill}
                      </span>
                    ))}
                    {job.requiredSkillsMatched.length > 4 && (
                      <span className="text-[9px] text-neutral-500 font-mono">
                        +{job.requiredSkillsMatched.length - 4} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Footer: Date & URL Link */}
              <div className="border-t border-neutral-800/80 pt-3 flex items-center justify-between gap-2 text-[11px] text-neutral-500">
                <span>
                  {job.lastVerifiedAt
                    ? `Verified ${new Date(job.lastVerifiedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      })}`
                    : "Direct Listing"}
                </span>

                {job.url ? (
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition"
                  >
                    <span>View Job</span>
                    <span className="text-[10px]">↗</span>
                  </a>
                ) : (
                  <span className="text-neutral-500 text-[10px] italic">Direct posting</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
