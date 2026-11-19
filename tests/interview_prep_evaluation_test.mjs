import assert from "node:assert/strict"
import { createInterviewPracticeQuestions } from "../src/backend/services/interviewPrepService.ts"

const cases = [
  ["TypeScript", "Built TypeScript services.", true], ["Docker", "Automated deployments with Docker.", true],
  ["K8s", "Operated Kubernetes clusters.", true], ["container orchestration", "Operated Kubernetes clusters.", true],
  ["relational database", "Designed PostgreSQL schemas.", true], ["relational database", "Maintained MySQL data stores.", true],
  ["automated deployment", "Implemented CI/CD pipelines.", true], ["React", "Built React dashboards.", true],
  ["Node.js", "Maintained Node.js APIs.", true], ["Python", "Automated reports with Python.", true],
  ["Java", "Maintained JavaScript interfaces.", false], ["PostgreSQL", "Maintained MySQL data stores.", false],
  ["Kubernetes", "Coordinated generic orchestration work.", false], ["TypeScript and React", "Built TypeScript services.", false],
  ["Docker and Kubernetes", "Automated deployments with Docker.", false], ["AWS", "Deployed services on Azure.", false],
  // Held out: paraphrases the current directional synonym rules intentionally do not cover.
  ["event streaming platform", "Built Kafka event pipelines.", true], ["distributed cache", "Improved Redis caching.", true],
  ["Kubernetes production", "Operated Kubernetes clusters.", false], ["PostgreSQL performance", "Designed PostgreSQL schemas.", false]
]

function evaluate(slice) {
  let positives = 0, positivesFound = 0, gaps = 0, falsePositives = 0, keywordFound = 0, synonymFound = 0
  for (const [requirement, resume, expected] of slice) {
    const question = createInterviewPracticeQuestions(`Required: ${requirement} experience for this role.`, resume)[0]
    const found = question.evidenceStatus === "evidence"
    if (expected) { positives += 1; if (found) positivesFound += 1 }
    else { gaps += 1; if (found) falsePositives += 1 }
    if (question.evidenceMethod === "keyword") keywordFound += 1
    if (question.evidenceMethod === "semantic") synonymFound += 1
  }
  return { positives, positivesFound, gaps, falsePositives, keywordFound, synonymFound }
}

const development = evaluate(cases.slice(0, 16))
const heldOut = evaluate(cases.slice(16))
assert.equal(development.falsePositives, 0, "Directional rules must not produce false positives in development cases")
assert.equal(heldOut.falsePositives, 0, "Directional rules must not produce false positives in held-out cases")
console.log(JSON.stringify({
  cases: cases.length,
  development: { recallAt3: `${development.positivesFound}/${development.positives}`, falsePositiveRate: `${development.falsePositives}/${development.gaps}`, keywordFound: development.keywordFound, synonymFound: development.synonymFound },
  heldOut: { recallAt3: `${heldOut.positivesFound}/${heldOut.positives}`, falsePositiveRate: `${heldOut.falsePositives}/${heldOut.gaps}`, keywordFound: heldOut.keywordFound, synonymFound: heldOut.synonymFound },
  vector: "unavailable: pgvector extension is not installed or available on this development database"
}))
