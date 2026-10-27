import crypto from "crypto"
import type { RemoteWorkMode } from "./jobProviders/types"

export interface MatchScoreBreakdown {
  requiredSkillsScore: number // out of 45
  preferredSkillsScore: number // out of 20
  experienceScore: number // out of 20
  seniorityScore: number // out of 10
  locationScore: number // out of 5
  total: number // 0-100
}

export interface LocalSemanticQualificationResult {
  matchScore: number
  scoreBreakdown: MatchScoreBreakdown
  requiredSkillsMatched: string[]
  requiredSkillsMissing: string[]
  preferredSkillsMatched: string[]
  preferredSkillsMissing: string[]
  unassessedSkills: string[]
  experienceLevelAlignment: "STRONG" | "MODERATE" | "GAP" | "UNKNOWN"
  seniorityAlignment: "MATCH" | "OVERQUALIFIED" | "UNDERQUALIFIED" | "UNKNOWN"
  reasonsForMatch: string[]
  actionableRecommendations: string[]
  summary: string
}

// Common technical skills dictionary for heuristic extraction
const CURATED_TECH_SKILLS = [
  "JavaScript", "TypeScript", "Python", "Java", "C++", "C#", "Go", "Rust", "PHP", "Ruby", "Swift", "Kotlin",
  "React", "React Native", "Next.js", "Vue", "Angular", "Svelte", "Node.js", "Express", "NestJS", "FastAPI",
  "Django", "Flask", "Spring Boot", "GraphQL", "REST API", "HTML", "CSS", "Tailwind CSS",
  "PostgreSQL", "MySQL", "SQLite", "MongoDB", "Redis", "Elasticsearch", "Prisma",
  "Docker", "Kubernetes", "AWS", "Google Cloud", "Azure", "Terraform", "CI/CD", "Git", "Linux"
]

// Skill alias map for resilient synonym matching
const SKILL_ALIASES: Record<string, string> = {
  "react.js": "React",
  "reactjs": "React",
  "react": "React",
  "node.js": "Node.js",
  "nodejs": "Node.js",
  "node": "Node.js",
  "next.js": "Next.js",
  "nextjs": "Next.js",
  "next": "Next.js",
  "typescript": "TypeScript",
  "ts": "TypeScript",
  "javascript": "JavaScript",
  "js": "JavaScript",
  "postgres": "PostgreSQL",
  "postgresql": "PostgreSQL",
  "k8s": "Kubernetes",
  "kubernetes": "Kubernetes",
  "aws": "AWS",
  "amazon web services": "AWS",
  "gcp": "Google Cloud",
  "google cloud": "Google Cloud",
  "google cloud platform": "Google Cloud",
  "docker": "Docker",
  "graphql": "GraphQL",
  "rest api": "REST API",
  "restful api": "REST API",
  "rest": "REST API",
  "restful": "REST API",
  "tailwind": "Tailwind CSS",
  "tailwind css": "Tailwind CSS",
  "tailwindcss": "Tailwind CSS",
  "prisma": "Prisma",
  "prisma orm": "Prisma",
  "ci/cd": "CI/CD",
  "cicd": "CI/CD",
  "continuous integration": "CI/CD",
  "git": "Git",
  "github": "Git",
  "gitlab": "Git",
  "linux": "Linux",
  "redis": "Redis",
  "mongodb": "MongoDB",
  "mongo": "MongoDB",
  "python": "Python",
  "fastapi": "FastAPI",
  "django": "Django",
  "flask": "Flask",
  "java": "Java",
  "spring": "Spring Boot",
  "spring boot": "Spring Boot",
  "golang": "Go",
  "go": "Go",
  "rust": "Rust"
}

function normalizeSkillName(raw: string): string {
  const trimmed = raw.trim().toLowerCase()
  return SKILL_ALIASES[trimmed] || raw.trim()
}

/**
 * Extracts recognized technical skills from arbitrary text.
 */
export function extractSkillsFromJobText(text: string): string[] {
  if (!text) return []
  const lowerText = text.toLowerCase()
  const matched = new Set<string>()

  for (const skill of CURATED_TECH_SKILLS) {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").toLowerCase()
    const regex = new RegExp(`(^|[^a-zA-Z0-9#+])${escaped}($|[^a-zA-Z0-9#+])`, "i")
    if (regex.test(lowerText)) {
      matched.add(normalizeSkillName(skill))
    }
  }

  // Also check common aliases
  for (const [alias, canonical] of Object.entries(SKILL_ALIASES)) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const regex = new RegExp(`(^|[^a-zA-Z0-9#+])${escaped}($|[^a-zA-Z0-9#+])`, "i")
    if (regex.test(lowerText)) {
      matched.add(canonical)
    }
  }

  return Array.from(matched)
}

/**
 * Checks if a specific skill is evidenced in either the candidate's skills array
 * or mentioned directly in their resume text.
 */
export function isSkillEvidencedInCandidate(
  skill: string,
  candidateSkills: string[],
  resumeText: string
): boolean {
  const canonicalSkill = normalizeSkillName(skill).toLowerCase()

  // 1. Check tagged skills
  for (const cs of candidateSkills) {
    if (normalizeSkillName(cs).toLowerCase() === canonicalSkill) {
      return true
    }
  }

  // 2. Check full resume text
  const escaped = canonicalSkill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const regex = new RegExp(`(^|[^a-zA-Z0-9#+])${escaped}($|[^a-zA-Z0-9#+])`, "i")
  if (regex.test(resumeText.toLowerCase())) {
    return true
  }

  // 3. Check aliases
  for (const [alias, canonical] of Object.entries(SKILL_ALIASES)) {
    if (canonical.toLowerCase() === canonicalSkill) {
      const aliasEscaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const aliasRegex = new RegExp(`(^|[^a-zA-Z0-9#+])${aliasEscaped}($|[^a-zA-Z0-9#+])`, "i")
      if (aliasRegex.test(resumeText.toLowerCase())) {
        return true
      }
    }
  }

  return false
}

/**
 * Computes a SHA-256 fingerprint of the candidate resume and target job text
 * to determine if a cached match remains valid or needs re-computation.
 */
export function computeMatchInputHash(
  resumeText: string,
  resumeSkills: string[],
  jobDescription: string,
  jobSkills: string[]
): string {
  const payload = [
    resumeText.trim(),
    resumeSkills.slice().sort().join(","),
    jobDescription.trim(),
    jobSkills.slice().sort().join(",")
  ].join(":::")
  return crypto.createHash("sha256").update(payload).digest("hex")
}

/**
 * Parses estimated years of experience from resume text.
 */
export function estimateCandidateYearsOfExperience(resumeText: string): number {
  if (!resumeText) return 0
  const matches = resumeText.matchAll(
    /(\d{1,2})\+?\s*(?:years?|yrs?)(?:\s+of)?(?:\s+[\w-]+){0,3}\s+(?:experience|working|engineering|development|building|industry|work|background)/gi
  )
  let maxYears = 0
  for (const m of matches) {
    const val = parseInt(m[1], 10)
    if (!isNaN(val) && val > maxYears && val <= 40) {
      maxYears = val
    }
  }

  // Secondary heuristic: look for graduation year or year range like "2018 - Present" or "2019 - 2024"
  const currentYear = new Date().getFullYear()
  const yearRangeMatches = resumeText.matchAll(/(?:20\d{2}|19\d{2})\s*(?:-|–|to)\s*(?:present|current|now|20\d{2})/gi)
  for (const ym of yearRangeMatches) {
    const startMatch = ym[0].match(/(\d{4})/)
    if (startMatch) {
      const startYear = parseInt(startMatch[1], 10)
      if (startYear >= 1980 && startYear <= currentYear) {
        const diff = currentYear - startYear
        if (diff > maxYears && diff <= 40) {
          maxYears = diff
        }
      }
    }
  }

  return maxYears
}

/**
 * Parses target seniority tier from a job title.
 * 1: Junior/Entry, 2: Mid-level, 3: Senior, 4: Lead/Staff/Principal/Architect
 */
export function parseSeniorityTier(title: string): { tier: number; label: string; minYearsRequired: number } {
  const t = (title || "").toLowerCase()
  if (t.includes("staff") || t.includes("principal") || t.includes("architect") || t.includes("director") || t.includes("head") || t.includes("vp")) {
    return { tier: 4, label: "Staff/Principal", minYearsRequired: 8 }
  }
  if (t.includes("senior") || t.includes("sr.") || t.includes("lead") || t.includes("tier 3") || t.includes("level 3")) {
    return { tier: 3, label: "Senior", minYearsRequired: 5 }
  }
  if (t.includes("junior") || t.includes("jr.") || t.includes("associate") || t.includes("entry") || t.includes("intern") || t.includes("trainee")) {
    return { tier: 1, label: "Junior/Entry", minYearsRequired: 0 }
  }
  return { tier: 2, label: "Mid-level", minYearsRequired: 2 }
}

/**
 * Parses minimum required years of experience stated in a job description.
 */
export function parseJobRequiredYears(jobDescription: string, fallbackSeniorityTier: number): number {
  if (!jobDescription) {
    if (fallbackSeniorityTier >= 4) return 8
    if (fallbackSeniorityTier === 3) return 5
    if (fallbackSeniorityTier === 2) return 2
    return 0
  }

  const matches = jobDescription.matchAll(
    /(\d{1,2})\+?\s*(?:years?|yrs?)(?:\s+of)?(?:\s+[\w-]+){0,3}\s+(?:experience|required|working|hands-on|industry|work)/gi
  )
  let detectedMin = -1
  for (const m of matches) {
    const val = parseInt(m[1], 10)
    if (!isNaN(val) && val >= 0 && val <= 25) {
      if (detectedMin === -1 || val < detectedMin) {
        detectedMin = val
      }
    }
  }

  if (detectedMin >= 0) {
    return detectedMin
  }

  if (fallbackSeniorityTier >= 4) return 8
  if (fallbackSeniorityTier === 3) return 5
  if (fallbackSeniorityTier === 2) return 2
  return 0
}

/**
 * Computes deterministic, documented weighted score.
 * Formula:
 * - Required Skills: 45%
 * - Preferred Skills: 20%
 * - Relevant Experience: 20%
 * - Seniority Alignment: 10%
 * - Location / Remote Preference: 5%
 */
export function calculateDeterministicMatchScore({
  requiredTotal,
  requiredMatched,
  preferredTotal,
  preferredMatched,
  candidateYears,
  jobSeniorityTier,
  remoteStatus,
  expAlignment
}: {
  requiredTotal: number
  requiredMatched: number
  preferredTotal: number
  preferredMatched: number
  candidateYears: number
  jobSeniorityTier: number
  remoteStatus?: RemoteWorkMode | null
  expAlignment?: string
}): MatchScoreBreakdown {
  // 1. Required Skills Score (max 45)
  let requiredRatio = 0
  if (requiredTotal > 0) {
    requiredRatio = Math.min(1, Math.max(0, requiredMatched / requiredTotal))
  }
  const requiredSkillsScore = Math.round(requiredRatio * 45)

  // 2. Preferred Skills Score (max 20)
  let preferredRatio = 0
  if (preferredTotal > 0) {
    preferredRatio = Math.min(1, Math.max(0, preferredMatched / preferredTotal))
  } else if (requiredTotal > 0) {
    // If no explicit preferred skills, distribute proportional to required
    preferredRatio = requiredRatio
  }
  const preferredSkillsScore = Math.round(preferredRatio * 20)

  // 3. Relevant Experience Score (max 20)
  let experienceScore = 14 // default moderate baseline
  if (expAlignment === "STRONG") {
    experienceScore = 20
  } else if (expAlignment === "MODERATE") {
    experienceScore = 14
  } else if (expAlignment === "GAP") {
    experienceScore = 6
  } else {
    // Deterministic calculation based on years of experience vs seniority
    if (jobSeniorityTier >= 4) {
      experienceScore = candidateYears >= 8 ? 20 : candidateYears >= 5 ? 14 : 6
    } else if (jobSeniorityTier === 3) {
      experienceScore = candidateYears >= 5 ? 20 : candidateYears >= 3 ? 15 : 8
    } else if (jobSeniorityTier === 2) {
      experienceScore = candidateYears >= 2 ? 20 : 12
    } else {
      experienceScore = 20
    }
  }

  // 4. Seniority Score (max 10)
  let candidateEstimatedTier = 2
  if (candidateYears >= 8) candidateEstimatedTier = 4
  else if (candidateYears >= 5) candidateEstimatedTier = 3
  else if (candidateYears <= 1) candidateEstimatedTier = 1

  const tierDiff = candidateEstimatedTier - jobSeniorityTier
  let seniorityScore = 7
  if (tierDiff === 0) seniorityScore = 10
  else if (tierDiff > 0) seniorityScore = 9 // Candidate is more senior than required
  else if (tierDiff === -1) seniorityScore = 6 // 1 level junior
  else seniorityScore = 3 // 2+ levels junior

  // 5. Location / Work Mode Score (max 5)
  let locationScore = 3
  if (remoteStatus === "REMOTE") {
    locationScore = 5
  } else if (remoteStatus === "HYBRID") {
    locationScore = 4
  } else if (remoteStatus === "ON_SITE") {
    locationScore = 3
  }

  const total = Math.min(
    100,
    Math.max(
      0,
      requiredSkillsScore +
        preferredSkillsScore +
        experienceScore +
        seniorityScore +
        locationScore
    )
  )

  return {
    requiredSkillsScore,
    preferredSkillsScore,
    experienceScore,
    seniorityScore,
    locationScore,
    total
  }
}

/**
 * 100% Deterministic Local TypeScript Semantic Qualification Engine.
 * Operates with ₹0 API budget: zero external LLM API calls, zero tokens, zero cost.
 */
export function evaluateJobMatchLocally({
  resumeText,
  candidateSkills,
  jobTitle,
  jobCompany,
  jobDescription,
  jobSkills,
  remoteStatus
}: {
  resumeText: string
  candidateSkills: string[]
  jobTitle: string
  jobCompany: string
  jobDescription: string
  jobSkills: string[]
  remoteStatus?: RemoteWorkMode | null
}): LocalSemanticQualificationResult {
  // 1. Gather all skills from job skills array and extracted from job description
  const combinedJobSkills = new Set<string>()
  for (const s of jobSkills) {
    if (s && s.trim()) combinedJobSkills.add(normalizeSkillName(s))
  }
  const extractedFromDesc = extractSkillsFromJobText(jobDescription)
  for (const s of extractedFromDesc) {
    combinedJobSkills.add(s)
  }

  // 2. Partition skills into Required vs Preferred
  // If job description contains sections like "preferred", "nice to have", "plus", classify those
  const lowerDesc = (jobDescription || "").toLowerCase()
  const prefSectionIndex = Math.min(
    ...[
      lowerDesc.indexOf("nice to have"),
      lowerDesc.indexOf("preferred"),
      lowerDesc.indexOf("bonus"),
      lowerDesc.indexOf("plus:"),
      lowerDesc.indexOf("desired qualifications")
    ].filter((idx) => idx !== -1)
  )

  const requiredSkillsList: string[] = []
  const preferredSkillsList: string[] = []

  if (prefSectionIndex !== Infinity && prefSectionIndex > 0) {
    const reqPart = lowerDesc.slice(0, prefSectionIndex)
    const prefPart = lowerDesc.slice(prefSectionIndex)

    for (const skill of combinedJobSkills) {
      const lowerSkill = skill.toLowerCase()
      if (prefPart.includes(lowerSkill) && !reqPart.includes(lowerSkill)) {
        preferredSkillsList.push(skill)
      } else {
        requiredSkillsList.push(skill)
      }
    }
  } else {
    // If no explicit section, treat top 70% as required, remaining as preferred
    const allList = Array.from(combinedJobSkills)
    const cutoff = Math.max(1, Math.ceil(allList.length * 0.7))
    requiredSkillsList.push(...allList.slice(0, cutoff))
    preferredSkillsList.push(...allList.slice(cutoff))
  }

  // 3. Match against candidate evidence
  const requiredSkillsMatched: string[] = []
  const requiredSkillsMissing: string[] = []
  const preferredSkillsMatched: string[] = []
  const preferredSkillsMissing: string[] = []

  for (const skill of requiredSkillsList) {
    if (isSkillEvidencedInCandidate(skill, candidateSkills, resumeText)) {
      requiredSkillsMatched.push(skill)
    } else {
      requiredSkillsMissing.push(skill)
    }
  }

  for (const skill of preferredSkillsList) {
    if (isSkillEvidencedInCandidate(skill, candidateSkills, resumeText)) {
      preferredSkillsMatched.push(skill)
    } else {
      preferredSkillsMissing.push(skill)
    }
  }

  // 4. Experience & Seniority alignment
  const candidateYears = estimateCandidateYearsOfExperience(resumeText)
  const seniorityInfo = parseSeniorityTier(jobTitle)
  const jobReqYears = parseJobRequiredYears(jobDescription, seniorityInfo.tier)

  let experienceLevelAlignment: "STRONG" | "MODERATE" | "GAP" | "UNKNOWN" = "UNKNOWN"
  if (candidateYears >= jobReqYears) {
    experienceLevelAlignment = "STRONG"
  } else if (candidateYears >= Math.max(1, jobReqYears - 2)) {
    experienceLevelAlignment = "MODERATE"
  } else {
    experienceLevelAlignment = "GAP"
  }

  let candidateEstimatedTier = 2
  if (candidateYears >= 8) candidateEstimatedTier = 4
  else if (candidateYears >= 5) candidateEstimatedTier = 3
  else if (candidateYears <= 1) candidateEstimatedTier = 1

  let seniorityAlignment: "MATCH" | "OVERQUALIFIED" | "UNDERQUALIFIED" | "UNKNOWN" = "UNKNOWN"
  if (candidateEstimatedTier === seniorityInfo.tier) {
    seniorityAlignment = "MATCH"
  } else if (candidateEstimatedTier > seniorityInfo.tier) {
    seniorityAlignment = "OVERQUALIFIED"
  } else {
    seniorityAlignment = "UNDERQUALIFIED"
  }

  // 5. Score breakdown calculation
  const scoreBreakdown = calculateDeterministicMatchScore({
    requiredTotal: requiredSkillsMatched.length + requiredSkillsMissing.length,
    requiredMatched: requiredSkillsMatched.length,
    preferredTotal: preferredSkillsMatched.length + preferredSkillsMissing.length,
    preferredMatched: preferredSkillsMatched.length,
    candidateYears,
    jobSeniorityTier: seniorityInfo.tier,
    remoteStatus,
    expAlignment: experienceLevelAlignment
  })

  // 6. Reasons for match (Evidence-based)
  const reasonsForMatch: string[] = []
  if (requiredSkillsMatched.length > 0) {
    reasonsForMatch.push(
      `Strong technical overlap: demonstrates verified competencies in ${requiredSkillsMatched.slice(0, 4).join(", ")}.`
    )
  }
  if (preferredSkillsMatched.length > 0) {
    reasonsForMatch.push(
      `Bonus qualifications met: possesses hands-on experience with ${preferredSkillsMatched.slice(0, 2).join(" and ")}.`
    )
  }
  if (experienceLevelAlignment === "STRONG") {
    reasonsForMatch.push(
      `Experience requirement fully met: Candidate possesses ~${candidateYears} years of documented experience (job requires ~${jobReqYears} yrs).`
    )
  } else if (experienceLevelAlignment === "MODERATE") {
    reasonsForMatch.push(
      `Close experience tier alignment: ~${candidateYears} years of experience vs ${jobReqYears} years required.`
    )
  }
  if (remoteStatus === "REMOTE") {
    reasonsForMatch.push("100% remote work mode matches candidate location flexibility.")
  }
  if (reasonsForMatch.length === 0) {
    reasonsForMatch.push("Foundational technical alignment based on resume profile.")
  }

  // 7. Actionable recommendations (Evidence-based)
  const actionableRecommendations: string[] = []
  if (requiredSkillsMissing.length > 0) {
    actionableRecommendations.push(
      `Core skill gap: Emphasize any project or hands-on exposure to ${requiredSkillsMissing.slice(0, 3).join(", ")} on your resume.`
    )
  }
  if (preferredSkillsMissing.length > 0) {
    actionableRecommendations.push(
      `Preferred skill gap: Consider highlighting familiarity with ${preferredSkillsMissing.slice(0, 2).join(" or ")} in your interview preparation.`
    )
  }
  if (seniorityAlignment === "UNDERQUALIFIED") {
    actionableRecommendations.push(
      `Seniority tier stretch: Prepare concrete system architecture and technical leadership examples to demonstrate senior readiness.`
    )
  } else if (seniorityAlignment === "OVERQUALIFIED") {
    actionableRecommendations.push(
      `High seniority profile: Clarify in your application why this role and ${jobCompany}'s domain align with your career goals.`
    )
  }
  if (requiredSkillsMissing.length === 0 && preferredSkillsMissing.length === 0) {
    actionableRecommendations.push(
      "Outstanding alignment across all technical criteria. Review system design case studies and architectural trade-offs for technical interviews."
    )
  }

  const summary = `${scoreBreakdown.total}% qualification match: matched ${requiredSkillsMatched.length} of ${requiredSkillsMatched.length + requiredSkillsMissing.length} required competencies with ${seniorityAlignment.toLowerCase()} seniority alignment.`

  return {
    matchScore: scoreBreakdown.total,
    scoreBreakdown,
    requiredSkillsMatched,
    requiredSkillsMissing,
    preferredSkillsMatched,
    preferredSkillsMissing,
    unassessedSkills: [],
    experienceLevelAlignment,
    seniorityAlignment,
    reasonsForMatch,
    actionableRecommendations,
    summary
  }
}
