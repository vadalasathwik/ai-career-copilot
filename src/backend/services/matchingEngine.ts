import { prisma } from "@/backend/db/prisma"
import type { RemoteWorkMode } from "./jobProviders/types"
import {
  calculateDeterministicMatchScore,
  computeMatchInputHash,
  estimateCandidateYearsOfExperience,
  evaluateJobMatchLocally,
  parseSeniorityTier,
  type MatchScoreBreakdown
} from "./scoringEngine"

export * from "./scoringEngine"

export interface IntelligentJobMatchResult {
  jobId: number
  jobTitle: string
  company: string
  location: string | null
  remoteStatus: RemoteWorkMode | null
  source: string
  sourceJobId: string | null
  url: string | null
  salary: string | null
  isSample: boolean
  isActive: boolean
  lastVerifiedAt: string
  matchScore: number
  scoreBreakdown: MatchScoreBreakdown
  requiredSkillsMatched: string[]
  requiredSkillsMissing: string[]
  preferredSkillsMatched: string[]
  preferredSkillsMissing: string[]
  unassessedSkills: string[]
  experienceLevelAlignment: string
  seniorityAlignment: string
  reasonsForMatch: string[]
  actionableRecommendations: string[]
  summary: string
  isCached: boolean
}

/**
 * Evaluates an authenticated user's resume against a specific job listing,
 * utilizing the database cache when inputs have not changed.
 * Operates 100% locally with ₹0 budget using deterministic TypeScript matching.
 */
export async function matchResumeToJob({
  userId,
  resumeId,
  jobId,
  bypassCache
}: {
  userId: number
  resumeId: number
  jobId: number
  bypassCache?: boolean
}): Promise<IntelligentJobMatchResult> {
  // 1. Fetch Resume and Job with ownership check
  const [resume, job] = await Promise.all([
    prisma.resume.findUnique({
      where: { id: resumeId }
    }),
    prisma.job.findUnique({
      where: { id: jobId }
    })
  ])

  if (!resume || resume.userId !== userId) {
    throw new Error("Resume not found or unauthorized.")
  }

  if (!job) {
    throw new Error("Target job listing not found.")
  }

  const candidateSkills = resume.skills || []
  const jobSkills = job.skills || []
  const inputHash = computeMatchInputHash(
    resume.extractedText,
    candidateSkills,
    job.description,
    jobSkills
  )

  // 2. Cache Inspection: Avoid repeated calculation when inputs haven't changed
  if (!bypassCache) {
    const cached = await prisma.jobMatch.findUnique({
      where: {
        userId_resumeId_jobId: {
          userId,
          resumeId,
          jobId
        }
      }
    })

    if (cached && cached.inputHash === inputHash) {
      const breakdown = calculateDeterministicMatchScore({
        requiredTotal: cached.requiredSkillsMatched.length + cached.requiredSkillsMissing.length,
        requiredMatched: cached.requiredSkillsMatched.length,
        preferredTotal: cached.preferredSkillsMatched.length + cached.preferredSkillsMissing.length,
        preferredMatched: cached.preferredSkillsMatched.length,
        candidateYears: estimateCandidateYearsOfExperience(resume.extractedText),
        jobSeniorityTier: parseSeniorityTier(job.title).tier,
        remoteStatus: (job.remoteStatus as RemoteWorkMode) || null,
        expAlignment: cached.experienceLevelAlignment || undefined
      })

      return {
        jobId: job.id,
        jobTitle: job.title,
        company: job.company,
        location: job.location,
        remoteStatus: (job.remoteStatus as RemoteWorkMode) || null,
        source: job.source,
        sourceJobId: job.sourceJobId,
        url: job.url,
        salary: job.salary,
        isSample: job.isSample,
        isActive: job.isActive,
        lastVerifiedAt: job.lastVerifiedAt.toISOString(),
        matchScore: cached.matchScore,
        scoreBreakdown: breakdown,
        requiredSkillsMatched: cached.requiredSkillsMatched,
        requiredSkillsMissing: cached.requiredSkillsMissing,
        preferredSkillsMatched: cached.preferredSkillsMatched,
        preferredSkillsMissing: cached.preferredSkillsMissing,
        unassessedSkills: cached.unassessedSkills,
        experienceLevelAlignment: cached.experienceLevelAlignment || "UNKNOWN",
        seniorityAlignment: cached.seniorityAlignment || "UNKNOWN",
        reasonsForMatch: cached.reasonsForMatch,
        actionableRecommendations: cached.recommendations,
        summary: cached.summary || `Compatibility match for ${job.title}`,
        isCached: true
      }
    }
  }

  // 3. Local Deterministic Evaluation (Default, ₹0 budget)
  const localResult = evaluateJobMatchLocally({
    resumeText: resume.extractedText,
    candidateSkills,
    jobTitle: job.title,
    jobCompany: job.company,
    jobDescription: job.description,
    jobSkills,
    remoteStatus: (job.remoteStatus as RemoteWorkMode) || null
  })

  const reqMatched = localResult.requiredSkillsMatched
  const reqMissing = localResult.requiredSkillsMissing
  const prefMatched = localResult.preferredSkillsMatched
  const prefMissing = localResult.preferredSkillsMissing
  const unassessed = localResult.unassessedSkills
  const expAlignment = localResult.experienceLevelAlignment
  const senAlignment = localResult.seniorityAlignment

  const finalBreakdown = calculateDeterministicMatchScore({
    requiredTotal: reqMatched.length + reqMissing.length,
    requiredMatched: reqMatched.length,
    preferredTotal: prefMatched.length + prefMissing.length,
    preferredMatched: prefMatched.length,
    candidateYears: estimateCandidateYearsOfExperience(resume.extractedText),
    jobSeniorityTier: parseSeniorityTier(job.title).tier,
    remoteStatus: (job.remoteStatus as RemoteWorkMode) || null,
    expAlignment
  })

  const finalMatchScore = finalBreakdown.total
  const reasons = localResult.reasonsForMatch
  const recommendations = localResult.actionableRecommendations
  const summary = localResult.summary

  // 4. Persist to JobMatch Cache in PostgreSQL
  await prisma.jobMatch.upsert({
    where: {
      userId_resumeId_jobId: {
        userId,
        resumeId,
        jobId
      }
    },
    update: {
      matchScore: finalMatchScore,
      requiredSkillsMatched: reqMatched,
      requiredSkillsMissing: reqMissing,
      preferredSkillsMatched: prefMatched,
      preferredSkillsMissing: prefMissing,
      unassessedSkills: unassessed,
      experienceLevelAlignment: expAlignment,
      seniorityAlignment: senAlignment,
      reasonsForMatch: reasons,
      recommendations,
      summary,
      rawClaudeAnalysis: null,
      inputHash
    },
    create: {
      userId,
      resumeId,
      jobId,
      matchScore: finalMatchScore,
      requiredSkillsMatched: reqMatched,
      requiredSkillsMissing: reqMissing,
      preferredSkillsMatched: prefMatched,
      preferredSkillsMissing: prefMissing,
      unassessedSkills: unassessed,
      experienceLevelAlignment: expAlignment,
      seniorityAlignment: senAlignment,
      reasonsForMatch: reasons,
      recommendations,
      summary,
      rawClaudeAnalysis: null,
      inputHash
    }
  })

  return {
    jobId: job.id,
    jobTitle: job.title,
    company: job.company,
    location: job.location,
    remoteStatus: (job.remoteStatus as RemoteWorkMode) || null,
    source: job.source,
    sourceJobId: job.sourceJobId,
    url: job.url,
    salary: job.salary,
    isSample: job.isSample,
    isActive: job.isActive,
    lastVerifiedAt: job.lastVerifiedAt.toISOString(),
    matchScore: finalMatchScore,
    scoreBreakdown: finalBreakdown,
    requiredSkillsMatched: reqMatched,
    requiredSkillsMissing: reqMissing,
    preferredSkillsMatched: prefMatched,
    preferredSkillsMissing: prefMissing,
    unassessedSkills: unassessed,
    experienceLevelAlignment: expAlignment,
    seniorityAlignment: senAlignment,
    reasonsForMatch: reasons,
    actionableRecommendations: recommendations,
    summary,
    isCached: false
  }
}

/**
 * Matches an authenticated user against all active jobs in the system,
 * returning matches sorted by highest compatibility score first.
 */
export async function matchUserToAllActiveJobs({
  userId,
  resumeId,
  minScore = 0,
  remoteOnly = false,
  locationFilter,
  roleFilter
}: {
  userId: number
  resumeId?: number
  minScore?: number
  remoteOnly?: boolean
  locationFilter?: string
  roleFilter?: string
}): Promise<{
  resume: { id: number; fileName: string; skills: string[] } | null
  matches: IntelligentJobMatchResult[]
}> {
  // 1. Locate active resume for the user
  let activeResume: { id: number; fileName: string; skills: string[] } | null = null

  if (resumeId) {
    activeResume = await prisma.resume.findFirst({
      where: { id: resumeId, userId },
      select: { id: true, fileName: true, skills: true }
    })
  } else {
    // Pick user's most recent uploaded resume
    activeResume = await prisma.resume.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, fileName: true, skills: true }
    })
  }

  if (!activeResume) {
    return { resume: null, matches: [] }
  }

  // 2. Fetch active jobs with optional filtering
  const whereClause: Record<string, unknown> = { isActive: true }
  if (remoteOnly) {
    whereClause.remoteStatus = "REMOTE"
  }
  if (locationFilter) {
    whereClause.location = { contains: locationFilter, mode: "insensitive" }
  }
  if (roleFilter) {
    whereClause.title = { contains: roleFilter, mode: "insensitive" }
  }

  const activeJobs = await prisma.job.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    take: 50
  })

  // 3. Compute or fetch cached matches for each job
  const matches: IntelligentJobMatchResult[] = []

  for (const job of activeJobs) {
    try {
      const match = await matchResumeToJob({
        userId,
        resumeId: activeResume.id,
        jobId: job.id
      })

      if (match.matchScore >= minScore) {
        matches.push(match)
      }
    } catch (err) {
      console.warn(`[MatchingEngine] Failed matching job ${job.id}:`, err)
    }
  }

  // Sort by highest match score first
  matches.sort((a, b) => b.matchScore - a.matchScore)

  return {
    resume: activeResume,
    matches
  }
}
