import { prisma } from "@/backend/db/prisma"

export interface MatchedJobItem {
  id: number
  company: string
  role: string
  location: string | null
  skills: string[]
  matchedSkills: string[]
  missingSkills: string[]
  matchPercentage: number
  isSample: boolean
  source: string
}

export interface DashboardData {
  atsScoreValue: string
  atsScoreSubtitle: string
  matchedJobsCount: number
  applicationsCount: number
  savedJobsCount: number
  applicationsSubtitle: string
  suggestions: string[]
  targetRole: string | null
  matchedJobs: MatchedJobItem[]
  recentAnalysis?: {
    id: number
    atsScore: number
    targetRole: string | null
    skillsFound: string[]
    skillsMissing: string[]
    improvements: string[]
    strengths: string[]
    createdAt: Date
    resumeFileName?: string
  } | null
  recentApplications?: Array<{
    id: number
    company: string
    role: string
    status: string
    appliedDate: Date
  }>
  applicationStats?: {
    applied: number
    interview: number
    offer: number
    saved: number
    total: number
  }
}

/**
 * Retrieves real dashboard data strictly scoped to the authenticated user.
 * Calculates real ATS scores, application counts, personalized suggestions,
 * and skill-matched jobs from PostgreSQL without fabricated metrics.
 */
export async function getDashboardData(userId: number): Promise<DashboardData> {
  if (!userId || typeof userId !== "number" || userId <= 0) {
    throw new Error("A valid numeric user ID is required to fetch dashboard data")
  }

  // 1. Fetch user records in parallel with strict user isolation
  const [
    latestAnalysis,
    appliedCount,
    savedCount,
    interviewCount,
    offerCount,
    recentApplications,
    resumes
  ] = await Promise.all([
    prisma.resumeAnalysis.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        resume: {
          select: { fileName: true }
        }
      }
    }),
    prisma.jobApplication.count({
      where: {
        userId,
        status: { in: ["APPLIED", "INTERVIEW", "OFFER", "REJECTED"] }
      }
    }),
    prisma.jobApplication.count({
      where: {
        userId,
        status: { in: ["INTERESTED", "SAVED"] }
      }
    }),
    prisma.jobApplication.count({
      where: {
        userId,
        status: "INTERVIEW"
      }
    }),
    prisma.jobApplication.count({
      where: {
        userId,
        status: "OFFER"
      }
    }),
    prisma.jobApplication.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 4,
      select: {
        id: true,
        company: true,
        role: true,
        status: true,
        appliedDate: true
      }
    }),
    prisma.resume.findMany({
      where: { userId },
      select: { skills: true }
    })
  ])

  const availableJobs = await prisma.job.findMany({
    where: { isActive: true },
    take: 100,
    orderBy: { createdAt: "desc" }
  })

  // 2. ATS Score Calculation
  const atsScoreValue = latestAnalysis
    ? `${latestAnalysis.atsScore}%`
    : "No analysis yet"

  const atsScoreSubtitle = latestAnalysis
    ? latestAnalysis.targetRole
      ? `Target: ${latestAnalysis.targetRole}`
      : "From recent analysis"
    : "Upload & analyze a resume"

  // Applications subtitle calculation
  let applicationsSubtitle = "No applications submitted yet"
  if (appliedCount > 0 && savedCount > 0) {
    applicationsSubtitle = `${appliedCount} submitted • ${savedCount} saved`
  } else if (appliedCount > 0) {
    applicationsSubtitle = `${appliedCount} submitted application${appliedCount > 1 ? "s" : ""}`
  } else if (savedCount > 0) {
    applicationsSubtitle = `0 submitted (${savedCount} saved for later)`
  }

  // 3. Personalized Suggestions Generation
  let suggestions: string[] = []
  if (latestAnalysis) {
    if (latestAnalysis.improvements && latestAnalysis.improvements.length > 0) {
      suggestions = latestAnalysis.improvements.slice(0, 5)
    } else if (latestAnalysis.skillsMissing && latestAnalysis.skillsMissing.length > 0) {
      suggestions = latestAnalysis.skillsMissing.slice(0, 5).map(
        (skill) => `Develop proficiency in ${skill} to strengthen role alignment`
      )
    } else if (latestAnalysis.keywords && latestAnalysis.keywords.length > 0) {
      suggestions = latestAnalysis.keywords.slice(0, 5).map(
        (kw) => `Incorporate keyword "${kw}" into your project summaries`
      )
    }
  }

  // 4. Job Matching Calculation based on real extracted skills
  const userSkillSet = new Set<string>()

  // Accumulate skills from user's saved resumes
  resumes.forEach((resume) => {
    resume.skills.forEach((skill) => {
      const clean = skill.trim().toLowerCase()
      if (clean) userSkillSet.add(clean)
    })
  })

  // Accumulate skills from user's latest analysis
  if (latestAnalysis?.skillsFound) {
    latestAnalysis.skillsFound.forEach((skill) => {
      const clean = skill.trim().toLowerCase()
      if (clean) userSkillSet.add(clean)
    })
  }

  const matchedJobs: MatchedJobItem[] = []

  if (userSkillSet.size > 0 && availableJobs.length > 0) {
    for (const job of availableJobs) {
      if (!Array.isArray(job.skills) || job.skills.length === 0) continue

      // Deduplicate job skills case-insensitively while preserving original casing
      const skillMap = new Map<string, string>()
      job.skills.forEach((s) => {
        const trimmed = s.trim()
        if (trimmed && !skillMap.has(trimmed.toLowerCase())) {
          skillMap.set(trimmed.toLowerCase(), trimmed)
        }
      })

      const uniqueJobSkills = Array.from(skillMap.values())
      if (uniqueJobSkills.length === 0) continue

      const matched: string[] = []
      const missing: string[] = []

      uniqueJobSkills.forEach((originalSkill) => {
        const normalized = originalSkill.toLowerCase()
        if (userSkillSet.has(normalized)) {
          matched.push(originalSkill)
        } else {
          missing.push(originalSkill)
        }
      })

      // Must have at least 1 overlapping skill to qualify as a matched job
      if (matched.length > 0) {
        const matchPercentage = Math.round((matched.length / uniqueJobSkills.length) * 100)
        matchedJobs.push({
          id: job.id,
          company: job.company,
          role: job.title,
          location: job.location,
          skills: uniqueJobSkills,
          matchedSkills: matched,
          missingSkills: missing,
          matchPercentage,
          isSample: job.isSample,
          source: job.source
        })
      }
    }

    // Sort by highest match percentage first
    matchedJobs.sort((a, b) => b.matchPercentage - a.matchPercentage)
  }

  const matchedJobsCount = matchedJobs.length

  return {
    atsScoreValue,
    atsScoreSubtitle,
    matchedJobsCount,
    applicationsCount: appliedCount,
    savedJobsCount: savedCount,
    applicationsSubtitle,
    suggestions,
    targetRole: latestAnalysis?.targetRole ?? null,
    matchedJobs: matchedJobs.slice(0, 4),
    recentAnalysis: latestAnalysis
      ? {
          id: latestAnalysis.id,
          atsScore: latestAnalysis.atsScore,
          targetRole: latestAnalysis.targetRole,
          skillsFound: latestAnalysis.skillsFound,
          skillsMissing: latestAnalysis.skillsMissing,
          improvements: latestAnalysis.improvements,
          strengths: latestAnalysis.strengths,
          createdAt: latestAnalysis.createdAt,
          resumeFileName: latestAnalysis.resume?.fileName
        }
      : null,
    recentApplications: recentApplications.map((app) => ({
      id: app.id,
      company: app.company,
      role: app.role,
      status: app.status,
      appliedDate: app.appliedDate
    })),
    applicationStats: {
      applied: appliedCount,
      interview: interviewCount,
      offer: offerCount,
      saved: savedCount,
      total: appliedCount + savedCount
    }
  }
}
