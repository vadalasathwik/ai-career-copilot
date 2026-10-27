"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

export interface AnalysisRecord {
  id: number
  resumeId: number | null
  resumeFileName?: string
  targetRole: string | null
  jobDescription?: string | null
  atsScore: number
  skillsFound: string[]
  skillsMissing: string[]
  strengths: string[]
  improvements: string[]
  keywords: string[]
  recommendations: string[]
  summary?: string
  overallAssessment: string
  createdAt: string
  disclaimer?: string
}

interface ResumeOption {
  id: number
  fileName: string
  createdAt: string
}

interface ResumeAnalysisPanelProps {
  initialResumeId?: number
}

export default function ResumeAnalysisPanel({ initialResumeId }: ResumeAnalysisPanelProps) {
  const router = useRouter()

  const [resumes, setResumes] = useState<ResumeOption[]>([])
  const [loadingResumes, setLoadingResumes] = useState(true)

  const [selectedResumeId, setSelectedResumeId] = useState<string>(
    initialResumeId ? String(initialResumeId) : ""
  )
  const [targetRole, setTargetRole] = useState("")
  const [jobDescription, setJobDescription] = useState("")

  const [analyzing, setAnalyzing] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [missingApiKey, setMissingApiKey] = useState(false)
  const [activeAnalysis, setActiveAnalysis] = useState<AnalysisRecord | null>(null)

  const [history, setHistory] = useState<AnalysisRecord[]>([])
  const [showHistory, setShowHistory] = useState(false)

  // Timer for tracking analysis elapsed time
  useEffect(() => {
    if (!analyzing) return

    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [analyzing])

  // Load user resumes and past analyses on mount
  useEffect(() => {
    let active = true

    async function fetchInitialData() {
      try {
        const [resumesRes, analysesRes] = await Promise.all([
          fetch("/api/resumes"),
          fetch("/api/ai/analyses")
        ])

        if (!active) return

        if (resumesRes.ok) {
          const resumesData = await resumesRes.json()
          if (resumesData.success && Array.isArray(resumesData.resumes)) {
            setResumes(resumesData.resumes)
            if (resumesData.resumes.length > 0) {
              setSelectedResumeId((prev) => {
                if (prev) return prev
                if (initialResumeId) return String(initialResumeId)
                return String(resumesData.resumes[0].id)
              })
            }
          }
        }

        if (analysesRes.ok) {
          const analysesData = await analysesRes.json()
          if (analysesData.success && Array.isArray(analysesData.analyses)) {
            setHistory(analysesData.analyses)
            if (analysesData.analyses.length > 0) {
              setActiveAnalysis((prev) => prev || analysesData.analyses[0])
            }
          }
        }
      } catch {
        // Quietly ignore
      } finally {
        if (active) {
          setLoadingResumes(false)
        }
      }
    }

    fetchInitialData()

    return () => {
      active = false
    }
  }, [selectedResumeId, initialResumeId])

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault()
    if (analyzing) return

    setError(null)
    setMissingApiKey(false)

    if (!selectedResumeId) {
      setError("Please select an uploaded resume to analyze.")
      return
    }

    if (!targetRole.trim() || targetRole.trim().length < 2) {
      setError("Please enter a target job title of at least 2 characters.")
      return
    }

    if (!jobDescription.trim() || jobDescription.trim().length < 30) {
      setError("Please provide a detailed job description with at least 30 characters.")
      return
    }

    setElapsedSeconds(0)
    setAnalyzing(true)

    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeId: Number(selectedResumeId),
          targetRole: targetRole.trim(),
          jobDescription: jobDescription.trim()
        })
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        if (data.code === "MISSING_API_KEY") {
          setMissingApiKey(true)
        }
        throw new Error(data.message || "Failed to analyze resume.")
      }

      // Successful analysis
      setActiveAnalysis(data.analysis)
      setHistory((prev) => [data.analysis, ...prev])

      // Refresh server-side dashboard metrics
      router.refresh()
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred during analysis."
      )
    } finally {
      setAnalyzing(false)
      setElapsedSeconds(0)
    }
  }

  function getScoreStatus(score: number): { text: string; color: string; badge: string } {
    if (score >= 80) {
      return {
        text: "Strong Alignment",
        color: "text-emerald-400",
        badge: "bg-emerald-950/80 text-emerald-300 border-emerald-800"
      }
    }
    if (score >= 60) {
      return {
        text: "Moderate Alignment",
        color: "text-amber-400",
        badge: "bg-amber-950/80 text-amber-300 border-amber-800"
      }
    }
    return {
      text: "Needs Optimization",
      color: "text-rose-400",
      badge: "bg-rose-950/80 text-rose-300 border-rose-800"
    }
  }

  return (
    <div className="bg-neutral-900/80 p-6 rounded-2xl border border-neutral-800 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">ATS Resume Scanner</h2>
            <span className="text-xs bg-indigo-950/80 text-indigo-300 border border-indigo-800 px-2.5 py-0.5 rounded-full font-mono">
              Google Gemini Powered
            </span>
          </div>
          <p className="text-neutral-400 text-xs mt-1">
            Compare your resume against any target role to receive ATS compatibility scoring, identify skill gaps, and optimize for recruiter screening.
          </p>
        </div>

        {history.length > 0 && (
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="self-start sm:self-auto text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-3.5 py-1.5 rounded-xl border border-neutral-700 transition"
          >
            {showHistory ? "Hide Past Scans ▲" : `Past Scans (${history.length}) ▼`}
          </button>
        )}
      </div>

      {/* Analysis History Drawer */}
      {showHistory && history.length > 0 && (
        <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs uppercase tracking-wider text-neutral-400 font-semibold">
              Previous Scan History
            </h3>
            <span className="text-[11px] text-neutral-500">Click to inspect previous results</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {history.map((record) => {
              const isSelected = activeAnalysis?.id === record.id
              const status = getScoreStatus(record.atsScore)
              return (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => {
                    setActiveAnalysis(record)
                    setShowHistory(false)
                  }}
                  className={`text-left p-3.5 rounded-xl border transition ${
                    isSelected
                      ? "bg-neutral-900 border-neutral-500 ring-1 ring-neutral-500"
                      : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white truncate max-w-[140px]">
                      {record.targetRole || "General Analysis"}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-md border font-mono font-bold ${status.badge}`}
                    >
                      {record.atsScore}%
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-1.5 flex items-center justify-between">
                    <span>
                      {new Date(record.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      })}
                    </span>
                    <span className="text-neutral-400">{status.text}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Missing API Key Guidance Banner */}
      {missingApiKey && (
        <div className="bg-amber-950/60 border border-amber-800 text-amber-300 p-4 rounded-xl text-xs flex flex-col gap-2">
          <div className="font-semibold text-amber-200">
            ⚠️ GEMINI_API_KEY is not configured
          </div>
          <p className="leading-relaxed">
            Please configure your free Gemini API key in <code>.env</code> as{" "}
            <code>GEMINI_API_KEY=&quot;your-key&quot;</code> to enable genuine AI resume analysis.
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && !missingApiKey && (
        <div className="bg-rose-950/80 border border-rose-800 text-rose-300 text-xs p-3.5 rounded-xl flex items-center justify-between">
          <span className="font-medium">⚠️ {error}</span>
          <button
            onClick={() => setError(null)}
            className="text-rose-400 hover:text-rose-200 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleAnalyze} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Select Resume */}
          <div>
            <label className="block text-[11px] font-medium text-neutral-300 mb-1">
              Select Resume Document *
            </label>
            <select
              value={selectedResumeId}
              onChange={(e) => setSelectedResumeId(e.target.value)}
              disabled={analyzing || loadingResumes || resumes.length === 0}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-neutral-600 disabled:opacity-50"
            >
              {resumes.length === 0 ? (
                <option value="">No uploaded resumes found (upload above)</option>
              ) : (
                resumes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.fileName} (Uploaded {new Date(r.createdAt).toLocaleDateString()})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Target Role */}
          <div>
            <label className="block text-[11px] font-medium text-neutral-300 mb-1">
              Target Job Title *
            </label>
            <input
              type="text"
              required
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              disabled={analyzing}
              placeholder="e.g. Senior Full Stack Engineer"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Target Job Description */}
        <div>
          <label className="block text-[11px] font-medium text-neutral-300 mb-1">
            Target Job Description * (minimum 30 characters)
          </label>
          <textarea
            required
            rows={4}
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            disabled={analyzing}
            placeholder="Paste the target job description here. Gemini AI will evaluate your resume against its required skills, experience level, and key qualifications..."
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 disabled:opacity-50"
          />
        </div>

        {/* Progress Spinner Banner */}
        {analyzing && (
          <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin shrink-0" />
            <div className="flex-1 text-xs">
              <span className="font-semibold text-white">
                {elapsedSeconds < 10
                  ? "Extracting semantic qualification vectors..."
                  : "Evaluating ATS compatibility score with Gemini AI..."}
              </span>
              <span className="text-neutral-500 block text-[11px] mt-0.5">
                Elapsed: {elapsedSeconds}s • Bounded retry active for transient demand
              </span>
            </div>
          </div>
        )}

        {/* Submit Action */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-neutral-500">
            {resumes.length === 0
              ? "Upload a resume first to enable AI compatibility analysis."
              : "Structured evaluation powered by Google Gemini"}
          </span>

          <button
            type="submit"
            disabled={
              analyzing ||
              resumes.length === 0 ||
              targetRole.trim().length < 2 ||
              jobDescription.trim().length < 30
            }
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
          >
            {analyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Scanning Resume ({elapsedSeconds}s)...</span>
              </>
            ) : (
              <span>✨ Scan ATS Compatibility</span>
            )}
          </button>
        </div>
      </form>

      {/* Active Analysis Results Display */}
      {activeAnalysis && (
        <div className="border-t border-neutral-800 pt-6 flex flex-col gap-5">
          {/* Top Score Banner - Single Prominent Presentation */}
          <div className="bg-neutral-950 p-5 rounded-2xl border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold block mb-1">
                ATS Compatibility Assessment
              </span>
              <h3 className="text-xl font-bold text-white tracking-tight">
                {activeAnalysis.targetRole || "Target Role Analysis"}
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Evaluated against {activeAnalysis.resumeFileName || "selected resume"} on{" "}
                {new Date(activeAnalysis.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric"
                })}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[11px] text-neutral-400 block font-medium">
                  {getScoreStatus(activeAnalysis.atsScore).text}
                </span>
                <span className="text-[10px] text-neutral-500">Compatibility Index</span>
              </div>
              <div
                className={`text-3xl font-extrabold font-mono px-4 py-2 rounded-2xl border ${
                  getScoreStatus(activeAnalysis.atsScore).badge
                }`}
              >
                {activeAnalysis.atsScore}%
              </div>
            </div>
          </div>

          {/* AI Estimate Disclaimer */}
          <div className="bg-neutral-950/60 px-4 py-3 rounded-xl border border-neutral-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-neutral-400">
            <div className="flex items-center gap-2 text-neutral-300 font-medium">
              <span className="text-indigo-400">ℹ</span>
              <span>AI-Generated Compatibility Estimate</span>
            </div>
            <div className="text-neutral-500 text-[11px]">
              This score is an estimate based on job description matching, not an employer&apos;s actual ATS result.
            </div>
          </div>

          {/* Executive Assessment */}
          {activeAnalysis.overallAssessment && (
            <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800">
              <h4 className="text-[11px] uppercase tracking-wider text-neutral-400 font-bold mb-1.5">
                Executive Assessment
              </h4>
              <p className="text-xs text-neutral-300 leading-relaxed">
                {activeAnalysis.overallAssessment}
              </p>
            </div>
          )}

          {/* Skills Breakdown Grid: Matched vs Missing */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Identified Skills */}
            <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800 flex flex-col gap-2.5">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <span>✓</span>
                  <span>Skills Identified ({activeAnalysis.skillsFound.length})</span>
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {activeAnalysis.skillsFound.map((skill, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-950/60 text-emerald-300 border border-emerald-800/80 font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Missing Skills */}
            <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800 flex flex-col gap-2.5">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                  <span>✕</span>
                  <span>Missing Requirements ({activeAnalysis.skillsMissing.length})</span>
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {activeAnalysis.skillsMissing.map((skill, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-rose-950/60 text-rose-300 border border-rose-800/80 font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Qualitative Feedback: Strengths vs Improvements */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Strengths */}
            <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800 flex flex-col gap-2.5">
              <span className="text-xs font-bold text-white border-b border-neutral-800 pb-2 flex items-center gap-1.5">
                <span className="text-emerald-400">★</span>
                <span>Candidate Strengths</span>
              </span>
              <ul className="flex flex-col gap-2 text-xs text-neutral-300 pt-1">
                {activeAnalysis.strengths.map((str, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span className="leading-relaxed">{str}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Improvements */}
            <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800 flex flex-col gap-2.5">
              <span className="text-xs font-bold text-white border-b border-neutral-800 pb-2 flex items-center gap-1.5">
                <span className="text-amber-400">⚡</span>
                <span>Areas for Improvement</span>
              </span>
              <ul className="flex flex-col gap-2 text-xs text-neutral-300 pt-1">
                {activeAnalysis.improvements.map((imp, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    <span className="leading-relaxed">{imp}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Keywords & Tailored Recommendations */}
          {activeAnalysis.keywords && activeAnalysis.keywords.length > 0 && (
            <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800 flex flex-col gap-2.5">
              <span className="text-xs font-bold text-white border-b border-neutral-800 pb-2 flex items-center gap-1.5">
                <span className="text-purple-400">🔑</span>
                <span>ATS Semantic Keywords</span>
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {activeAnalysis.keywords.map((kw, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] font-mono px-2 py-0.5 rounded bg-neutral-900 text-neutral-300 border border-neutral-800"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
