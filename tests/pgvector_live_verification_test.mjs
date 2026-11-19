import assert from "node:assert/strict"
import pg from "pg"
import { prisma } from "../src/backend/db/prisma.ts"
import { applyVectorEvidence, createInterviewPracticeQuestions } from "../src/backend/services/interviewPrepService.ts"
import { ensureResumeEvidenceIndex, retrieveResumeEvidenceCandidates } from "../src/backend/services/resumeEvidenceService.ts"

const CASES = [
  ["TypeScript", "Built TypeScript services.", true], ["Docker", "Automated deployments with Docker.", true],
  ["K8s", "Operated Kubernetes clusters.", true], ["container orchestration", "Operated Kubernetes clusters.", true],
  ["relational database", "Designed PostgreSQL schemas.", true], ["relational database", "Maintained MySQL data stores.", true],
  ["automated deployment", "Implemented CI/CD pipelines.", true], ["React", "Built React dashboards.", true],
  ["Node.js", "Maintained Node.js APIs.", true], ["Python", "Automated reports with Python.", true],
  ["Java", "Maintained JavaScript interfaces.", false], ["PostgreSQL", "Maintained MySQL data stores.", false],
  ["Kubernetes", "Coordinated generic orchestration work.", false], ["TypeScript and React", "Built TypeScript services.", false],
  ["Docker and Kubernetes", "Automated deployments with Docker.", false], ["AWS", "Deployed services on Azure.", false],
  ["event streaming platform", "Built Kafka event pipelines.", true], ["distributed cache", "Improved Redis caching.", true],
  ["Kubernetes production", "Operated Kubernetes clusters.", false], ["PostgreSQL performance", "Designed PostgreSQL schemas.", false]
]

function metrics(results) {
  const positives = results.filter((result) => result.expected)
  const gaps = results.filter((result) => !result.expected)
  return {
    candidateRecallAt3: `${positives.filter((result) => result.inTop3).length}/${positives.length}`,
    acceptedCitationRecall: `${positives.filter((result) => result.accepted).length}/${positives.length}`,
    falsePositiveRate: `${gaps.filter((result) => result.accepted).length}/${gaps.length}`
  }
}

async function run() {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`
  let user
  const resumeIds = []
  const { Client } = pg
  const client = new Client({ connectionString: process.env.DATABASE_URL })

  try {
    await client.connect()
    user = await prisma.user.create({ data: { name: "Vector Evaluation", email: `vector_eval_${suffix}@example.com`, provider: "local" } })
    const results = []

    for (let index = 0; index < CASES.length; index += 1) {
      const [requirement, excerpt, expected] = CASES[index]
      const resume = await prisma.resume.create({ data: { userId: user.id, fileName: `vector_${index}.pdf`, fileSize: 1, fileType: "application/pdf", filePath: `/tmp/vector_${index}.pdf`, extractedText: excerpt, skills: [] } })
      resumeIds.push(resume.id)
      const indexed = await ensureResumeEvidenceIndex(resume.id, excerpt)
      assert.equal(indexed.available, true, `Case ${index} must index with pgvector`)
      const retrieval = await retrieveResumeEvidenceCandidates(resume.id, `Required: ${requirement} experience for this role.`)
      assert.equal(retrieval.available, true, `Case ${index} must retrieve with pgvector`)
      const question = createInterviewPracticeQuestions(`Required: ${requirement} experience for this role.`, excerpt)[0]
      const vectorQuestion = applyVectorEvidence(question, retrieval.candidates)
      results.push({ expected, inTop3: retrieval.candidates.some((candidate) => candidate.text === excerpt), accepted: vectorQuestion.evidenceMethod === "vector", requirement, excerpt, candidates: retrieval.candidates.length })
    }

    const development = results.slice(0, 16)
    const heldOut = results.slice(16)
    assert.equal(metrics(development).falsePositiveRate, "0/6")
    assert.equal(metrics(heldOut).falsePositiveRate, "0/2")

    // Retrieval is strictly scoped to its selected resume.
    const isolation = await retrieveResumeEvidenceCandidates(resumeIds[0], "PostgreSQL experience")
    assert.ok(isolation.candidates.every((candidate) => candidate.text === CASES[0][1]), "Vector retrieval must not read another resume's chunks")

    // Re-indexing replaces old chunks for changed extracted text.
    const replacement = "Built TypeScript services with measurable reliability improvements."
    await prisma.resume.update({ where: { id: resumeIds[0] }, data: { extractedText: replacement } })
    const reindexed = await ensureResumeEvidenceIndex(resumeIds[0], replacement)
    assert.equal(reindexed.available, true)
    const chunksAfterReindex = await client.query('SELECT "chunkText" FROM "ResumeEvidenceChunk" WHERE "resumeId" = $1', [resumeIds[0]])
    assert.deepEqual(chunksAfterReindex.rows.map((row) => row.chunkText), [replacement])

    // ON DELETE CASCADE invalidates vector chunks.
    const deleteId = resumeIds.pop()
    await prisma.resume.delete({ where: { id: deleteId } })
    const chunksAfterDelete = await client.query('SELECT count(*)::int AS count FROM "ResumeEvidenceChunk" WHERE "resumeId" = $1', [deleteId])
    assert.equal(chunksAfterDelete.rows[0].count, 0)

    // Once pgvector is ready, a provider outage still falls back safely.
    const originalKey = process.env.GEMINI_API_KEY
    process.env.GEMINI_API_KEY = ""
    const fallbackResume = await prisma.resume.create({ data: { userId: user.id, fileName: "provider_fallback.pdf", fileSize: 1, fileType: "application/pdf", filePath: "/tmp/provider_fallback.pdf", extractedText: "Built synthetic fallback evidence.", skills: [] } })
    resumeIds.push(fallbackResume.id)
    const providerFallback = await ensureResumeEvidenceIndex(fallbackResume.id, fallbackResume.extractedText)
    process.env.GEMINI_API_KEY = originalKey
    assert.deepEqual(providerFallback, { available: false, candidates: [], reason: "EMBEDDING_UNAVAILABLE" })

    const kafka = results[16]
    const redis = results[17]
    console.log(JSON.stringify({ development: metrics(development), heldOut: metrics(heldOut), kafka: { inTop3: kafka.inTop3, accepted: kafka.accepted }, redis: { inTop3: redis.inTop3, accepted: redis.accepted }, cutoff: "none; top-three ranking plus evidence rule" }, null, 2))
  } finally {
    await client.end().catch(() => undefined)
    if (user) await prisma.user.delete({ where: { id: user.id } })
  }
}

run().catch((error) => { console.error(error); process.exit(1) })
