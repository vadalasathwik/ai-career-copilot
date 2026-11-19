import { redirect } from "next/navigation"
import { getCurrentUser } from "@/backend/auth/session"
import { prisma } from "@/backend/db/prisma"
import Link from "next/link"
import Navbar from "@/components/Navbar"
import ProfileCard from "@/components/ProfileCard"

export default async function ProfilePage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth")
  }

  // Fetch current resume summary for this user
  const latestResume = await prisma.resume.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      analyses: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  })

  const resumeSummary = latestResume
    ? {
        fileName: latestResume.fileName,
        fileSize: latestResume.fileSize,
        fileType: latestResume.fileType,
        uploadedAt: latestResume.createdAt.toISOString(),
        skillsCount: latestResume.skills.length,
        latestAtsScore: latestResume.analyses[0]?.atsScore ?? null
      }
    : null

  return (
    <div className="min-h-screen bg-stone-50 text-slate-900 flex flex-col font-sans">
      <Navbar user={user} />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto w-full flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Account</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Profile</h1><p className="mt-1 text-sm text-slate-600">Your account details and active resume overview.</p></div><Link href="/" className="shrink-0 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">Back to workspace</Link></div>

        <ProfileCard user={user} resumeSummary={resumeSummary} />
      </main>

      <footer className="border-t border-stone-200 bg-white py-6 text-center text-xs text-slate-500">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-between">
          <span className="font-semibold text-slate-600">AI Career Copilot</span>
          <span className="text-[11px] text-slate-500">Private account data</span>
        </div>
      </footer>
    </div>
  )
}
