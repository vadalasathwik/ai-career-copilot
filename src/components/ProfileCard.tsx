"use client"

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

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  return (
    <div className="bg-white p-6 sm:p-8 rounded-2xl border border-stone-200 flex flex-col gap-6 shadow-sm">
      {/* Account Info Header */}
      <div className="flex items-center gap-4 border-b border-stone-200 pb-6">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt={user.name}
            className="w-16 h-16 rounded-2xl border border-neutral-700 object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-2xl font-bold text-white shadow-sm">
            {initial}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-slate-950 tracking-tight">{user.name}</h2>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-stone-100 text-slate-500 border border-stone-200">
              {user.provider === "google" ? "Google Account" : "Local Account"}
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">{user.email}</p>
        </div>
      </div>

      {/* Current Resume Summary */}
      <div className="flex flex-col gap-3">
        <h3 className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
          Active Resume Summary
        </h3>

        {resumeSummary ? (
          <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-lg shrink-0">
                📄
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-900 truncate max-w-sm">
                  {resumeSummary.fileName}
                </h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
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
                <span className="text-[10px] text-slate-500 block">Latest ATS Score</span>
                <span className="text-base font-bold font-mono text-indigo-700">
                  {resumeSummary.latestAtsScore}%
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 text-xs text-slate-600">
            No active resume uploaded yet. Visit the Workspace to upload your resume.
          </div>
        )}
      </div>

      {/* Account Security Notice */}
      <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-[11px] text-indigo-950 flex items-center gap-2.5">
        <span className="text-indigo-600">🔒</span>
        <span>
          Your resume documents and analysis history are strictly isolated to your authenticated account and are never shared or made public.
        </span>
      </div>

    </div>
  )
}
