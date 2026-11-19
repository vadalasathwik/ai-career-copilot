import assert from "node:assert/strict"
import { prisma } from "../src/backend/db/prisma.ts"
import { generateToken } from "../src/backend/auth/jwt.ts"

const BASE_URL = "http://localhost:3000"

async function runInterviewPrepTests() {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`
  let owner
  let otherUser
  let evidenceResume
  let emptyResume
  let mismatchResume

  try {
    owner = await prisma.user.create({ data: { name: "Interview Owner", email: `interview_owner_${suffix}@example.com`, provider: "local" } })
    otherUser = await prisma.user.create({ data: { name: "Interview Other", email: `interview_other_${suffix}@example.com`, provider: "local" } })
    const ownerToken = generateToken(owner.id)
    const otherToken = generateToken(otherUser.id)
    const runPrep = (resumeId, jobDescription, scenario = "true") => fetch(`${BASE_URL}/api/interview-prep`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `token=${ownerToken}`, "x-test-mock-interview": scenario },
      body: JSON.stringify({ resumeId, jobDescription })
    })
    evidenceResume = await prisma.resume.create({
      data: {
        userId: owner.id, fileName: "evidence.pdf", fileSize: 1, fileType: "application/pdf", filePath: "/tmp/evidence.pdf",
        extractedText: "Built TypeScript services and React dashboards for customer analytics. Led Docker deployment automation. Operated Kubernetes clusters for production workloads. Designed PostgreSQL schemas for reporting. Maintained JavaScript user interfaces.",
        skills: ["TypeScript", "React", "Docker", "Kubernetes", "PostgreSQL", "JavaScript"]
      }
    })
    emptyResume = await prisma.resume.create({
      data: { userId: owner.id, fileName: "empty.pdf", fileSize: 1, fileType: "application/pdf", filePath: "/tmp/empty.pdf", extractedText: "", skills: [] }
    })
    mismatchResume = await prisma.resume.create({
      data: { userId: owner.id, fileName: "mismatch.pdf", fileSize: 1, fileType: "application/pdf", filePath: "/tmp/mismatch.pdf", extractedText: "Maintained MySQL data stores. Coordinated generic orchestration work across teams.", skills: ["MySQL"] }
    })

    const description = "Required: TypeScript and React experience. Must have TypeScript, React, and Kubernetes production experience."
    const unauth = await fetch(`${BASE_URL}/api/interview-prep`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resumeId: evidenceResume.id, jobDescription: description }) })
    assert.equal(unauth.status, 401)

    const forbidden = await fetch(`${BASE_URL}/api/interview-prep`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: `token=${otherToken}` }, body: JSON.stringify({ resumeId: evidenceResume.id, jobDescription: description }) })
    assert.equal(forbidden.status, 403)

    const missingText = await fetch(`${BASE_URL}/api/interview-prep`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: `token=${ownerToken}` }, body: JSON.stringify({ resumeId: emptyResume.id, jobDescription: description }) })
    assert.equal(missingText.status, 400)

    const matched = await runPrep(evidenceResume.id, description)
    assert.equal(matched.status, 200)
    const data = await matched.json()
    assert.equal(data.success, true)
    assert.equal(data.retrieval.vectorAvailable, false, "Development fallback must be used when pgvector is unavailable")
    assert.equal(data.retrieval.vectorFallbackReason, "PGVECTOR_UNAVAILABLE")
    assert.equal(data.questions[0].questionGeneration, "gemini")
    assert.ok(data.questions.length <= 5)
    const evidence = data.questions.find((question) => question.evidenceStatus === "evidence")
    const gap = data.questions.find((question) => question.evidenceStatus === "gap" && question.jobRequirement.includes("Kubernetes"))
    assert.ok(evidence, "Expected a retrieval-backed question")
    assert.equal(evidence.resumeExcerpt, "Built TypeScript services and React dashboards for customer analytics.")
    assert.equal(evidence.evidenceMethod, "keyword")
    assert.equal(data.retrieval.keywordFallbackUsed, true)
    assert.ok(gap, "Expected a partially matched requirement to be a practice gap")
    assert.equal(gap.resumeExcerpt, null)

    const javaOnly = await runPrep(evidenceResume.id, "Required Java experience for your role.")
    assert.equal(javaOnly.status, 200)
    const javaData = await javaOnly.json()
    assert.equal(javaData.questions[0].evidenceStatus, "gap", "JavaScript must not count as evidence for Java")
    assert.equal(javaData.questions[0].resumeExcerpt, null)

    const dockerPunctuation = await runPrep(evidenceResume.id, "Required: Docker. Please prepare for your role.")
    assert.equal(dockerPunctuation.status, 200)
    const dockerData = await dockerPunctuation.json()
    assert.equal(dockerData.questions[0].evidenceStatus, "evidence", "Terminal punctuation must not prevent Docker evidence retrieval")
    assert.equal(dockerData.questions[0].resumeExcerpt, "Led Docker deployment automation.")

    const semantic = await runPrep(evidenceResume.id, "Required: container orchestration experience for your role.")
    assert.equal(semantic.status, 200)
    const semanticData = await semantic.json()
    assert.equal(semanticData.questions[0].evidenceMethod, "semantic", "Kubernetes must support the container-orchestration paraphrase")
    assert.equal(semanticData.questions[0].resumeExcerpt, "Operated Kubernetes clusters for production workloads.")
    assert.equal(semanticData.retrieval.keywordFallbackUsed, false)

    const alias = await runPrep(evidenceResume.id, "Required: K8s experience for your role.")
    const aliasData = await alias.json()
    assert.equal(alias.status, 200)
    assert.equal(aliasData.questions[0].evidenceMethod, "semantic", "K8s and Kubernetes must remain explicit aliases")
    assert.equal(aliasData.questions[0].resumeExcerpt, "Operated Kubernetes clusters for production workloads.")

    const relational = await runPrep(evidenceResume.id, "Required: relational database experience for your role.")
    const relationalData = await relational.json()
    assert.equal(relational.status, 200)
    assert.equal(relationalData.questions[0].evidenceMethod, "semantic", "PostgreSQL must support the broader relational-database requirement")
    assert.equal(relationalData.questions[0].resumeExcerpt, "Designed PostgreSQL schemas for reporting.")

    const postgresOnly = await runPrep(mismatchResume.id, "Required: PostgreSQL experience for your role.")
    const postgresOnlyData = await postgresOnly.json()
    assert.equal(postgresOnly.status, 200)
    assert.equal(postgresOnlyData.questions[0].evidenceStatus, "gap", "MySQL must not satisfy a PostgreSQL requirement")

    const kubernetesOnly = await runPrep(mismatchResume.id, "Required: Kubernetes experience for your role.")

    for (const scenario of ["wrong-id", "failure", "timeout"]) {
      const invalidCitation = await runPrep(evidenceResume.id, "Required: Docker experience for your role.", scenario)
      const invalidCitationData = await invalidCitation.json()
      assert.equal(invalidCitation.status, 200)
      assert.equal(invalidCitationData.questions[0].questionGeneration, "template", `${scenario} must fall back to a template`)
      assert.equal(invalidCitationData.retrieval.questionGenerationFallbackUsed, true)
    }
    const wrongRequirement = await runPrep(
      evidenceResume.id,
      "Required: Docker experience for your role. Required: TypeScript experience for your role.",
      "wrong-requirement-id"
    )
    const wrongRequirementData = await wrongRequirement.json()
    assert.equal(wrongRequirement.status, 200)
    assert.ok(wrongRequirementData.questions.every((question) => question.questionGeneration === "template"), "A citation from another requirement must fall back to templates")
    assert.equal(wrongRequirementData.retrieval.questionGenerationFallbackUsed, true)
    const gapCitation = await runPrep(mismatchResume.id, "Required: Kubernetes experience for your role.", "no-evidence-id")
    const gapCitationData = await gapCitation.json()
    assert.equal(gapCitationData.questions[0].questionGeneration, "template", "A gap must not accept an invented citation")
    const kubernetesOnlyData = await kubernetesOnly.json()
    assert.equal(kubernetesOnly.status, 200)
    assert.equal(kubernetesOnlyData.questions[0].evidenceStatus, "gap", "Generic orchestration must not satisfy a Kubernetes requirement")
    console.log("✓ Interview prep: evidence, partial/gap, missing text, and unauthorized access passed.")
  } finally {
    if (evidenceResume) await prisma.resume.delete({ where: { id: evidenceResume.id } })
    if (emptyResume) await prisma.resume.delete({ where: { id: emptyResume.id } })
    if (mismatchResume) await prisma.resume.delete({ where: { id: mismatchResume.id } })
    if (owner) await prisma.user.delete({ where: { id: owner.id } })
    if (otherUser) await prisma.user.delete({ where: { id: otherUser.id } })
  }
}

runInterviewPrepTests().catch((error) => { console.error(error); process.exit(1) })
