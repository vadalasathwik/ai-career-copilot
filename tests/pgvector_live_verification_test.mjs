import assert from "node:assert/strict"
import pg from "pg"
import { getGeminiEmbeddingClient } from "../src/backend/services/aiService.ts"
import { prisma } from "../src/backend/db/prisma.ts"
import { applyVectorEvidence, createInterviewPracticeQuestions, ruleBasedCandidates, VECTOR_EVIDENCE_MIN_SIMILARITY } from "../src/backend/services/interviewPrepService.ts"
import { EMBEDDING_MODEL, ensureResumeEvidenceIndex, retrieveResumeEvidenceCandidates } from "../src/backend/services/resumeEvidenceService.ts"

const CASES = [
  ["TypeScript", "Built TypeScript services.", true, "positive"], ["Docker", "Automated deployments with Docker.", true, "positive"], ["K8s", "Operated Kubernetes clusters.", true, "positive"], ["container orchestration", "Operated Kubernetes clusters.", true, "positive"], ["relational database", "Designed PostgreSQL schemas.", true, "positive"], ["relational database", "Maintained MySQL data stores.", true, "positive"], ["automated deployment", "Implemented CI/CD pipelines.", true, "positive"], ["React", "Built React dashboards.", true, "positive"], ["Node.js", "Maintained Node.js APIs.", true, "positive"], ["Python", "Automated reports with Python.", true, "positive"],
  ["Java", "Maintained JavaScript interfaces.", false, "gaps"], ["PostgreSQL", "Maintained MySQL data stores.", false, "gaps"], ["Kubernetes", "Coordinated generic orchestration work.", false, "gaps"], ["TypeScript and React", "Built TypeScript services.", false, "gaps"], ["Docker and Kubernetes", "Automated deployments with Docker.", false, "gaps"], ["AWS", "Deployed services on Azure.", false, "gaps"],
  ["event streaming platform", "Built Kafka event pipelines.", true, "heldPositive"], ["distributed cache", "Improved Redis caching.", true, "heldPositive"], ["Kubernetes production", "Operated Kubernetes clusters.", false, "heldGaps"], ["PostgreSQL performance", "Designed PostgreSQL schemas.", false, "heldGaps"]
].map(([requirement, target, expected, group]) => ({ requirement, target, expected, group }))

function distractors(group) {
  return [`Prepared project documentation and status updates for ${group}.`, `Collaborated with stakeholders on planning and delivery for ${group}.`, `Improved monitoring dashboards and operational reporting for ${group}.`, `Supported customer onboarding and training materials for ${group}.`]
}

function metrics(results, method) {
  const positives = results.filter((result) => result.expected)
  const gaps = results.filter((result) => !result.expected)
  return {
    candidateRecallAt3: `${positives.filter((result) => result[method].inTop3).length}/${positives.length}`,
    acceptedCitationRecall: `${positives.filter((result) => result[method].accepted).length}/${positives.length}`,
    falsePositiveRate: `${gaps.filter((result) => result[method].accepted).length}/${gaps.length}`
  }
}

async function run() {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`
  const { Client } = pg
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  let user
  try {
    await client.connect()
    user = await prisma.user.create({ data: { name: "Vector Evaluation", email: `vector_eval_${suffix}@example.com`, provider: "local" } })
    const groups = new Map()
    for (const group of new Set(CASES.map((item) => item.group))) {
      const groupCases = CASES.filter((item) => item.group === group)
      const excerpts = [...distractors(group), ...groupCases.map((item) => item.target)]
      const resume = await prisma.resume.create({ data: { userId: user.id, fileName: `${group}.pdf`, fileSize: 1, fileType: "application/pdf", filePath: `/tmp/${group}.pdf`, extractedText: excerpts.join("\n"), skills: [] } })
      const indexed = await ensureResumeEvidenceIndex(resume.id, resume.extractedText)
      assert.equal(indexed.available, true, `${group} must index with live embeddings`)
      groups.set(group, { resume, excerpts })
    }

    const requirements = CASES.map((item) => `Required: ${item.requirement} experience for this role.`)
    const response = await getGeminiEmbeddingClient().models.embedContent({ model: "gemini-embedding-001", contents: requirements, config: { outputDimensionality: 768 } })
    const embeddings = response.embeddings?.map((embedding) => embedding.values ?? []) ?? []
    assert.equal(embeddings.length, CASES.length)
    const results = []
    for (let index = 0; index < CASES.length; index += 1) {
      const testCase = CASES[index]
      const { resume, excerpts } = groups.get(testCase.group)
      const vector = `[${embeddings[index].join(",")}]`
      const rows = await client.query('SELECT "chunkText", 1 - ("embedding" <=> $3::vector) AS similarity FROM "ResumeEvidenceChunk" WHERE "resumeId" = $1 AND "embeddingModel" = $2 ORDER BY "embedding" <=> $3::vector LIMIT 3', [resume.id, EMBEDDING_MODEL, vector])
      const candidates = rows.rows.map((row) => ({ text: row.chunkText, similarity: Number(row.similarity) }))
      const question = createInterviewPracticeQuestions(requirements[index], resume.extractedText)[0]
      const rules = ruleBasedCandidates(question.jobRequirement, excerpts)
      const vectorQuestion = applyVectorEvidence(question, candidates)
      results.push({ ...testCase, keyword: { inTop3: rules.keyword.includes(testCase.target), accepted: rules.keyword.includes(testCase.target) }, synonym: { inTop3: rules.synonym.includes(testCase.target), accepted: rules.synonym.includes(testCase.target) }, vector: { inTop3: candidates.some((candidate) => candidate.text === testCase.target), accepted: vectorQuestion.evidenceMethod === "vector" } })
    }
    const development = results.slice(0, 16)
    const heldOut = results.slice(16)
    for (const method of ["keyword", "synonym", "vector"]) {
      assert.equal(metrics(development, method).falsePositiveRate, "0/6")
      assert.equal(metrics(heldOut, method).falsePositiveRate, "0/2")
    }
    const positiveGroup = groups.get("positive")
    const isolation = await retrieveResumeEvidenceCandidates(positiveGroup.resume.id, "PostgreSQL experience")
    assert.ok(isolation.candidates.every((candidate) => positiveGroup.excerpts.includes(candidate.text)), "Retrieval must remain resume-scoped")
    const updatedText = "Built TypeScript services with measurable reliability improvements."
    await prisma.resume.update({ where: { id: positiveGroup.resume.id }, data: { extractedText: updatedText } })
    assert.equal((await ensureResumeEvidenceIndex(positiveGroup.resume.id, updatedText)).available, true)
    assert.deepEqual((await client.query('SELECT "chunkText" FROM "ResumeEvidenceChunk" WHERE "resumeId" = $1', [positiveGroup.resume.id])).rows.map((row) => row.chunkText), [updatedText])
    const deleteId = groups.get("heldGaps").resume.id
    await prisma.resume.delete({ where: { id: deleteId } })
    assert.equal((await client.query('SELECT count(*)::int AS count FROM "ResumeEvidenceChunk" WHERE "resumeId" = $1', [deleteId])).rows[0].count, 0)
    const originalKey = process.env.GEMINI_API_KEY
    process.env.GEMINI_API_KEY = ""
    const fallback = await ensureResumeEvidenceIndex(groups.get("gaps").resume.id, "Synthetic provider fallback chunk.")
    process.env.GEMINI_API_KEY = originalKey
    assert.equal(fallback.reason, "EMBEDDING_UNAVAILABLE")
    console.log(JSON.stringify({ development: Object.fromEntries(["keyword", "synonym", "vector"].map((method) => [method, metrics(development, method)])), heldOut: Object.fromEntries(["keyword", "synonym", "vector"].map((method) => [method, metrics(heldOut, method)])), kafka: results[16].vector, redis: results[17].vector, cutoff: VECTOR_EVIDENCE_MIN_SIMILARITY }, null, 2))
  } finally {
    await client.end().catch(() => undefined)
    if (user) await prisma.user.delete({ where: { id: user.id } })
  }
}

run().catch((error) => { console.error(error); process.exit(1) })
