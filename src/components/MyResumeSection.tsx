"use client"

import { useState, useEffect, useRef } from "react"
import type { ResumeQualityReport } from "@/backend/services/aiService"

interface ResumeItem {
  id: number
  fileName: string
  fileSize: number
  fileType: string
  skills: string[]
  createdAt: string
  latestAnalysis?: {
    id: number
    atsScore: number
    targetRole: string | null
    rawAnalysis?: string | null
  } | null
}

interface MyResumeSectionProps {
  onActiveResumeChange?: (resume: ResumeItem | null) => void
}

export default function MyResumeSection({ onActiveResumeChange }: MyResumeSectionProps) {
  const [resume, setResume] = useState<ResumeItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [qualityReport, setQualityReport] = useState<ResumeQualityReport | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch the latest user resume on mount
  useEffect(() => {
    let active = true

    async function fetchLatestResume() {
      try {
        setLoading(true)
        const res = await fetch("/api/resumes")
        if (res.ok && active) {
          const data = await res.json()
          if (data.success && Array.isArray(data.resumes) && data.resumes.length > 0) {
            const latest = data.resumes[0] as ResumeItem
            setResume(latest)
            if (onActiveResumeChange) {
              onActiveResumeChange(latest)
            }

            // Check if latest resume has a past quality analysis
            if (latest.latestAnalysis?.rawAnalysis) {
              try {
                const parsed = JSON.parse(latest.latestAnalysis.rawAnalysis)
                if (parsed.grammarSpelling || parsed.formattingReadability) {
                  setQualityReport(parsed)
                }
              } catch {
                // Ignore parsing errors on old formats
              }
            }
          }
        }
      } catch {
        // Quiet fail
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchLatestResume()

    return () => {
      active = false
    }
  }, [onActiveResumeChange])

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  async function handleFileUpload(file: File) {
    setError(null)
    setSuccess(null)

    // File type validation
    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ]
    const validExts = [".pdf", ".docx"]
    const isExtensionValid = validExts.some((ext) => file.name.toLowerCase().endsWith(ext))

    if (!validTypes.includes(file.type) && !isExtensionValid) {
      setError("Only PDF and DOCX documents are accepted.")
      return
    }

    // 5 MB file size limit
    if (file.size > 5 * 1024 * 1024) {
      setError("File size exceeds the 5 MB limit.")
      return
    }

    try {
      setUploading(true)
      const formData = new FormData()
      formData.append("resume", file)

      const res = await fetch("/api/resumes/upload", {
        method: "POST",
        body: formData
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to upload and parse resume.")
      }

      setResume(data.resume)
      setQualityReport(null) // Reset quality report for newly uploaded resume
      setSuccess(`"${file.name}" uploaded successfully. Click "Review Resume" to evaluate quality.`)
      if (onActiveResumeChange) {
        onActiveResumeChange(data.resume)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to upload resume.")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleAnalyzeResume() {
    if (!resume) return
    setError(null)
    setAnalyzing(true)

    try {
      const res = await fetch("/api/ai/quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId: resume.id })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to analyze resume quality.")
      }

      setQualityReport(data.report)
      setResume((prev) =>
        prev
          ? {
              ...prev,
              latestAnalysis: {
                id: data.analysisId,
                atsScore: data.report.atsScore,
                targetRole: "Resume Quality & Grammar Audit"
              }
            }
          : null
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Analysis failed. Please try again.")
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="bg-neutral-900/80 p-6 sm:p-7 rounded-3xl border border-neutral-800 flex flex-col gap-6 shadow-sm">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📄</span>
            <h2 className="text-xl font-bold text-white tracking-tight">Resume Review</h2>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Review your resume for ATS compatibility, grammar, formatting, and structural completeness.
          </p>
        </div>

        {resume && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || analyzing}
            aria-label="Replace current resume file"
            className="text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-3.5 py-2 rounded-xl border border-neutral-700 transition self-start sm:self-auto disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "↻ Replace Resume"}
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFileUpload(e.target.files[0])
          }
        }}
      />

      {/* Notifications */}
      {error && (
        <div className="bg-rose-950/80 border border-rose-800 text-rose-300 text-xs p-3.5 rounded-xl flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button type="button" onClick={() => setError(null)} className="text-rose-400 font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {success && (
        <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs p-3.5 rounded-xl flex items-center justify-between">
          <span>✓ {success}</span>
          <button type="button" onClick={() => setSuccess(null)} className="text-emerald-400 font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Upload State / Current Resume Card */}
      {loading ? (
        <div className="p-8 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading current resume...</span>
        </div>
      ) : !resume ? (
        /* Empty Upload Dropzone */
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleFileUpload(e.dataTransfer.files[0])
            }
          }}
          className="border-2 border-dashed border-neutral-800 hover:border-emerald-600/70 bg-neutral-950/50 hover:bg-neutral-950 rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 group"
        >
          <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-xl text-neutral-400 group-hover:scale-105 group-hover:border-emerald-600 transition">
            📄
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Click to upload or drag & drop your resume</h3>
            <p className="text-xs text-neutral-400 mt-1">Accepts PDF or DOCX format (up to 5 MB)</p>
          </div>
        </div>
      ) : (
        /* Current Resume Summary & Action Strip */
        <div className="bg-neutral-950 p-4 sm:p-5 rounded-2xl border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-xl shrink-0">
              {resume.fileName.toLowerCase().endsWith(".pdf") ? "📕" : "📘"}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white truncate max-w-sm">{resume.fileName}</h3>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-neutral-900 text-neutral-400 border border-neutral-800">
                  {resume.fileName.toLowerCase().endsWith(".pdf") ? "PDF" : "DOCX"}
                </span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    resume.latestAnalysis
                      ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                      : "bg-neutral-900 text-neutral-400 border-neutral-800"
                  }`}
                >
                  {resume.latestAnalysis
                    ? `ATS Compatibility: ~${resume.latestAnalysis.atsScore}%`
                    : "Not yet reviewed"}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                {formatBytes(resume.fileSize)} • Uploaded{" "}
                {new Date(resume.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric"
                })}{" "}
                • {resume.skills?.length || 0} skills detected
              </p>
            </div>
          </div>

          {/* Primary CTA: Review Resume */}
          <button
            type="button"
            onClick={handleAnalyzeResume}
            disabled={analyzing || uploading}
            aria-label={qualityReport ? "Re-review Resume" : "Review Resume"}
            className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl transition flex items-center gap-2 shadow-sm shrink-0 self-start sm:self-auto disabled:opacity-50"
          >
            {analyzing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Reviewing Resume...</span>
              </>
            ) : (
              <>
                <span>✨</span>
                <span>{qualityReport ? "Re-review Resume" : "Review Resume"}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Resume Quality Report */}
      {qualityReport && (
        <div className="border-t border-neutral-800/80 pt-5 flex flex-col gap-5 animate-in fade-in duration-200">
          {/* Header & Score Gauge */}
          <div className="bg-neutral-950 p-5 rounded-2xl border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                Resume Review Report
              </span>
              <h3 className="text-lg font-bold text-white tracking-tight mt-0.5">
                Technical Structure & Readiness Audit
              </h3>
              <p className="text-xs text-neutral-400 mt-1 max-w-xl leading-relaxed">
                {qualityReport.summary}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
              <div className="text-right">
                <span className="text-xs font-bold text-white block">
                  {qualityReport.atsScore >= 80
                    ? "Strong ATS Baseline"
                    : qualityReport.atsScore >= 60
                    ? "Moderate Baseline"
                    : "Needs Polish"}
                </span>
                <span className="text-[10px] text-neutral-500">Compatibility Estimate</span>
              </div>
              <div
                className={`text-2xl font-extrabold font-mono px-3.5 py-1.5 rounded-xl border ${
                  qualityReport.atsScore >= 80
                    ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                    : qualityReport.atsScore >= 60
                    ? "bg-amber-950 text-amber-300 border-amber-800"
                    : "bg-rose-950 text-rose-300 border-rose-800"
                }`}
              >
                {qualityReport.atsScore}%
              </div>
            </div>
          </div>

          {/* AI Estimate Disclaimer */}
          <div className="bg-neutral-950/60 px-4 py-2.5 rounded-xl border border-neutral-800/80 text-[11px] text-neutral-400 flex items-center gap-2">
            <span className="text-indigo-400">ℹ</span>
            <span>
              This ATS score is an estimate based on resume structure, formatting, and completeness. It is not an employer&apos;s actual ATS result.
            </span>
          </div>

          {/* 1. Grammar & Spelling Corrections */}
          <div className="bg-neutral-950/70 p-5 rounded-2xl border border-neutral-800 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>✍️</span>
                <span>Grammar & Spelling Corrections ({qualityReport.grammarSpelling.length})</span>
              </span>
              <span className="text-[11px] text-neutral-500">Grounded strictly in resume text</span>
            </div>

            {qualityReport.grammarSpelling.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {qualityReport.grammarSpelling.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-neutral-900/60 p-3.5 rounded-xl border border-neutral-800/80 flex flex-col gap-1.5 text-xs"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-rose-400 font-semibold shrink-0">Original:</span>
                      <span className="line-through text-neutral-400 font-mono text-[11px]">
                        &quot;{item.originalText}&quot;
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-emerald-400 font-semibold shrink-0">Revision:</span>
                      <span className="text-emerald-200 font-mono text-[11px]">
                        &quot;{item.suggestedRevision}&quot;
                      </span>
                    </div>
                    {item.explanation && (
                      <p className="text-[11px] text-neutral-400 pt-0.5">{item.explanation}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-neutral-400 py-2 flex items-center gap-2 text-emerald-400">
                <span>✓</span>
                <span>No spelling or grammar errors detected in your resume text.</span>
              </div>
            )}
          </div>

          {/* 2. Awkward or Unclear Phrasing */}
          {qualityReport.awkwardPhrasing && qualityReport.awkwardPhrasing.length > 0 && (
            <div className="bg-neutral-950/70 p-5 rounded-2xl border border-neutral-800 flex flex-col gap-3">
              <div className="border-b border-neutral-800 pb-2.5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>💡</span>
                  <span>Awkward or Unclear Sentences ({qualityReport.awkwardPhrasing.length})</span>
                </span>
              </div>
              <div className="flex flex-col gap-2.5">
                {qualityReport.awkwardPhrasing.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-neutral-900/60 p-3.5 rounded-xl border border-neutral-800/80 flex flex-col gap-1.5 text-xs"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-amber-400 font-semibold shrink-0">Current:</span>
                      <span className="text-neutral-400 italic text-[11px]">
                        &quot;{item.originalText}&quot;
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-emerald-400 font-semibold shrink-0">Suggested:</span>
                      <span className="text-emerald-200 font-medium text-[11px]">
                        &quot;{item.suggestedRevision}&quot;
                      </span>
                    </div>
                    {item.explanation && (
                      <p className="text-[11px] text-neutral-400 pt-0.5">{item.explanation}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Formatting & Readability Concerns + Missing Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Formatting Concerns */}
            <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800 flex flex-col gap-2">
              <span className="text-xs font-bold text-white border-b border-neutral-800 pb-2 flex items-center gap-1.5">
                <span>📐</span>
                <span>Formatting & Readability</span>
              </span>
              <ul className="flex flex-col gap-2 text-xs text-neutral-300 pt-1">
                {qualityReport.formattingReadability.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-neutral-500">•</span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Missing Sections */}
            <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800 flex flex-col gap-2">
              <span className="text-xs font-bold text-white border-b border-neutral-800 pb-2 flex items-center gap-1.5">
                <span>⚠️</span>
                <span>Missing Sections or Information</span>
              </span>
              <ul className="flex flex-col gap-2 text-xs text-neutral-300 pt-1">
                {qualityReport.missingSections.length > 0 ? (
                  qualityReport.missingSections.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-amber-400 font-bold">•</span>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-xs text-emerald-400 italic">All essential resume sections are present!</li>
                )}
              </ul>
            </div>
          </div>

          {/* 4. Detected Skills & Keywords */}
          {qualityReport.detectedSkills && qualityReport.detectedSkills.length > 0 && (
            <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800 flex flex-col gap-2.5">
              <span className="text-xs font-bold text-white border-b border-neutral-800 pb-2 flex items-center gap-1.5">
                <span>🔑</span>
                <span>Skills & Keywords Detected on Resume ({qualityReport.detectedSkills.length})</span>
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {qualityReport.detectedSkills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-neutral-900 text-neutral-200 border border-neutral-800 font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 5. General Resume Improvements */}
          {qualityReport.keyImprovements && qualityReport.keyImprovements.length > 0 && (
            <div className="bg-neutral-950/70 p-5 rounded-2xl border border-neutral-800 flex flex-col gap-3">
              <span className="text-xs font-bold text-white border-b border-neutral-800 pb-2.5 flex items-center gap-1.5">
                <span>⚡</span>
                <span>General Resume Improvements to Make</span>
              </span>
              <ul className="flex flex-col gap-2 text-xs text-neutral-300">
                {qualityReport.keyImprovements.map((imp, idx) => (
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
