"use client"

import { useState } from "react"

export type ApplicationStatusType =
  | "INTERESTED"
  | "SAVED"
  | "APPLIED"
  | "INTERVIEW"
  | "OFFER"
  | "REJECTED"

export interface MatchScoreBreakdownProps {
  requiredSkillsScore: number
  preferredSkillsScore: number
  experienceScore: number
  seniorityScore: number
  locationScore: number
  total: number
}

export interface MatchCardProps {
  id?: number
  company: string
  role: string
  location?: string | null
  remoteStatus?: "REMOTE" | "HYBRID" | "ON_SITE" | string | null
  skills?: string[]
  matchedSkills?: string[]
  missingSkills?: string[]
  preferredSkillsMatched?: string[]
  preferredSkillsMissing?: string[]
  unassessedSkills?: string[]
  matchPercentage?: number
  scoreBreakdown?: MatchScoreBreakdownProps
  isSample?: boolean
  source?: string
  url?: string | null
  salary?: string | null
  employmentType?: string | null
  lastVerifiedAt?: string | null
  reasonsForMatch?: string[]
  actionableRecommendations?: string[]
  summary?: string
  isSaved?: boolean
  currentApplicationStatus?: ApplicationStatusType | null
  onSaveJob?: (jobId: number) => Promise<void>
  onUpdateStatus?: (jobId: number, status: ApplicationStatusType) => Promise<void>
}

export default function MatchCard({
  id,
  company,
  role,
  location,
  remoteStatus,
  matchedSkills = [],
  missingSkills = [],
  matchPercentage = 0,
  scoreBreakdown,
  isSample = false,
  salary,
  reasonsForMatch = [],
  actionableRecommendations = [],
  summary,
  isSaved = false,
  currentApplicationStatus,
  onSaveJob,
  onUpdateStatus
}: MatchCardProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [localStatus, setLocalStatus] = useState<ApplicationStatusType | null>(
    currentApplicationStatus || null
  )
  const [localSaved, setLocalSaved] = useState<boolean>(isSaved || currentApplicationStatus === "SAVED")

  function getScoreBadgeColor(score: number) {
    if (score >= 75) {
      return "text-emerald-300 bg-emerald-950/80 border-emerald-800"
    }
    if (score >= 50) {
      return "text-amber-300 bg-amber-950/80 border-amber-800"
    }
    return "text-rose-300 bg-rose-950/80 border-rose-800"
  }

  function getWorkModeBadge(mode?: string | null) {
    if (!mode) return null
    if (mode === "REMOTE") {
      return (
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-medium">
          🌐 Remote
        </span>
      )
    }
    if (mode === "HYBRID") {
      return (
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800 font-medium">
          🏢 Hybrid
        </span>
      )
    }
    return (
      <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700 font-medium">
        📍 On-site
      </span>
    )
  }

  async function handleSaveClick() {
    if (!id || saving) return
    try {
      setSaving(true)
      if (onSaveJob) {
        await onSaveJob(id)
      } else {
        await fetch("/api/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: id, status: "SAVED" })
        })
      }
      setLocalSaved(true)
      if (!localStatus) {
        setLocalStatus("SAVED")
      }
    } catch {
      // Quiet fail
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusSelect(status: ApplicationStatusType) {
    if (!id || updatingStatus) return
    try {
      setUpdatingStatus(true)
      if (onUpdateStatus) {
        await onUpdateStatus(id, status)
      } else {
        await fetch("/api/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: id, status })
        })
      }
      setLocalStatus(status)
      if (status === "SAVED") {
        setLocalSaved(true)
      }
    } catch {
      // Quiet fail
    } finally {
      setUpdatingStatus(false)
    }
  }

  const visibleSkills = matchedSkills.slice(0, 4)
  const remainingSkillsCount = matchedSkills.length - 4

  return (
    <div className="bg-neutral-900/80 p-5 rounded-2xl border border-neutral-800 flex flex-col justify-between transition hover:border-neutral-700/90 hover:bg-neutral-900">
      <div className="flex flex-col gap-3.5">
        {/* Top Header: Title, Score & Tags */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-base font-bold text-white tracking-tight truncate">
                {role}
              </h3>
              {isSample && (
                <span
                  title="Demonstration record for validating local matching heuristics."
                  className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-neutral-950 text-neutral-400 border border-neutral-800"
                >
                  Sample Vacancy
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 text-xs text-neutral-400 flex-wrap">
              <span className="font-semibold text-neutral-200">{company}</span>
              {location && <span>• {location}</span>}
              {salary && <span>• {salary}</span>}
              {getWorkModeBadge(remoteStatus)}
            </div>
          </div>

          {/* Compatibility Score Badge */}
          <div className="flex flex-col items-end">
            <div
              className={`text-sm font-extrabold font-mono px-3 py-1 rounded-xl border flex items-center gap-1 ${getScoreBadgeColor(
                matchPercentage
              )}`}
            >
              <span>{matchPercentage}%</span>
              <span className="text-[10px] font-normal opacity-80">Match</span>
            </div>
          </div>
        </div>

        {/* Match Summary */}
        <p className="text-xs text-neutral-300 leading-relaxed line-clamp-2">
          {summary || (reasonsForMatch.length > 0 ? reasonsForMatch[0] : "Good technical qualification alignment with your profile.")}
        </p>

        {/* Matched Skills Chips */}
        {matchedSkills.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-neutral-500 font-medium">Matches:</span>
            {visibleSkills.map((skill, idx) => (
              <span
                key={idx}
                className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-800/80 font-medium"
              >
                {skill}
              </span>
            ))}
            {remainingSkillsCount > 0 && (
              <span className="text-[10px] text-neutral-400 px-1.5 py-0.5 rounded bg-neutral-800">
                +{remainingSkillsCount} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Action Controls & Footer */}
      <div className="mt-4 pt-3.5 border-t border-neutral-800/80 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Detailed Scoring Toggle Button */}
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-neutral-400 hover:text-white transition flex items-center gap-1 font-medium"
          >
            {showDetails ? "Hide Scoring Breakdown ▲" : "View Scoring Breakdown ▼"}
          </button>

          <div className="flex items-center gap-2">
            {/* Clear Job-Saving Action */}
            <button
              type="button"
              onClick={handleSaveClick}
              disabled={saving || localSaved}
              className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition flex items-center gap-1.5 ${
                localSaved
                  ? "bg-amber-950/60 text-amber-300 border-amber-800/80 cursor-default"
                  : "bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700"
              }`}
            >
              <span>{localSaved ? "★" : "☆"}</span>
              <span>{saving ? "Saving..." : localSaved ? "Saved" : "Save Job"}</span>
            </button>

            {/* Application-Status Dropdown Control */}
            <select
              value={localStatus || "UNTRACKED"}
              disabled={updatingStatus}
              onChange={(e) => {
                const val = e.target.value
                if (val !== "UNTRACKED") {
                  handleStatusSelect(val as ApplicationStatusType)
                }
              }}
              className={`text-xs px-2.5 py-1.5 rounded-xl border font-medium focus:outline-none transition cursor-pointer ${
                localStatus
                  ? "bg-blue-950/60 text-blue-300 border-blue-800/80"
                  : "bg-neutral-800 text-neutral-300 border-neutral-700 hover:border-neutral-600"
              }`}
            >
              <option value="UNTRACKED" disabled className="bg-neutral-900 text-neutral-400">
                Track Application ▼
              </option>
              <option value="INTERESTED" className="bg-neutral-900 text-neutral-200">
                Interested
              </option>
              <option value="SAVED" className="bg-neutral-900 text-neutral-200">
                Saved
              </option>
              <option value="APPLIED" className="bg-neutral-900 text-neutral-200">
                Applied
              </option>
              <option value="INTERVIEW" className="bg-neutral-900 text-neutral-200">
                Interviewing
              </option>
              <option value="OFFER" className="bg-neutral-900 text-neutral-200">
                Offer Received
              </option>
              <option value="REJECTED" className="bg-neutral-900 text-neutral-200">
                Archived / Rejected
              </option>
            </select>
          </div>
        </div>

        {/* Expandable Mathematical Breakdown Panel */}
        {showDetails && scoreBreakdown && (
          <div className="mt-2 p-3.5 bg-neutral-950 rounded-xl border border-neutral-800 text-xs flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <span className="font-semibold text-white">Deterministic Scoring Breakdown</span>
              <span className="text-[11px] font-mono text-emerald-400">
                Total: {scoreBreakdown.total}%
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="bg-neutral-900/60 p-2 rounded-lg border border-neutral-800/80">
                <span className="text-[10px] text-neutral-400 block">Required Skills (45%)</span>
                <span className="font-mono text-white font-semibold">
                  {scoreBreakdown.requiredSkillsScore} pts
                </span>
              </div>

              <div className="bg-neutral-900/60 p-2 rounded-lg border border-neutral-800/80">
                <span className="text-[10px] text-neutral-400 block">Preferred Skills (20%)</span>
                <span className="font-mono text-white font-semibold">
                  {scoreBreakdown.preferredSkillsScore} pts
                </span>
              </div>

              <div className="bg-neutral-900/60 p-2 rounded-lg border border-neutral-800/80">
                <span className="text-[10px] text-neutral-400 block">Experience Depth (20%)</span>
                <span className="font-mono text-white font-semibold">
                  {scoreBreakdown.experienceScore} pts
                </span>
              </div>

              <div className="bg-neutral-900/60 p-2 rounded-lg border border-neutral-800/80">
                <span className="text-[10px] text-neutral-400 block">Seniority Alignment (10%)</span>
                <span className="font-mono text-white font-semibold">
                  {scoreBreakdown.seniorityScore} pts
                </span>
              </div>

              <div className="bg-neutral-900/60 p-2 rounded-lg border border-neutral-800/80">
                <span className="text-[10px] text-neutral-400 block">Work Mode (5%)</span>
                <span className="font-mono text-white font-semibold">
                  {scoreBreakdown.locationScore} pts
                </span>
              </div>
            </div>

            {/* Recommendations / Skill Gaps */}
            {missingSkills.length > 0 && (
              <div className="pt-2 border-t border-neutral-800/80">
                <span className="text-[11px] font-medium text-amber-400 block mb-1">
                  Skills Missing on Resume:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {missingSkills.map((sk, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] px-2 py-0.5 rounded bg-rose-950/40 text-rose-300 border border-rose-900/60"
                    >
                      {sk}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {actionableRecommendations.length > 0 && (
              <div className="pt-2 border-t border-neutral-800/80 text-[11px] text-neutral-400">
                <span className="font-medium text-neutral-300 block mb-1">Match Optimization Tip:</span>
                <p>{actionableRecommendations[0]}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
