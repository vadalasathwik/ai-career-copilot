"use client"

import { useState, useEffect } from "react"

interface AnalysisSummary {
  id: number
  targetRole: string | null
  atsScore: number
  skillsFound: string[]
  skillsMissing: string[]
  improvements: string[]
  strengths: string[]
  keywords: string[]
  recommendations: string[]
  createdAt: string
}

interface CareerRecommendationsProps {
  onNavigateToScanner?: () => void
  onNavigateToJobs?: () => void
}

export default function CareerRecommendations({
  onNavigateToScanner,
  onNavigateToJobs
}: CareerRecommendationsProps) {
  const [loading, setLoading] = useState(true)
  const [latestAnalysis, setLatestAnalysis] = useState<AnalysisSummary | null>(null)

  useEffect(() => {
    async function fetchLatestAnalysis() {
      try {
        setLoading(true)
        const res = await fetch("/api/ai/analyses")
        if (res.ok) {
          const data = await res.json()
          if (data.success && Array.isArray(data.analyses) && data.analyses.length > 0) {
            setLatestAnalysis(data.analyses[0])
          }
        }
      } catch {
        // Quiet fail
      } finally {
        setLoading(false)
      }
    }

    fetchLatestAnalysis()
  }, [])

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">Career Recommendations</h2>
            <span className="text-xs font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-800 px-2.5 py-0.5 rounded-full">
              Factual & Evidence-Based
            </span>
          </div>
          <p className="text-neutral-400 text-xs mt-1">
            Actionable resume optimizations and skill gap strategies derived from your verified ATS scans.
          </p>
        </div>

        {onNavigateToScanner && (
          <button
            type="button"
            onClick={onNavigateToScanner}
            className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl transition flex items-center gap-2 self-start sm:self-auto shadow-sm"
          >
            <span>✨</span> Run New ATS Scan
          </button>
        )}
      </div>

      {loading ? (
        <div className="bg-neutral-900/50 p-12 rounded-2xl border border-neutral-800 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-neutral-400 text-xs">Loading recommendation records...</p>
        </div>
      ) : !latestAnalysis ? (
        /* Empty / Onboarding State */
        <div className="bg-neutral-900/40 p-12 rounded-2xl border border-neutral-800/80 text-center flex flex-col items-center justify-center gap-4">
          <div className="w-14 h-14 rounded-full bg-neutral-800 flex items-center justify-center text-2xl text-neutral-400">
            💡
          </div>
          <div className="max-w-md flex flex-col gap-1.5">
            <h3 className="text-base font-semibold text-white">No ATS Analysis Completed Yet</h3>
            <p className="text-neutral-400 text-xs leading-relaxed">
              To guarantee accuracy, AI Career Copilot never invents qualifications or generates speculative advice. Upload your resume and run an ATS analysis against a target job to generate tailored recommendations.
            </p>
          </div>
          {onNavigateToScanner && (
            <button
              type="button"
              onClick={onNavigateToScanner}
              className="mt-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl transition shadow-sm"
            >
              Analyze Resume Now
            </button>
          )}
        </div>
      ) : (
        /* Analysis-backed recommendations */
        <div className="flex flex-col gap-6">
          {/* Target Role Context Banner */}
          <div className="bg-neutral-900/70 p-4 rounded-xl border border-neutral-800 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-lg">🎯</span>
              <div>
                <span className="text-[11px] text-neutral-400 font-medium block">
                  Tailored for target role
                </span>
                <span className="text-sm font-bold text-white">
                  {latestAnalysis.targetRole || "General Technical Role"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400">Baseline ATS Compatibility:</span>
              <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800">
                {latestAnalysis.atsScore}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 1. High Impact Resume Improvements */}
            <div className="bg-neutral-900/70 p-5 rounded-2xl border border-neutral-800 flex flex-col gap-4">
              <div className="flex items-center gap-2.5 border-b border-neutral-800 pb-3">
                <span className="text-amber-400 text-base">⚡</span>
                <div>
                  <h3 className="text-sm font-bold text-white">High Priority Resume Adjustments</h3>
                  <p className="text-[11px] text-neutral-400">
                    Concrete wording and framing changes to increase screening pass rates
                  </p>
                </div>
              </div>

              {latestAnalysis.improvements && latestAnalysis.improvements.length > 0 ? (
                <ul className="flex flex-col gap-2.5 text-xs text-neutral-300">
                  {latestAnalysis.improvements.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 bg-neutral-950/60 p-3 rounded-xl border border-neutral-800/80">
                      <span className="text-amber-400 font-bold select-none">•</span>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-neutral-500 italic">No specific critical resume weaknesses identified in latest scan.</p>
              )}
            </div>

            {/* 2. Target Technical Skills to Develop */}
            <div className="bg-neutral-900/70 p-5 rounded-2xl border border-neutral-800 flex flex-col gap-4">
              <div className="flex items-center gap-2.5 border-b border-neutral-800 pb-3">
                <span className="text-cyan-400 text-base">🛠</span>
                <div>
                  <h3 className="text-sm font-bold text-white">Skill Gaps to Address</h3>
                  <p className="text-[11px] text-neutral-400">
                    Target skills present in job requirements but unverified on your resume
                  </p>
                </div>
              </div>

              {latestAnalysis.skillsMissing && latestAnalysis.skillsMissing.length > 0 ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2">
                    {latestAnalysis.skillsMissing.map((skill, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2.5 py-1 rounded-lg bg-rose-950/60 text-rose-300 border border-rose-800/80 font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed bg-neutral-950/60 p-3 rounded-xl border border-neutral-800/80">
                    💡 If you have hands-on experience with any of these technologies, add verified bullet points demonstrating project outcomes to your resume.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-neutral-500 italic">No missing core technical skills detected for this target profile.</p>
              )}
            </div>

            {/* 3. Verified Candidate Strengths */}
            <div className="bg-neutral-900/70 p-5 rounded-2xl border border-neutral-800 flex flex-col gap-4">
              <div className="flex items-center gap-2.5 border-b border-neutral-800 pb-3">
                <span className="text-emerald-400 text-base">✓</span>
                <div>
                  <h3 className="text-sm font-bold text-white">Verified Profile Strengths</h3>
                  <p className="text-[11px] text-neutral-400">
                    Strongest established qualifications to emphasize in outreach & interviews
                  </p>
                </div>
              </div>

              {latestAnalysis.strengths && latestAnalysis.strengths.length > 0 ? (
                <ul className="flex flex-col gap-2.5 text-xs text-neutral-300">
                  {latestAnalysis.strengths.map((strength, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 bg-neutral-950/60 p-3 rounded-xl border border-neutral-800/80">
                      <span className="text-emerald-400 font-bold select-none">✓</span>
                      <span className="leading-relaxed">{strength}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-neutral-500 italic">No specific strengths recorded.</p>
              )}
            </div>

            {/* 4. Strategic ATS Keywords */}
            <div className="bg-neutral-900/70 p-5 rounded-2xl border border-neutral-800 flex flex-col gap-4">
              <div className="flex items-center gap-2.5 border-b border-neutral-800 pb-3">
                <span className="text-purple-400 text-base">🔑</span>
                <div>
                  <h3 className="text-sm font-bold text-white">Recommended ATS Keywords</h3>
                  <p className="text-[11px] text-neutral-400">
                    High-value semantic terms to incorporate into your work summaries
                  </p>
                </div>
              </div>

              {latestAnalysis.keywords && latestAnalysis.keywords.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {latestAnalysis.keywords.map((kw, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-2.5 py-1 rounded-lg bg-neutral-950 text-neutral-200 border border-neutral-800 font-mono"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-neutral-500 italic">No keyword suggestions available.</p>
              )}

              {onNavigateToJobs && (
                <div className="mt-auto pt-2">
                  <button
                    type="button"
                    onClick={onNavigateToJobs}
                    className="w-full text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-white py-2 rounded-xl border border-neutral-700 transition"
                  >
                    View Matching Opportunities →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
