"use client"

import { useEffect, useRef, useState } from "react"
import type { JobMatchAnalysisReport } from "@/backend/services/aiService"
import LearningPlanSection from "./LearningPlanSection"

interface ResumeSummary {
  id: number
  fileName: string
}

interface JobMatchSectionProps {
  currentResume: ResumeSummary | null
}

interface InterviewPracticeQuestion {
  question: string
  jobRequirement: string
  resumeExcerpt: string | null
  evidenceStatus: "evidence" | "gap"
  evidenceMethod: "vector" | "semantic" | "keyword" | "none"
  questionGeneration: "gemini" | "template"
  gapExplanation?: string
}

interface CompletedMatch {
  result: JobMatchAnalysisReport
  resumeId: number
  jobDescription: string
}

function InterviewPrep({ resumeId, jobDescription }: { resumeId: number; jobDescription: string }) {
  const [questions, setQuestions] = useState<InterviewPracticeQuestion[] | null>(null)
  const [keywordFallbackUsed, setKeywordFallbackUsed] = useState(false)
  const [questionGenerationFallbackUsed, setQuestionGenerationFallbackUsed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)
  const controller = useRef<AbortController | null>(null)

  useEffect(() => () => controller.current?.abort(), [])

  async function generate() {
    const id = ++requestId.current
    controller.current?.abort()
    const nextController = new AbortController()
    controller.current = nextController
    setLoading(true)
    setError(null)
    setQuestions(null)
    setKeywordFallbackUsed(false)
    setQuestionGenerationFallbackUsed(false)

    try {
      const response = await fetch("/api/interview-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: nextController.signal,
        body: JSON.stringify({ resumeId, jobDescription })
      })
      const data = await response.json()
      if (id !== requestId.current) return
      if (!response.ok || !data.success) throw new Error(data.message || "Could not generate practice questions.")
      setQuestions(Array.isArray(data.questions) ? data.questions : [])
      setKeywordFallbackUsed(Boolean(data.retrieval?.keywordFallbackUsed))
      setQuestionGenerationFallbackUsed(Boolean(data.retrieval?.questionGenerationFallbackUsed))
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return
      if (id === requestId.current) setError(err instanceof Error ? err.message : "Could not generate practice questions.")
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }

  return (
    <section className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800 flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-white">Interview Prep with Resume Evidence</h4>
          <p className="text-[11px] text-neutral-400 mt-1">Questions are retrieved from this job description and only cite verbatim resume text.</p>
        </div>
        <button type="button" onClick={generate} disabled={loading} className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl transition disabled:opacity-50 shrink-0">
          {loading ? "Generating..." : questions ? "Generate again" : "Generate practice questions"}
        </button>
      </div>
      {error && <div className="bg-rose-950/80 border border-rose-800 text-rose-300 text-xs p-3 rounded-xl flex items-center justify-between gap-3"><span>⚠️ {error}</span><button type="button" onClick={generate} className="underline font-semibold">Retry</button></div>}
      {questions && <>
        {keywordFallbackUsed && <p className="text-[11px] text-indigo-200 bg-indigo-950/40 border border-indigo-900/70 rounded-lg px-3 py-2">Some evidence uses exact keyword retrieval because no semantic paraphrase was available.</p>}
        {questionGenerationFallbackUsed && <p className="text-[11px] text-amber-200 bg-amber-950/30 border border-amber-900/70 rounded-lg px-3 py-2">Some questions use the reliable practice template because Gemini generation was unavailable or could not validate a citation.</p>}
        <ol className="flex flex-col gap-3">
          {questions.map((item, index) => <li key={`${item.jobRequirement}-${index}`} className="border border-neutral-800 rounded-xl p-3.5 text-xs break-words">
            <div className="flex items-start gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-neutral-800 text-neutral-300 text-[10px] font-bold flex items-center justify-center">{index + 1}</span>
              <p className="font-semibold text-white leading-relaxed pt-0.5">{item.question}</p>
            </div>
            <div className="mt-3 rounded-lg bg-neutral-900/70 px-3 py-2 text-neutral-300 leading-relaxed"><span className="font-semibold text-neutral-100">Job requirement:</span> {item.jobRequirement}</div>
            {item.evidenceStatus === "evidence" && item.resumeExcerpt ? <blockquote className="mt-2 border-l-2 border-emerald-600 bg-emerald-950/20 pl-3 py-2 text-emerald-100 leading-relaxed"><span className="font-semibold">Resume evidence{item.evidenceMethod === "vector" ? " · vector match" : item.evidenceMethod === "semantic" ? " · synonym match" : " · keyword match"}:</span> “{item.resumeExcerpt}”</blockquote> : <div className="mt-2 rounded-lg border border-amber-900/80 bg-amber-950/30 px-3 py-2 text-amber-200 leading-relaxed"><span className="font-semibold">Practice gap:</span> {item.gapExplanation || "No resume excerpt met the evidence rule for this requirement."}</div>}
          </li>)}
          {questions.length === 0 && <li className="text-xs text-neutral-400">No clear requirements were found. Add more detail to the job description and try again.</li>}
        </ol>
      </>}
    </section>
  )
}

export default function JobMatchSection({ currentResume }: JobMatchSectionProps) {
  const [inputMode, setInputMode] = useState<"paste" | "url">("paste")
  const [jobUrl, setJobUrl] = useState("")
  const [fetchingUrl, setFetchingUrl] = useState(false)
  const [urlMessage, setUrlMessage] = useState<{ text: string; type: "error" | "info" | "success" } | null>(null)

  const [targetRole, setTargetRole] = useState("")
  const [jobCompany, setJobCompany] = useState("")
  const [jobDescription, setJobDescription] = useState("")

  const [matching, setMatching] = useState(false)
  const [matchError, setMatchError] = useState<string | null>(null)
  const [completedMatch, setCompletedMatch] = useState<CompletedMatch | null>(null)
  const matchResult = completedMatch?.result ?? null
  const hasCurrentMatch = Boolean(
    completedMatch &&
    completedMatch.resumeId === currentResume?.id &&
    completedMatch.jobDescription === jobDescription.trim()
  )

  // Handle URL Fetching via server endpoint
  async function handleFetchUrl(e: React.FormEvent) {
    e.preventDefault()
    setUrlMessage(null)

    if (!jobUrl.trim() || !jobUrl.trim().startsWith("http")) {
      setUrlMessage({ text: "Please enter a valid HTTP or HTTPS job posting URL.", type: "error" })
      return
    }

    try {
      setFetchingUrl(true)
      const res = await fetch("/api/jobs/fetch-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: jobUrl.trim() })
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setUrlMessage({
          text:
            data.message ||
            "Could not read the job page directly. Please paste the job description text manually below.",
          type: "info"
        })
        setInputMode("paste")
        return
      }

      if (data.title) setTargetRole(data.title)
      if (data.company) setJobCompany(data.company)
      if (data.description) setJobDescription(data.description)

      setUrlMessage({
        text: `Successfully retrieved posting content${data.title ? ` for "${data.title}"` : ""}. Please review the extracted description below before analyzing.`,
        type: "success"
      })
      setInputMode("paste")
    } catch {
      setUrlMessage({
        text: "Connecting to job URL timed out or failed. Please paste the job description text manually below.",
        type: "info"
      })
      setInputMode("paste")
    } finally {
      setFetchingUrl(false)
    }
  }

  // Handle Job Matching analysis
  async function handleRunJobMatch(e: React.FormEvent) {
    e.preventDefault()
    setMatchError(null)

    if (!currentResume) {
      setMatchError("Please upload or select a resume in Resume Review first.")
      return
    }

    if (!jobDescription.trim() || jobDescription.trim().length < 30) {
      setMatchError("Please provide a detailed job description of at least 30 characters.")
      return
    }

    try {
      setMatching(true)
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeId: currentResume.id,
          targetRole: targetRole.trim() || "Specified Position",
          jobDescription: jobDescription.trim()
        })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Job match analysis failed.")
      }

      setCompletedMatch({ result: data.jobMatch || data.analysis, resumeId: currentResume.id, jobDescription: jobDescription.trim() })
    } catch (err: unknown) {
      setMatchError(err instanceof Error ? err.message : "Job match analysis failed.")
    } finally {
      setMatching(false)
    }
  }

  function handleResetJob() {
    setCompletedMatch(null)
    setJobDescription("")
    setTargetRole("")
    setJobCompany("")
    setJobUrl("")
    setUrlMessage(null)
  }

  function getScoreBadgeColor(score: number) {
    if (score >= 80) return "bg-emerald-950 text-emerald-300 border-emerald-800"
    if (score >= 60) return "bg-amber-950 text-amber-300 border-amber-800"
    return "bg-rose-950 text-rose-300 border-rose-800"
  }

  return (
    <div className="bg-neutral-900/80 p-6 sm:p-7 rounded-3xl border border-neutral-800 flex flex-col gap-6 shadow-sm">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🎯</span>
            <h2 className="text-xl font-bold text-white tracking-tight">Job Match</h2>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            See how well your resume aligns with a role before you apply.
          </p>
        </div>

        {hasCurrentMatch && (
          <button
            type="button"
            onClick={handleResetJob}
            className="text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-3.5 py-2 rounded-xl border border-neutral-700 transition self-start sm:self-auto"
          >
            + Analyze Another Job
          </button>
        )}
      </div>

      {/* Input Selector Tabs: Paste vs URL */}
      {!hasCurrentMatch && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 p-1 bg-neutral-950 rounded-xl border border-neutral-800 w-fit">
            <button
              type="button"
              onClick={() => {
                setInputMode("paste")
                setUrlMessage(null)
              }}
              className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition ${
                inputMode === "paste"
                  ? "bg-neutral-800 text-white shadow-sm border border-neutral-700"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Paste Job Description
            </button>
            <button
              type="button"
              onClick={() => {
                setInputMode("url")
                setUrlMessage(null)
              }}
              className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition ${
                inputMode === "url"
                  ? "bg-neutral-800 text-white shadow-sm border border-neutral-700"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Use Job URL
            </button>
          </div>

          {/* Feedback messages */}
          {urlMessage && (
            <div
              className={`p-3.5 rounded-xl border text-xs leading-relaxed flex items-center justify-between gap-2 ${
                urlMessage.type === "success"
                  ? "bg-emerald-950/70 border-emerald-800 text-emerald-300"
                  : urlMessage.type === "error"
                  ? "bg-rose-950/70 border-rose-800 text-rose-300"
                  : "bg-amber-950/70 border-amber-800 text-amber-300"
              }`}
            >
              <span>{urlMessage.text}</span>
              {inputMode === "url" && urlMessage.type !== "success" && (
                <button
                  type="button"
                  onClick={() => setInputMode("paste")}
                  className="underline font-semibold shrink-0 text-amber-200 hover:text-white"
                >
                  Paste Manually →
                </button>
              )}
            </div>
          )}

          {/* URL Input Form */}
          {inputMode === "url" && (
            <form onSubmit={handleFetchUrl} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="url"
                required
                id="job-url"
                aria-label="Job posting URL"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="https://www.linkedin.com/jobs/view/... or company career page URL"
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={fetchingUrl || !jobUrl.trim()}
                className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 shrink-0"
              >
                {fetchingUrl ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Fetching...</span>
                  </>
                ) : (
                  <span>Fetch Job Details</span>
                )}
              </button>
            </form>
          )}

          {/* Job Description Form */}
          <form onSubmit={handleRunJobMatch} className="flex flex-col gap-4">
            {inputMode === "url" && !jobDescription.trim() && (
              <div className="bg-neutral-950/40 p-4 rounded-xl border border-neutral-800 text-xs text-neutral-400">
                💡 Enter a public job posting URL above and click <strong>Fetch Job Details</strong>. You can review and edit the extracted role requirements before running match analysis.
              </div>
            )}

            {inputMode === "url" && jobDescription.trim() && (
              <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <span>✓</span>
                <span>Review & edit extracted job posting details before analyzing:</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label htmlFor="job-title-input" className="block text-[11px] font-medium text-neutral-300 mb-1">
                  Job Title / Target Role *
                </label>
                <input
                  id="job-title-input"
                  type="text"
                  required
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="e.g. Senior Full Stack Engineer"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label htmlFor="job-company-input" className="block text-[11px] font-medium text-neutral-300 mb-1">
                  Hiring Company (Optional)
                </label>
                <input
                  id="job-company-input"
                  type="text"
                  value={jobCompany}
                  onChange={(e) => setJobCompany(e.target.value)}
                  placeholder="e.g. Apex Systems, Stripe, etc."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="job-desc-input" className="block text-[11px] font-medium text-neutral-300">
                  Job Description Content * (min 30 characters)
                </label>
                <span className="text-[10px] text-neutral-500">
                  {jobDescription.length > 0 ? `${jobDescription.length} characters` : ""}
                </span>
              </div>
              <textarea
                id="job-desc-input"
                required
                rows={6}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the target job description here. Review and edit any extracted text to ensure all required skills and qualifications are included..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 focus:ring-1 focus:ring-emerald-500 leading-relaxed font-mono"
              />
            </div>

            {matchError && (
              <div className="bg-rose-950/80 border border-rose-800 text-rose-300 text-xs p-3 rounded-xl flex items-center justify-between">
                <span>⚠️ {matchError}</span>
                <button type="button" onClick={() => setMatchError(null)} className="text-rose-400 font-bold ml-2">
                  ✕
                </button>
              </div>
            )}

            <div className="flex items-center justify-between pt-1 flex-wrap gap-3">
              <span className="text-[11px] text-neutral-500">
                {currentResume
                  ? `Comparing against resume: ${currentResume.fileName}`
                  : "Upload a resume in Resume Review before running analysis."}
              </span>

              <button
                type="submit"
                disabled={matching || !currentResume || jobDescription.trim().length < 30}
                className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl transition flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {matching ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing Match...</span>
                  </>
                ) : (
                  <span>Analyze Match</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Match Results Display */}
      {hasCurrentMatch && matchResult && completedMatch && (
        <div className="flex flex-col gap-5 animate-in fade-in duration-200">
          {/* Top Score Banner */}
          <div className="bg-neutral-950 p-5 rounded-2xl border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                Job Match Report
              </span>
              <h3 className="text-lg font-bold text-white tracking-tight mt-0.5">
                {targetRole || "Target Job Position"}{" "}
                {jobCompany && <span className="text-neutral-400 font-normal">at {jobCompany}</span>}
              </h3>
              <p className="text-xs text-neutral-300 mt-1 max-w-xl leading-relaxed">
                {matchResult.scoreExplanation || matchResult.summary}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
              <div className="text-right">
                <span className="text-xs font-bold text-white block">
                  {matchResult.matchScore >= 80
                    ? "Strong Candidate Match"
                    : matchResult.matchScore >= 60
                    ? "Moderate Alignment"
                    : "Low Skill Overlap"}
                </span>
                <span className="text-[10px] text-neutral-500">Estimated Match</span>
              </div>
              <div
                className={`text-2xl font-extrabold font-mono px-4 py-2 rounded-xl border ${getScoreBadgeColor(
                  matchResult.matchScore
                )}`}
              >
                {matchResult.matchScore}%
              </div>
            </div>
          </div>

          {/* AI Match Estimate Disclaimer */}
          <div className="bg-neutral-950/60 px-4 py-2.5 rounded-xl border border-neutral-800/80 text-[11px] text-neutral-400 flex items-center gap-2">
            <span className="text-indigo-400">ℹ</span>
            <span>
              This match score is an algorithmic estimate based on resume alignment with the job description. It is not an employer hiring decision or a guarantee of an interview.
            </span>
          </div>

          {/* Matching vs Missing Skills */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Matching Skills */}
            <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800 flex flex-col gap-2.5">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <span>✓</span>
                  <span>Matching Skills ({matchResult.matchingSkills?.length || 0})</span>
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {matchResult.matchingSkills && matchResult.matchingSkills.length > 0 ? (
                  matchResult.matchingSkills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-950/60 text-emerald-300 border border-emerald-800/80 font-medium"
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-neutral-500 italic">No direct skill overlap identified</span>
                )}
              </div>
            </div>

            {/* Missing Required Skills */}
            <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800 flex flex-col gap-2.5">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                  <span>✕</span>
                  <span>Missing Required Skills ({matchResult.missingRequiredSkills?.length || 0})</span>
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {matchResult.missingRequiredSkills && matchResult.missingRequiredSkills.length > 0 ? (
                  matchResult.missingRequiredSkills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-rose-950/60 text-rose-300 border border-rose-800/80 font-medium"
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-emerald-400 font-medium">All major role requirements addressed!</span>
                )}
              </div>
              <span className="text-[10px] text-neutral-500 italic">
                Only claim these skills if you have verifiable experience with them.
              </span>
            </div>
          </div>

          <LearningPlanSection missingSkills={matchResult.missingRequiredSkills || []} />

          <InterviewPrep
            key={`${completedMatch.resumeId}:${completedMatch.jobDescription}`}
            resumeId={completedMatch.resumeId}
            jobDescription={completedMatch.jobDescription}
          />

          {/* Partially Matching Skills */}
          {matchResult.partiallyMatchingSkills && matchResult.partiallyMatchingSkills.length > 0 && (
            <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800 flex flex-col gap-2.5">
              <span className="text-xs font-bold text-amber-300 border-b border-neutral-800 pb-2 flex items-center gap-1.5">
                <span>≈</span>
                <span>Partially Matching / Adjacent Skills ({matchResult.partiallyMatchingSkills.length})</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {matchResult.partiallyMatchingSkills.map((item, idx) => (
                  <div key={idx} className="bg-neutral-900/60 p-3 rounded-xl border border-neutral-800/80 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-white">{item.skill}</span>
                      <span className="text-neutral-500 font-mono text-[10px]">vs.</span>
                      <span className="text-amber-400 font-mono text-[11px]">{item.candidateHas}</span>
                    </div>
                    {item.explanation && <p className="text-[11px] text-neutral-400">{item.explanation}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Experience Gaps & Education Requirements */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Experience Gaps */}
            <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800 flex flex-col gap-2">
              <span className="text-xs font-bold text-white border-b border-neutral-800 pb-2 flex items-center gap-1.5">
                <span>⏳</span>
                <span>Relevant Experience Gaps</span>
              </span>
              <ul className="flex flex-col gap-2 text-xs text-neutral-300 pt-1">
                {matchResult.experienceGaps && matchResult.experienceGaps.length > 0 ? (
                  matchResult.experienceGaps.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-neutral-500">•</span>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-xs text-emerald-400 italic">No significant seniority or experience gaps identified.</li>
                )}
              </ul>
            </div>

            {/* Education Requirements */}
            <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800 flex flex-col gap-2">
              <span className="text-xs font-bold text-white border-b border-neutral-800 pb-2 flex items-center gap-1.5">
                <span>🎓</span>
                <span>Education & Certification Requirements</span>
              </span>
              <ul className="flex flex-col gap-2 text-xs text-neutral-300 pt-1">
                {matchResult.educationRequirements && matchResult.educationRequirements.length > 0 ? (
                  matchResult.educationRequirements.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-neutral-500">•</span>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-xs text-neutral-400 italic">No specific degree or certification constraints stated.</li>
                )}
              </ul>
            </div>
          </div>

          {/* Truthful Resume Keywords */}
          {matchResult.truthfulKeywords && matchResult.truthfulKeywords.length > 0 && (
            <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800 flex flex-col gap-2.5">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>🔑</span>
                  <span>Job Keywords Worth Incorporating (When Truthful)</span>
                </span>
                <span className="text-[10px] text-neutral-500">Add to project bullet points honestly</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {matchResult.truthfulKeywords.map((kw, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] font-mono px-2.5 py-0.5 rounded-md bg-neutral-900 text-neutral-200 border border-neutral-800"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Specific Suggestions for this Job */}
          {matchResult.tailoredImprovements && matchResult.tailoredImprovements.length > 0 && (
            <div className="bg-neutral-950/70 p-5 rounded-2xl border border-neutral-800 flex flex-col gap-3">
              <span className="text-xs font-bold text-white border-b border-neutral-800 pb-2.5 flex items-center gap-1.5">
                <span>⚡</span>
                <span>Specific Resume Improvements for this Job Opening</span>
              </span>
              <ul className="flex flex-col gap-2.5 text-xs text-neutral-300">
                {matchResult.tailoredImprovements.map((imp, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 bg-neutral-900/60 p-3 rounded-xl border border-neutral-800/80"
                  >
                    <span className="text-emerald-400 font-bold select-none">•</span>
                    <span className="leading-relaxed">{imp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
