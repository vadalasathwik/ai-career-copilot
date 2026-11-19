import { redirect } from "next/navigation"
import { getCurrentUser } from "@/backend/auth/session"
import { prisma } from "@/backend/db/prisma"
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
    <div className="min-h-screen bg-black text-white flex flex-col font-sans">
      <Navbar user={user} />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto w-full flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">User Profile</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Account identity, authentication provider, and active resume overview.
          </p>
        </div>

        <ProfileCard user={user} resumeSummary={resumeSummary} />
      </main>

      <footer className="border-t border-neutral-800/80 bg-neutral-950 py-6 text-center text-xs text-neutral-500">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-between">
          <span className="font-semibold text-neutral-400">AI Career Copilot</span>
          <span className="text-[11px] text-neutral-500">Private Account Data</span>
        </div>
      </footer>
    </div>
  )
}
