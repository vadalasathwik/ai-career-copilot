"use client"

import { useState, useEffect, useMemo } from "react"

export type ApplicationStatusType =
  | "INTERESTED"
  | "SAVED"
  | "APPLIED"
  | "INTERVIEW"
  | "OFFER"
  | "REJECTED"

export interface ApplicationRecord {
  id: number
  userId: number
  jobId: number | null
  company: string
  role: string
  applicationUrl: string | null
  appliedDate: string
  status: ApplicationStatusType
  notes: string | null
  createdAt: string
  updatedAt: string
  job?: {
    id: number
    title: string
    company: string
    location: string | null
    source: string
    url: string | null
    salary: string | null
    isSample: boolean
  } | null
}

const STATUS_CONFIG: Record<
  ApplicationStatusType,
  { label: string; badge: string; border: string; bg: string }
> = {
  INTERESTED: {
    label: "Interested",
    badge: "text-purple-300 bg-purple-950/80 border-purple-800",
    border: "border-purple-800/40",
    bg: "bg-purple-950/10"
  },
  SAVED: {
    label: "Saved",
    badge: "text-amber-300 bg-amber-950/80 border-amber-800",
    border: "border-amber-800/40",
    bg: "bg-amber-950/10"
  },
  APPLIED: {
    label: "Applied",
    badge: "text-blue-300 bg-blue-950/80 border-blue-800",
    border: "border-blue-800/40",
    bg: "bg-blue-950/10"
  },
  INTERVIEW: {
    label: "Interview",
    badge: "text-cyan-300 bg-cyan-950/80 border-cyan-800",
    border: "border-cyan-800/40",
    bg: "bg-cyan-950/10"
  },
  OFFER: {
    label: "Offer Received",
    badge: "text-emerald-300 bg-emerald-950/80 border-emerald-800 font-semibold",
    border: "border-emerald-800/50",
    bg: "bg-emerald-950/20"
  },
  REJECTED: {
    label: "Archived / Rejected",
    badge: "text-neutral-400 bg-neutral-900 border-neutral-700",
    border: "border-neutral-800",
    bg: "bg-neutral-950"
  }
}

interface ApplicationsTrackerProps {
  onNavigateToJobs?: () => void
  searchQuery?: string
}

export default function ApplicationsTracker({
  onNavigateToJobs,
  searchQuery = ""
}: ApplicationsTrackerProps) {
  const [applications, setApplications] = useState<ApplicationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<"ALL" | "PIPELINE" | "SAVED" | "OFFER" | "REJECTED">("ALL")
  const [editingNotesId, setEditingNotesId] = useState<number | null>(null)
  const [notesInput, setNotesInput] = useState("")
  const [savingNotes, setSavingNotes] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const res = await fetch("/api/applications")
        if (res.ok && active) {
          const data = await res.json()
          if (data.success && Array.isArray(data.applications)) {
            setApplications(data.applications)
          }
        }
      } catch {
        // Quiet fail on network
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      active = false
    }
  }, [])

  async function handleStatusChange(id: number, jobId: number | null, newStatus: ApplicationStatusType) {
    try {
      setUpdatingStatusId(id)
      const targetApp = applications.find((a) => a.id === id)
      if (!targetApp) return

      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: jobId || undefined,
          company: targetApp.company,
          role: targetApp.role,
          status: newStatus,
          notes: targetApp.notes || undefined
        })
      })

      if (res.ok) {
        setApplications((prev) =>
          prev.map((app) => (app.id === id ? { ...app, status: newStatus } : app))
        )
      }
    } catch {
      // Ignore transient errors
    } finally {
      setUpdatingStatusId(null)
    }
  }

  async function handleSaveNotes(id: number) {
    try {
      setSavingNotes(true)
      const targetApp = applications.find((a) => a.id === id)
      if (!targetApp) return

      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: targetApp.jobId || undefined,
          company: targetApp.company,
          role: targetApp.role,
          status: targetApp.status,
          notes: notesInput
        })
      })

      if (res.ok) {
        setApplications((prev) =>
          prev.map((app) => (app.id === id ? { ...app, notes: notesInput } : app))
        )
        setEditingNotesId(null)
      }
    } catch {
      // Ignore
    } finally {
      setSavingNotes(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Remove this application from your tracking board?")) return

    try {
      setDeletingId(id)
      const res = await fetch(`/api/applications/${id}`, {
        method: "DELETE"
      })
      if (res.ok) {
        setApplications((prev) => prev.filter((a) => a.id !== id))
      }
    } catch {
      // Ignore
    } finally {
      setDeletingId(null)
    }
  }

  // Segment metrics
  const stats = useMemo(() => {
    let submitted = 0
    let saved = 0
    let interview = 0
    let offers = 0

    for (const app of applications) {
      if (app.status === "APPLIED" || app.status === "INTERVIEW" || app.status === "OFFER" || app.status === "REJECTED") {
        submitted++
      }
      if (app.status === "SAVED" || app.status === "INTERESTED") {
        saved++
      }
      if (app.status === "INTERVIEW") {
        interview++
      }
      if (app.status === "OFFER") {
        offers++
      }
    }

    return { submitted, saved, interview, offers, total: applications.length }
  }, [applications])

  // Filter list
  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const matchesQuery =
          app.company.toLowerCase().includes(query) ||
          app.role.toLowerCase().includes(query) ||
          (app.notes && app.notes.toLowerCase().includes(query))
        if (!matchesQuery) return false
      }

      // Tab filter
      if (activeFilter === "PIPELINE") {
        return app.status === "APPLIED" || app.status === "INTERVIEW" || app.status === "OFFER"
      }
      if (activeFilter === "SAVED") {
        return app.status === "SAVED" || app.status === "INTERESTED"
      }
      if (activeFilter === "OFFER") {
        return app.status === "OFFER" || app.status === "INTERVIEW"
      }
      if (activeFilter === "REJECTED") {
        return app.status === "REJECTED"
      }
      return true
    })
  }, [applications, activeFilter, searchQuery])

  return (
    <div className="flex flex-col gap-6">
      {/* Header and KPI strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">Application Pipeline</h2>
            <span className="text-xs font-mono bg-neutral-900 text-neutral-300 border border-neutral-800 px-2.5 py-0.5 rounded-full">
              {stats.total} Tracked
            </span>
          </div>
          <p className="text-neutral-400 text-xs mt-1">
            Track and manage your submitted applications, interview stages, and saved opportunities.
          </p>
        </div>

        {onNavigateToJobs && (
          <button
            type="button"
            onClick={onNavigateToJobs}
            className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl transition flex items-center gap-2 self-start sm:self-auto shadow-sm"
          >
            <span>+</span> Find More Jobs
          </button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-neutral-900/80 p-4 rounded-xl border border-neutral-800 flex flex-col justify-between">
          <span className="text-xs text-neutral-400 font-medium">Submitted Applications</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{stats.submitted}</span>
            <span className="text-[11px] text-neutral-500">active lifecycle</span>
          </div>
        </div>

        <div className="bg-neutral-900/80 p-4 rounded-xl border border-neutral-800 flex flex-col justify-between">
          <span className="text-xs text-neutral-400 font-medium">Interviewing</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-cyan-400">{stats.interview}</span>
            <span className="text-[11px] text-neutral-500">in conversation</span>
          </div>
        </div>

        <div className="bg-neutral-900/80 p-4 rounded-xl border border-neutral-800 flex flex-col justify-between">
          <span className="text-xs text-neutral-400 font-medium">Offers Received</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400">{stats.offers}</span>
            <span className="text-[11px] text-neutral-500">successful</span>
          </div>
        </div>

        <div className="bg-neutral-900/80 p-4 rounded-xl border border-neutral-800 flex flex-col justify-between">
          <span className="text-xs text-neutral-400 font-medium">Saved / Interested</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-400">{stats.saved}</span>
            <span className="text-[11px] text-neutral-500">to apply</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-800/80 pb-3 flex-wrap">
        {[
          { key: "ALL" as const, label: `All (${applications.length})` },
          { key: "PIPELINE" as const, label: `Active Pipeline (${stats.submitted})` },
          { key: "OFFER" as const, label: `Interviews & Offers (${stats.interview + stats.offers})` },
          { key: "SAVED" as const, label: `Saved (${stats.saved})` },
          { key: "REJECTED" as const, label: "Archived" }
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveFilter(tab.key)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
              activeFilter === tab.key
                ? "bg-neutral-800 text-white border border-neutral-700"
                : "text-neutral-400 hover:text-white hover:bg-neutral-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Applications List */}
      {loading ? (
        <div className="bg-neutral-900/50 p-12 rounded-2xl border border-neutral-800 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-neutral-400 text-xs">Loading application records...</p>
        </div>
      ) : filteredApplications.length === 0 ? (
        <div className="bg-neutral-900/40 p-12 rounded-2xl border border-neutral-800/80 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center text-xl text-neutral-400">
            📋
          </div>
          <h3 className="text-base font-semibold text-white">No applications in this view</h3>
          <p className="text-neutral-400 text-xs max-w-sm">
            {searchQuery
              ? `No tracked applications match "${searchQuery}".`
              : "When you mark opportunities as Saved, Applied, or Interviewing, they will appear here."}
          </p>
          {onNavigateToJobs && (
            <button
              type="button"
              onClick={onNavigateToJobs}
              className="mt-2 text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded-xl transition border border-neutral-700"
            >
              Browse Matched Opportunities
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredApplications.map((app) => {
            const config = STATUS_CONFIG[app.status] || STATUS_CONFIG.SAVED
            const isEditingNotes = editingNotesId === app.id
            const isSampleJob = app.job?.isSample

            return (
              <div
                key={app.id}
                className={`bg-neutral-900/70 p-5 rounded-2xl border ${config.border} flex flex-col gap-3.5 transition hover:border-neutral-700`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-base font-bold text-white tracking-tight">{app.role}</h4>
                      {isSampleJob && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-400 border border-neutral-700">
                          Sample Vacancy
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-neutral-400 mt-1 flex-wrap">
                      <span className="text-neutral-200 font-medium">{app.company}</span>
                      {app.job?.location && <span>• {app.job.location}</span>}
                      {app.job?.salary && <span>• {app.job.salary}</span>}
                      <span>
                        • Tracked {new Date(app.appliedDate || app.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Status Dropdown Controller */}
                  <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                    <select
                      value={app.status}
                      disabled={updatingStatusId === app.id}
                      onChange={(e) =>
                        handleStatusChange(app.id, app.jobId, e.target.value as ApplicationStatusType)
                      }
                      className={`text-xs px-3 py-1.5 rounded-lg border font-medium focus:outline-none transition cursor-pointer ${config.badge}`}
                    >
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

                    <button
                      type="button"
                      onClick={() => handleDelete(app.id)}
                      disabled={deletingId === app.id}
                      className="text-xs text-neutral-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-neutral-800 transition"
                      title="Delete application record"
                    >
                      🗑
                    </button>
                  </div>
                </div>

                {/* Notes & Actions Bar */}
                <div className="pt-2 border-t border-neutral-800/70 flex flex-col gap-2">
                  {isEditingNotes ? (
                    <div className="flex flex-col gap-2 bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                      <label className="text-[11px] font-medium text-neutral-400">
                        Application & Interview Notes:
                      </label>
                      <textarea
                        value={notesInput}
                        onChange={(e) => setNotesInput(e.target.value)}
                        placeholder="Add notes (e.g. recruiter contact, interview questions, follow-up date)..."
                        rows={3}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setEditingNotesId(null)}
                          className="text-xs text-neutral-400 hover:text-white px-3 py-1 rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={savingNotes}
                          onClick={() => handleSaveNotes(app.id)}
                          className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3.5 py-1 rounded-lg transition"
                        >
                          {savingNotes ? "Saving..." : "Save Notes"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                      <div className="flex items-center gap-2 text-neutral-400 flex-1 min-w-0">
                        <span className="text-neutral-500">📝</span>
                        {app.notes ? (
                          <span className="truncate text-neutral-300">{app.notes}</span>
                        ) : (
                          <span className="italic text-neutral-500 text-[11px]">No notes added yet</span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNotesId(app.id)
                            setNotesInput(app.notes || "")
                          }}
                          className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium ml-1"
                        >
                          {app.notes ? "Edit" : "+ Add Note"}
                        </button>
                      </div>

                      {app.applicationUrl && (
                        <a
                          href={app.applicationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 transition"
                        >
                          Job Link ↗
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
