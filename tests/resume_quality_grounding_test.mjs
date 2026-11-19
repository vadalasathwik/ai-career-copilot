import assert from "node:assert/strict"
import { groundResumeQualityReport } from "../src/backend/services/aiService.ts"

const originalLine = "Improved checkout reliability for [X] users."
const syntheticResume = `Jordan Rivera\n${originalLine}\nMaintained the billing service.`
const baseReport = {
  atsScore: 70,
  summary: "Synthetic review.",
  grammarSpelling: [],
  awkwardPhrasing: [{
    originalText: originalLine,
    suggestedRevision: "Improved checkout reliability for thousands of active users.",
    explanation: "Adds scale."
  }],
  formattingReadability: [],
  missingSections: [],
  detectedSkills: [],
  keyImprovements: []
}

const grounded = groundResumeQualityReport(baseReport, syntheticResume)
assert.equal(grounded.awkwardPhrasing.length, 1)
assert.equal(grounded.awkwardPhrasing[0].originalText, originalLine)
assert.match(grounded.awkwardPhrasing[0].suggestedRevision, /verified value/i)
assert.doesNotMatch(grounded.awkwardPhrasing[0].suggestedRevision, /thousands|active users/i)

const unsupported = groundResumeQualityReport({
  ...baseReport,
  awkwardPhrasing: [{
    originalText: "Maintained the billing service.",
    suggestedRevision: "Led Kubernetes migration that reduced costs by 30%.",
    explanation: "Invents a skill and accomplishment."
  }]
}, syntheticResume)
assert.equal(unsupported.awkwardPhrasing[0].suggestedRevision, "Maintained the billing service.")

const hallucinatedSource = groundResumeQualityReport({
  ...baseReport,
  awkwardPhrasing: [{ ...baseReport.awkwardPhrasing[0], originalText: "Built an unrelated platform." }]
}, syntheticResume)
assert.equal(hallucinatedSource.awkwardPhrasing.length, 0)

console.log("✓ Resume quality grounding blocks invented user counts, skills, accomplishments, and non-verbatim source lines.")
