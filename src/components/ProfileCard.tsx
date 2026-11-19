"use client"

import { signOut } from "next-auth/react"

interface ProfileCardProps {
  user: {
    id: number
    name: string
    email: string
    image: string | null
    provider: string
  }
  resumeSummary: {
    fileName: string
    fileSize: number
    fileType: string
    uploadedAt: string
    skillsCount: number
    latestAtsScore: number | null
  } | null
}

export default function ProfileCard({ user, resumeSummary }: ProfileCardProps) {
  const initial = user.name ? user.name.charAt(0).toUpperCase() : "U"

  async function handleSignOut() {
    try {
      await fetch("/api/logout", { method: "POST" })
    } catch {
      // Continue
    }

    try {
      await signOut({ redirect: false })
    } catch {
      // Continue
    }

    window.location.href = "/auth"
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  return (
    <div className="bg-neutral-900/80 p-6 sm:p-8 rounded-3xl border border-neutral-800 flex flex-col gap-6 shadow-sm">
      {/* Account Info Header */}
      <div className="flex items-center gap-4 border-b border-neutral-800/80 pb-6">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt={user.name}
            className="w-16 h-16 rounded-2xl border border-neutral-700 object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-cyan-500 border border-neutral-700 flex items-center justify-center text-2xl font-bold text-white shadow-sm">
            {initial}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-white tracking-tight">{user.name}</h2>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-neutral-950 text-neutral-400 border border-neutral-800">
              {user.provider === "google" ? "Google Account" : "Local Account"}
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">{user.email}</p>
        </div>
      </div>

      {/* Current Resume Summary */}
      <div className="flex flex-col gap-3">
        <h3 className="text-xs uppercase tracking-wider text-neutral-400 font-semibold">
          Active Resume Summary
        </h3>

        {resumeSummary ? (
          <div className="bg-neutral-950 p-4 rounded-2xl border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-lg shrink-0">
                📄
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-white truncate max-w-sm">
                  {resumeSummary.fileName}
                </h4>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  {formatBytes(resumeSummary.fileSize)} • Uploaded{" "}
                  {new Date(resumeSummary.uploadedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  })}{" "}
                  • {resumeSummary.skillsCount} skills detected
                </p>
              </div>
            </div>

            {resumeSummary.latestAtsScore !== null && (
              <div className="text-right shrink-0">
                <span className="text-[10px] text-neutral-500 block">Latest ATS Score</span>
                <span className="text-base font-bold font-mono text-emerald-400">
                  {resumeSummary.latestAtsScore}%
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-neutral-950 p-4 rounded-2xl border border-neutral-800 text-xs text-neutral-400">
            No active resume uploaded yet. Visit the Workspace to upload your resume.
          </div>
        )}
      </div>

      {/* Account Security Notice */}
      <div className="bg-neutral-950/60 p-4 rounded-2xl border border-neutral-800/80 text-[11px] text-neutral-400 flex items-center gap-2.5">
        <span className="text-neutral-500">🔒</span>
        <span>
          Your resume documents and analysis history are strictly isolated to your authenticated account and are never shared or made public.
        </span>
      </div>

      {/* Sign Out Button */}
      <div className="pt-2 border-t border-neutral-800/80 flex justify-end">
        <button
          type="button"
          onClick={handleSignOut}
          className="text-xs font-semibold bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 px-4 py-2.5 rounded-xl transition flex items-center gap-2"
        >
          <span>🚪</span>
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  )
}
