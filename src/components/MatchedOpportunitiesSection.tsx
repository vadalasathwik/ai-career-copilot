"use client"

import { useState, useEffect, useMemo, FormEvent } from "react"
import MatchCard, { MatchScoreBreakdownProps, ApplicationStatusType } from "./MatchCard"

export interface JobMatchItem {
  jobId: number
  jobTitle: string
  company: string
  location: string | null
  remoteStatus: "REMOTE" | "HYBRID" | "ON_SITE" | string | null
  source: string
  sourceJobId: string | null
  url: string | null
  salary: string | null
  isSample: boolean
  isActive: boolean
  lastVerifiedAt: string
  matchScore: number
  scoreBreakdown: MatchScoreBreakdownProps
  requiredSkillsMatched: string[]
  requiredSkillsMissing: string[]
  preferredSkillsMatched: string[]
  preferredSkillsMissing: string[]
  unassessedSkills: string[]
  experienceLevelAlignment: string
  seniorityAlignment: string
  reasonsForMatch: string[]
  actionableRecommendations: string[]
  summary: string
  isCached: boolean
}

interface ApplicationRecord {
  id: number
  jobId: number | null
  status: ApplicationStatusType
}

interface MatchedOpportunitiesSectionProps {
  searchQueryProp?: string
  onNavigateToResumes?: () => void
}

export default function MatchedOpportunitiesSection({
  searchQueryProp = "",
  onNavigateToResumes
}: MatchedOpportunitiesSectionProps) {
  const [loading, setLoading] = useState(true)
  const [matches, setMatches] = useState<JobMatchItem[]>([])
  const [activeResume, setActiveResume] = useState<{
    id: number
    fileName: string
    skills: string[]
  } | null>(null)
  const [savedJobsMap, setSavedJobsMap] = useState<Map<number, ApplicationStatusType>>(new Map())

  // Filter States
  const [searchQuery, setSearchQuery] = useState("")
  const [workModeFilter, setWorkModeFilter] = useState<string>("ALL")
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0)
  const [sortBy, setSortBy] = useState<"SCORE_DESC" | "SCORE_ASC">("SCORE_DESC")

  const effectiveSearchQuery = searchQueryProp || searchQuery

  // Manual Job / Paste Job Description Modal State
  const [showAddJobModal, setShowAddJobModal] = useState(false)
  const [isSubmittingJob, setIsSubmittingJob] = useState(false)
  const [addJobError, setAddJobError] = useState<string | null>(null)
  const [addJobForm, setAddJobForm] = useState({
    title: "",
    company: "",
    location: "Remote",
    remoteStatus: "REMOTE" as "REMOTE" | "HYBRID" | "ON_SITE",
    salary: "",
    url: "",
    skillsInput: "",
    description: ""
  })

  async function refreshData() {
    try {
      setLoading(true)
      const [matchesRes, appsRes] = await Promise.all([
        fetch("/api/jobs/matches"),
        fetch("/api/applications")
      ])

      if (matchesRes.ok) {
        const matchesData = await matchesRes.json()
        if (matchesData.success) {
          setMatches(matchesData.matches || [])
          setActiveResume(matchesData.resume || null)
        }
      }

      if (appsRes.ok) {
        const appsData = await appsRes.json()
        if (appsData.success && Array.isArray(appsData.applications)) {
          const map = new Map<number, ApplicationStatusType>()
          for (const app of appsData.applications as ApplicationRecord[]) {
            if (app.jobId) {
              map.set(app.jobId, app.status)
            }
          }
          setSavedJobsMap(map)
        }
      }
    } catch {
      // Quietly handle network failure
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    async function initialFetch() {
      try {
        const [matchesRes, appsRes] = await Promise.all([
          fetch("/api/jobs/matches"),
          fetch("/api/applications")
        ])

        if (!active) return

        if (matchesRes.ok) {
          const matchesData = await matchesRes.json()
          if (matchesData.success) {
            setMatches(matchesData.matches || [])
            setActiveResume(matchesData.resume || null)
          }
        }

        if (appsRes.ok) {
          const appsData = await appsRes.json()
          if (appsData.success && Array.isArray(appsData.applications)) {
            const map = new Map<number, ApplicationStatusType>()
            for (const app of appsData.applications as ApplicationRecord[]) {
              if (app.jobId) {
                map.set(app.jobId, app.status)
              }
            }
            setSavedJobsMap(map)
          }
        }
      } catch {
        // Quiet fail
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    initialFetch()

    return () => {
      active = false
    }
  }, [])

  async function handleSaveJob(jobId: number) {
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, status: "SAVED" })
      })

      if (res.ok) {
        setSavedJobsMap((prev) => {
          const next = new Map(prev)
          next.set(jobId, "SAVED")
          return next
        })
      }
    } catch {
      // Ignore
    }
  }

  async function handleUpdateStatus(jobId: number, status: ApplicationStatusType) {
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, status })
      })

      if (res.ok) {
        setSavedJobsMap((prev) => {
          const next = new Map(prev)
          next.set(jobId, status)
          return next
        })
      }
    } catch {
      // Ignore
    }
  }

  async function handleCreateManualJob(e: FormEvent) {
    e.preventDefault()
    setAddJobError(null)

    if (!addJobForm.title.trim() || !addJobForm.company.trim() || !addJobForm.description.trim()) {
      setAddJobError("Title, company, and job description are required.")
      return
    }

    try {
      setIsSubmittingJob(true)
      const manualSkills = addJobForm.skillsInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)

      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: addJobForm.title.trim(),
          company: addJobForm.company.trim(),
          location: addJobForm.location.trim() || undefined,
          remoteStatus: addJobForm.remoteStatus,
          salary: addJobForm.salary.trim() || undefined,
          url: addJobForm.url.trim() || undefined,
          description: addJobForm.description.trim(),
          skills: manualSkills.length > 0 ? manualSkills : undefined
        })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to create job.")
      }

      setShowAddJobModal(false)
      setAddJobForm({
        title: "",
        company: "",
        location: "Remote",
        remoteStatus: "REMOTE",
        salary: "",
        url: "",
        skillsInput: "",
        description: ""
      })

      await refreshData()
    } catch (err: unknown) {
      setAddJobError(err instanceof Error ? err.message : "Failed to create job.")
    } finally {
      setIsSubmittingJob(false)
    }
  }

  // Filter and sort items
  const filteredMatches = useMemo(() => {
    return matches
      .filter((item) => {
        if (effectiveSearchQuery.trim()) {
          const q = effectiveSearchQuery.toLowerCase().trim()
          const matched =
            item.jobTitle.toLowerCase().includes(q) ||
            item.company.toLowerCase().includes(q) ||
            item.requiredSkillsMatched.some((s) => s.toLowerCase().includes(q)) ||
            (item.location && item.location.toLowerCase().includes(q))
          if (!matched) return false
        }

        if (workModeFilter !== "ALL") {
          if (item.remoteStatus !== workModeFilter) {
            return false
          }
        }

        if (item.matchScore < minScoreFilter) {
          return false
        }

        return true
      })
      .sort((a, b) => {
        if (sortBy === "SCORE_DESC") return b.matchScore - a.matchScore
        return a.matchScore - b.matchScore
      })
  }, [matches, effectiveSearchQuery, workModeFilter, minScoreFilter, sortBy])

  return (
    <div className="flex flex-col gap-6">
      {/* Header and Active Resume Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">Matched Opportunities</h2>
            <span className="text-xs font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-800 px-2.5 py-0.5 rounded-full">
              Deterministic Matching
            </span>
          </div>
          <p className="text-neutral-400 text-xs mt-1">
            Transparent qualification scoring based on your verified resume skills, experience depth, and work preferences.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {activeResume ? (
            <div className="bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-xl text-xs text-neutral-300 flex items-center gap-2">
              <span className="text-emerald-400">📄</span>
              <span className="truncate max-w-[160px] font-medium">{activeResume.fileName}</span>
              <span className="text-neutral-500 font-mono">({activeResume.skills.length} skills)</span>
            </div>
          ) : onNavigateToResumes ? (
            <button
              type="button"
              onClick={onNavigateToResumes}
              className="text-xs text-amber-400 bg-amber-950/60 border border-amber-800 px-3 py-1.5 rounded-xl font-medium"
            >
              Upload Resume to Enable Matching →
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setShowAddJobModal(true)}
            className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm"
          >
            <span>+</span> Paste / Add Job
          </button>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-neutral-900/80 p-4 rounded-2xl border border-neutral-800 flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Keyword Search */}
          <div>
            <label className="block text-[11px] font-medium text-neutral-400 mb-1">
              Search Role / Company / Skill
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g. Full Stack, Python, AWS..."
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
            />
          </div>

          {/* Work Mode */}
          <div>
            <label className="block text-[11px] font-medium text-neutral-400 mb-1">
              Work Mode
            </label>
            <select
              value={workModeFilter}
              onChange={(e) => setWorkModeFilter(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-neutral-600"
            >
              <option value="ALL">All Work Modes</option>
              <option value="REMOTE">Remote Only</option>
              <option value="HYBRID">Hybrid</option>
              <option value="ON_SITE">On-site</option>
            </select>
          </div>

          {/* Minimum Match Score */}
          <div>
            <label className="block text-[11px] font-medium text-neutral-400 mb-1">
              Min Match Score: {minScoreFilter}%
            </label>
            <select
              value={minScoreFilter}
              onChange={(e) => setMinScoreFilter(Number(e.target.value))}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-neutral-600"
            >
              <option value={0}>All Scores (0%+)</option>
              <option value={50}>Moderate+ (50%+)</option>
              <option value={70}>Good Match (70%+)</option>
              <option value={85}>Strong Match (85%+)</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-[11px] font-medium text-neutral-400 mb-1">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "SCORE_DESC" | "SCORE_ASC")}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-neutral-600"
            >
              <option value="SCORE_DESC">Highest Match Score</option>
              <option value="SCORE_ASC">Lowest Match Score</option>
            </select>
          </div>
        </div>
      </div>

      {/* Opportunities Grid / List */}
      {loading ? (
        <div className="bg-neutral-900/40 p-12 rounded-2xl border border-neutral-800 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-neutral-400 text-xs">Evaluating opportunities against your profile...</p>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="bg-neutral-900/40 p-12 rounded-2xl border border-neutral-800 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center text-xl text-neutral-400">
            🔍
          </div>
          <h3 className="text-base font-semibold text-white">No Matching Opportunities Found</h3>
          <p className="text-neutral-400 text-xs max-w-sm">
            {matches.length === 0
              ? "Upload a resume to automatically discover and score opportunities based on your skills."
              : "Try adjusting your search criteria or min score threshold to view more opportunities."}
          </p>
          <button
            type="button"
            onClick={() => setShowAddJobModal(true)}
            className="mt-2 text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded-xl transition border border-neutral-700"
          >
            + Paste a Job Description to Match
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredMatches.map((job) => (
            <MatchCard
              key={job.jobId}
              id={job.jobId}
              company={job.company}
              role={job.jobTitle}
              location={job.location}
              remoteStatus={job.remoteStatus}
              matchPercentage={job.matchScore}
              scoreBreakdown={job.scoreBreakdown}
              isSample={job.isSample}
              source={job.source}
              url={job.url}
              salary={job.salary}
              matchedSkills={job.requiredSkillsMatched}
              missingSkills={job.requiredSkillsMissing}
              preferredSkillsMatched={job.preferredSkillsMatched}
              reasonsForMatch={job.reasonsForMatch}
              actionableRecommendations={job.actionableRecommendations}
              summary={job.summary}
              isSaved={savedJobsMap.get(job.jobId) === "SAVED"}
              currentApplicationStatus={savedJobsMap.get(job.jobId) || null}
              onSaveJob={handleSaveJob}
              onUpdateStatus={handleUpdateStatus}
            />
          ))}
        </div>
      )}

      {/* Manual Job Modal */}
      {showAddJobModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Paste / Add Job Vacancy</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Paste a raw job description to calculate immediate compatibility scores
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddJobModal(false)}
                className="text-neutral-400 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            {addJobError && (
              <div className="bg-rose-950/80 border border-rose-800 text-rose-300 p-3 rounded-xl text-xs">
                {addJobError}
              </div>
            )}

            <form onSubmit={handleCreateManualJob} className="flex flex-col gap-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                    Job Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={addJobForm.title}
                    onChange={(e) => setAddJobForm({ ...addJobForm, title: e.target.value })}
                    placeholder="e.g. Senior Full Stack Engineer"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-neutral-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={addJobForm.company}
                    onChange={(e) => setAddJobForm({ ...addJobForm, company: e.target.value })}
                    placeholder="e.g. Acme Labs"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-neutral-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={addJobForm.location}
                    onChange={(e) => setAddJobForm({ ...addJobForm, location: e.target.value })}
                    placeholder="Remote"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-neutral-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                    Work Mode
                  </label>
                  <select
                    value={addJobForm.remoteStatus}
                    onChange={(e) =>
                      setAddJobForm({
                        ...addJobForm,
                        remoteStatus: e.target.value as "REMOTE" | "HYBRID" | "ON_SITE"
                      })
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-neutral-600"
                  >
                    <option value="REMOTE">Remote</option>
                    <option value="HYBRID">Hybrid</option>
                    <option value="ON_SITE">On-site</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                    Salary (Optional)
                  </label>
                  <input
                    type="text"
                    value={addJobForm.salary}
                    onChange={(e) => setAddJobForm({ ...addJobForm, salary: e.target.value })}
                    placeholder="$140k - $170k"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-neutral-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-300 mb-1">
                  Full Job Description *
                </label>
                <textarea
                  required
                  rows={6}
                  value={addJobForm.description}
                  onChange={(e) => setAddJobForm({ ...addJobForm, description: e.target.value })}
                  placeholder="Paste complete job description here. Technical skills and requirements will be parsed automatically..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-neutral-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowAddJobModal(false)}
                  className="text-xs text-neutral-400 hover:text-white px-4 py-2 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingJob}
                  className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl transition"
                >
                  {isSubmittingJob ? "Evaluating..." : "Save & Evaluate Match"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
