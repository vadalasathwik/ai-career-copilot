import assert from "node:assert/strict"
import { prisma } from "../src/backend/db/prisma.ts"
import { generateGroundedInterviewQuestions } from "../src/backend/services/aiService.ts"
import { applyVectorEvidence, createInterviewPracticeQuestions } from "../src/backend/services/interviewPrepService.ts"
import { ensureResumeEvidenceIndex, retrieveResumeEvidenceCandidates } from "../src/backend/services/resumeEvidenceService.ts"

async function run() {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`
  let user
  let resume
  try {
    user = await prisma.user.create({ data: { name: "Grounded Gemini Demo", email: `grounded_demo_${suffix}@example.com`, provider: "local" } })
    resume = await prisma.resume.create({
      data: {
        userId: user.id,
        fileName: "grounded-demo.pdf",
        fileSize: 1,
        fileType: "application/pdf",
        filePath: "/tmp/grounded-demo.pdf",
        extractedText: "Operated Kubernetes clusters for production workloads. Built Kafka event pipelines for internal services.",
        skills: ["Kubernetes", "Kafka"]
      }
    })
    const index = await ensureResumeEvidenceIndex(resume.id, resume.extractedText)
    assert.equal(index.available, true, "The isolated pgvector database must index the synthetic resume")

    const requirements = ["Required: container orchestration experience for this role.", "Required: event streaming platform experience for this role."]
    const baseline = createInterviewPracticeQuestions(requirements.join(" "), resume.extractedText)
    const candidates = await Promise.all(baseline.map((item) => retrieveResumeEvidenceCandidates(resume.id, item.jobRequirement)))
    const questions = baseline.map((item, index) => applyVectorEvidence(item, candidates[index].candidates))
    const approved = questions.map((item, index) => item.resumeExcerpt ? [{ id: `r${index}-e1`, text: item.resumeExcerpt }] : [])
    const generated = await generateGroundedInterviewQuestions({
      items: questions.map((item, index) => ({ requirement: item.jobRequirement, approvedExcerpts: approved[index] }))
    })
    const byRequirement = new Map(generated.map((item) => [item.requirementIndex, item]))
    const kubernetes = byRequirement.get(0)
    const kafka = byRequirement.get(1)
    assert.equal(questions[0].resumeExcerpt, "Operated Kubernetes clusters for production workloads.")
    assert.equal(kubernetes?.excerptId, "r0-e1", "Gemini must cite the server-assigned Kubernetes excerpt ID")
    assert.equal(questions[1].evidenceStatus, "gap", "Kafka remains a practice gap under the existing evidence rule")
    assert.ok(candidates[1].candidates.some((candidate) => candidate.text.includes("Kafka")), "Vector retrieval must surface the Kafka candidate")
    assert.equal(kafka?.excerptId, null, "A practice gap must not receive a citation")
    console.log(JSON.stringify({
      kubernetes: { question: kubernetes.question, excerpt: approved[0][0].text, retrieval: questions[0].evidenceMethod },
      kafka: { question: kafka.question, evidenceStatus: questions[1].evidenceStatus, vectorCandidate: candidates[1].candidates.find((candidate) => candidate.text.includes("Kafka"))?.text }
    }, null, 2))
  } finally {
    if (resume) await prisma.resume.delete({ where: { id: resume.id } })
    if (user) await prisma.user.delete({ where: { id: user.id } })
  }
}

run().catch((error) => { console.error(error); process.exit(1) })
