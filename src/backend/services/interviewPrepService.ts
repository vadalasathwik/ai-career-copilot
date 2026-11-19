export interface InterviewPracticeQuestion {
  question: string
  jobRequirement: string
  resumeExcerpt: string | null
  evidenceStatus: "evidence" | "gap"
  evidenceMethod: "vector" | "semantic" | "keyword" | "none"
  gapExplanation?: string
}

// Vector similarity ranks the three candidates; directional evidence validation
// is the conservative citation gate, so no additional similarity cutoff is used.
export const VECTOR_EVIDENCE_MIN_SIMILARITY = 0

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
    value
      .normalize("NFKC")
      .toLowerCase()
      .match(/[a-z][a-z0-9+#.-]{1,}/g)
      ?.map((word) => word.replace(/^[.-]+|[.-]+$/g, ""))
      .filter((word) => word.length > 0 && !STOP_WORDS.has(word)) ?? []
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

// Directional synonym rules: a named product can prove a broader capability,
// but a broad concept or sibling product can never prove a named requirement.
const SYNONYM_RULES = [
  { genericPhrases: ["container orchestration"], aliasGroups: [["kubernetes", "k8s"]] },
  { genericPhrases: ["relational database", "sql database"], aliasGroups: [["postgresql"], ["mysql"]] },
  { genericPhrases: ["deployment automation", "automated deployment"], aliasGroups: [["ci/cd"]] }
]

function hasPhrase(tokens: Set<string>, phrase: string): boolean {
  return keywordTokens(phrase).every((token) => tokens.has(token))
}

function findSemanticEvidence(requirement: string, resumeSentences: string[]): string | null {
  const requirementTokens = new Set(keywordTokens(requirement))
  const allowedAliasGroups: string[][] = []
  const consumedTerms = new Set<string>()

  for (const rule of SYNONYM_RULES) {
    const genericRequirement = rule.genericPhrases.some((phrase) => hasPhrase(requirementTokens, phrase))
    if (genericRequirement) {
      allowedAliasGroups.push(rule.aliasGroups.flat())
      rule.genericPhrases.forEach((phrase) => keywordTokens(phrase).forEach((term) => consumedTerms.add(term)))
    }

    for (const aliases of rule.aliasGroups) {
      if (aliases.some((alias) => hasPhrase(requirementTokens, alias))) {
        // Only the requirement's own aliases are eligible; sibling products are not.
        allowedAliasGroups.push(aliases)
        aliases.forEach((alias) => keywordTokens(alias).forEach((term) => consumedTerms.add(term)))
      }
    }
  }

  if (allowedAliasGroups.length === 0) return null
  const remainingTerms = keywordTokens(requirement).filter((term) => !consumedTerms.has(term))

  return resumeSentences.find((sentence) => {
    const sentenceTokens = new Set(keywordTokens(sentence))
    return (
      allowedAliasGroups.every((aliases) => aliases.some((alias) => hasPhrase(sentenceTokens, alias))) &&
      remainingTerms.every((term) => sentenceTokens.has(term))
    )
  }) ?? null
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

/** Applies the same directional proof rule to a vector-ranked candidate. */
export function evidenceRuleMatches(requirement: string, excerpt: string): boolean {
  return Boolean(findSemanticEvidence(requirement, [excerpt]) ?? findEvidence(requirement, [excerpt]))
}

export function applyVectorEvidence(
  question: InterviewPracticeQuestion,
  candidates: Array<{ text: string; similarity: number }>
): InterviewPracticeQuestion {
  // Similarity ranks candidates only. Quotes are shown only after the same
  // exact/directional proof rule used by keyword and synonym retrieval.
  const candidate = candidates.find((item) => item.similarity >= VECTOR_EVIDENCE_MIN_SIMILARITY && evidenceRuleMatches(question.jobRequirement, item.text))
  if (!candidate) return question
  return {
    ...question,
    resumeExcerpt: candidate.text,
    evidenceStatus: "evidence",
    evidenceMethod: "vector",
    gapExplanation: undefined
  }
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
    const semanticExcerpt = findSemanticEvidence(jobRequirement, resumeSentences)
    const resumeExcerpt = semanticExcerpt ?? findEvidence(jobRequirement, resumeSentences)
    const evidenceMethod = semanticExcerpt ? "semantic" : resumeExcerpt ? "keyword" : "none"
    return {
      question: questionFor(jobRequirement, Boolean(resumeExcerpt)),
      jobRequirement,
      resumeExcerpt,
      evidenceStatus: resumeExcerpt ? "evidence" : "gap",
      evidenceMethod,
      gapExplanation: resumeExcerpt ? undefined : "No verbatim resume excerpt met the evidence rule for this requirement."
    }
  })
}
