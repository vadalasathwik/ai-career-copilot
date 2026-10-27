"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

interface ResumeItem {
  id: number
  fileName: string
  fileSize: number
  fileType: string
  skills: string[]
  createdAt: string
}

interface ResumeUploadProps {
  onSelectForAnalysis?: (resumeId: number) => void
}

export default function ResumeUpload({ onSelectForAnalysis }: ResumeUploadProps) {
  const router = useRouter()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [loadingResumes, setLoadingResumes] = useState(true)
  const [resumes, setResumes] = useState<ResumeItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchResumes()
  }, [])

  async function fetchResumes() {
    try {
      setLoadingResumes(true)
      const res = await fetch("/api/resumes")
      const data = await res.json()
      if (res.ok && data.success) {
        setResumes(data.resumes || [])
      }
    } catch {
      // Quiet fail
    } finally {
      setLoadingResumes(false)
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null)
    setSuccess(null)
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setError("File exceeds maximum allowed size of 5 MB.")
      setSelectedFile(null)
      return
    }

    const ext = file.name.split(".").pop()?.toLowerCase()
    if (ext !== "pdf" && ext !== "docx") {
      setError("Only PDF and DOCX files are supported.")
      setSelectedFile(null)
      return
    }

    setSelectedFile(file)
  }

  async function handleUpload() {
    if (!selectedFile) return

    setUploading(true)
    setError(null)
    setSuccess(null)

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)

      const res = await fetch("/api/resumes/upload", {
        method: "POST",
        body: formData
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Upload failed")
      }

      setSuccess(`"${selectedFile.name}" uploaded and parsed successfully!`)
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }

      if (data.resume) {
        setResumes((prev) => [data.resume, ...prev])
      } else {
        await fetchResumes()
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload resume.")
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id)
    setError(null)

    try {
      const res = await fetch(`/api/resumes/${id}`, {
        method: "DELETE"
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to delete resume.")
      }

      setResumes((prev) => prev.filter((r) => r.id !== id))
      setConfirmDeleteId(null)
      setSuccess("Resume deleted successfully.")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete resume.")
    } finally {
      setDeletingId(null)
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  return (
    <div className="bg-neutral-900/80 p-6 rounded-2xl border border-neutral-800 flex flex-col gap-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">My Resumes</h2>
            <span className="text-xs font-mono bg-neutral-800 text-neutral-300 border border-neutral-700 px-2.5 py-0.5 rounded-full">
              {resumes.length} {resumes.length === 1 ? "File" : "Files"}
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Upload PDF or DOCX resumes (up to 5 MB) for automated skill extraction, deterministic matching, and Gemini ATS scans.
          </p>
        </div>

        <div className="text-[11px] text-neutral-400 bg-neutral-950 px-3 py-1.5 rounded-xl border border-neutral-800 flex items-center gap-1.5 self-start sm:self-auto">
          <span>🔒</span>
          <span>Private Local Storage</span>
        </div>
      </div>

      {/* Notifications */}
      {error && (
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

      {success && (
        <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs p-3.5 rounded-xl flex items-center justify-between">
          <span className="font-medium">✓ {success}</span>
          <button
            onClick={() => setSuccess(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Upload Dropzone */}
      <div className="flex flex-col gap-3">
        <label
          className={`border-2 border-dashed p-8 rounded-2xl text-center block cursor-pointer transition ${
            selectedFile
              ? "border-emerald-600 bg-emerald-950/10"
              : "border-neutral-700/80 hover:border-neutral-500 bg-neutral-950/40"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={handleFileSelect}
            disabled={uploading}
          />

          {selectedFile ? (
            <div className="flex flex-col items-center gap-2">
              <span className="text-3xl">📄</span>
              <p className="text-white font-semibold text-sm">{selectedFile.name}</p>
              <p className="text-xs text-neutral-400">
                {formatBytes(selectedFile.size)} • Click to choose a different file
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center text-xl text-neutral-300 mb-1">
                📤
              </div>
              <p className="text-neutral-200 font-semibold text-sm">
                Click or drag & drop your resume file here
              </p>
              <p className="text-xs text-neutral-500">
                Supported formats: PDF, DOCX • File size limit: 5 MB
              </p>
            </div>
          )}
        </label>

        {selectedFile && (
          <div className="flex justify-end gap-2.5">
            <button
              onClick={() => {
                setSelectedFile(null)
                if (fileInputRef.current) fileInputRef.current.value = ""
              }}
              disabled={uploading}
              className="px-4 py-2 rounded-xl text-xs text-neutral-400 hover:text-white bg-neutral-800 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              onClick={handleUpload}
              disabled={uploading}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 flex items-center gap-2 shadow-sm transition"
            >
              {uploading ? (
                <>
                  <span className="inline-block animate-spin">⏳</span>
                  <span>Extracting Skills & Text...</span>
                </>
              ) : (
                "Upload & Extract Skills"
              )}
            </button>
          </div>
        )}
      </div>

      {/* Saved Resumes List */}
      <div className="flex flex-col gap-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white tracking-tight uppercase tracking-wider text-neutral-400">
            Uploaded Documents
          </h3>
          <span className="text-xs text-neutral-500">
            {resumes.length} {resumes.length === 1 ? "document stored" : "documents stored"}
          </span>
        </div>

        {loadingResumes ? (
          <div className="p-8 text-center text-xs text-neutral-500">
            Loading stored resumes...
          </div>
        ) : resumes.length === 0 ? (
          <div className="bg-neutral-950/40 p-8 rounded-2xl border border-neutral-800 text-center flex flex-col items-center justify-center gap-2">
            <p className="text-sm font-medium text-neutral-300">No resumes uploaded yet</p>
            <p className="text-xs text-neutral-500 max-w-sm">
              Upload your first PDF or DOCX resume above to unlock skill matching and genuine ATS analysis.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {resumes.map((resume) => {
              const isPdf =
                resume.fileType === "application/pdf" ||
                resume.fileName.toLowerCase().endsWith(".pdf")
              const isConfirming = confirmDeleteId === resume.id

              return (
                <div
                  key={resume.id}
                  className="bg-neutral-950/60 p-4 rounded-xl border border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-neutral-700"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="text-2xl select-none mt-0.5">
                      {isPdf ? "📕" : "📘"}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white text-sm font-bold truncate">
                          {resume.fileName}
                        </p>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-900 text-neutral-400 border border-neutral-800">
                          {resume.skills.length} skills detected
                        </span>
                      </div>

                      <p className="text-xs text-neutral-500 mt-1">
                        {formatBytes(resume.fileSize)} • Uploaded{" "}
                        {new Date(resume.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        })}
                      </p>

                      {resume.skills && resume.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2.5">
                          {resume.skills.slice(0, 6).map((skill, sIdx) => (
                            <span
                              key={sIdx}
                              className="text-[11px] bg-neutral-900 text-neutral-300 px-2 py-0.5 rounded-md border border-neutral-800"
                            >
                              {skill}
                            </span>
                          ))}
                          {resume.skills.length > 6 && (
                            <span className="text-[10px] text-neutral-500 self-center">
                              +{resume.skills.length - 6} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 self-end md:self-center shrink-0">
                    {onSelectForAnalysis && (
                      <button
                        type="button"
                        onClick={() => onSelectForAnalysis(resume.id)}
                        className="px-3 py-1.5 text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-emerald-400 border border-neutral-700 rounded-xl transition flex items-center gap-1"
                      >
                        <span>✨</span> Scan ATS
                      </button>
                    )}

                    {isConfirming ? (
                      <div className="flex items-center gap-2 bg-neutral-900 p-1.5 rounded-xl border border-red-800">
                        <span className="text-xs text-red-400 pl-1">Delete?</span>
                        <button
                          onClick={() => handleDelete(resume.id)}
                          disabled={deletingId === resume.id}
                          className="px-2.5 py-1 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg disabled:opacity-50"
                        >
                          {deletingId === resume.id ? "..." : "Yes, Delete"}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          disabled={deletingId === resume.id}
                          className="px-2.5 py-1 text-xs text-neutral-400 hover:text-white bg-neutral-800 rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(resume.id)}
                        className="px-3 py-1.5 text-xs text-neutral-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-xl transition"
                        title="Delete resume"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
