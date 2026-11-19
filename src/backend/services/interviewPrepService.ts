export interface InterviewPracticeQuestion {
  question: string
  jobRequirement: string
  resumeExcerpt: string | null
  evidenceStatus: "evidence" | "gap"
}

const STOP_WORDS = new Set([
  "about", "after", "also", "and", "are", "been", "being", "candidate", "collaborate", "company", "develop", "experience", "for", "from", "have", "ideal", "into", "join", "looking", "must", "our", "required", "requirements", "role", "that", "the", "their", "this", "through", "using", "will", "with", "work", "years", "your"
])

function cleanRequirement(value: string): string {
  return value.replace(/\s+/g, " ").replace(/^[•\-*\d. )]+/, "").trim().replace(/[.;:,]+$/, "")
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?:\r?\n)+|(?<=[.!?])\s+/)
    .map(cleanRequirement)
    .filter((sentence) => sentence.length >= 12)
}

function splitResumeSentences(text: string): string[] {
  return text
    .split(/(?:\r?\n)+|(?<=[.!?])\s+/)
    // Preserve the source characters so any displayed evidence is verbatim.
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 12)
}

function keywordTokens(value: string): string[] {
  return Array.from(new Set(
    value.normalize("NFKC").toLowerCase().match(/[a-z][a-z0-9+#.-]{1,}/g)?.filter((word) => !STOP_WORDS.has(word)) ?? []
  ))
}

function extractRequirements(jobDescription: string): string[] {
  const candidates = splitSentences(jobDescription)
    .filter((sentence) => /\b(required|requirements?|must|need(?:ed)?|should|experience|proficien(?:t|cy)|knowledge|skills?|qualifications?)\b/i.test(sentence))

  const source = candidates.length > 0 ? candidates : splitSentences(jobDescription)
  const seen = new Set<string>()
  return source.filter((requirement) => {
    const key = requirement.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 5)
}

function findEvidence(requirement: string, resumeSentences: string[]): string | null {
  const terms = keywordTokens(requirement)
  if (terms.length === 0) return null

  let best: { sentence: string; score: number } | null = null
  for (const sentence of resumeSentences) {
    const resumeTokens = new Set(keywordTokens(sentence))
    const matched = terms.filter((term) => resumeTokens.has(term)).length
    // A partial keyword overlap is not sufficient evidence for the entire
    // requirement. Mark it as a practice gap instead of implying experience.
    const threshold = terms.length
    if (matched >= threshold && (!best || matched > best.score)) {
      best = { sentence, score: matched }
    }
  }
  return best?.sentence ?? null
}

function questionFor(requirement: string, hasEvidence: boolean): string {
  if (hasEvidence) return `Tell me about a time your experience prepared you for this requirement: ${requirement}.`
  return `How would you approach this requirement, and what would you do to close any experience gap: ${requirement}?`
}

/**
 * Produces retrieval-grounded questions only. It never adds facts absent from the
 * resume; missing supporting text is explicitly marked as a practice gap.
 */
export function createInterviewPracticeQuestions(
  jobDescription: string,
  resumeText: string
): InterviewPracticeQuestion[] {
  const resumeSentences = splitResumeSentences(resumeText)
  return extractRequirements(jobDescription).map((jobRequirement) => {
    const resumeExcerpt = findEvidence(jobRequirement, resumeSentences)
    return {
      question: questionFor(jobRequirement, Boolean(resumeExcerpt)),
      jobRequirement,
      resumeExcerpt,
      evidenceStatus: resumeExcerpt ? "evidence" : "gap"
    }
  })
}
