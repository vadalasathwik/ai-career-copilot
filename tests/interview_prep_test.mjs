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

  try {
    owner = await prisma.user.create({ data: { name: "Interview Owner", email: `interview_owner_${suffix}@example.com`, provider: "local" } })
    otherUser = await prisma.user.create({ data: { name: "Interview Other", email: `interview_other_${suffix}@example.com`, provider: "local" } })
    const ownerToken = generateToken(owner.id)
    const otherToken = generateToken(otherUser.id)
    evidenceResume = await prisma.resume.create({
      data: {
        userId: owner.id, fileName: "evidence.pdf", fileSize: 1, fileType: "application/pdf", filePath: "/tmp/evidence.pdf",
        extractedText: "Built TypeScript services and React dashboards for customer analytics. Led Docker deployment automation. Maintained JavaScript user interfaces.",
        skills: ["TypeScript", "React", "Docker", "JavaScript"]
      }
    })
    emptyResume = await prisma.resume.create({
      data: { userId: owner.id, fileName: "empty.pdf", fileSize: 1, fileType: "application/pdf", filePath: "/tmp/empty.pdf", extractedText: "", skills: [] }
    })

    const description = "Required: TypeScript and React experience. Must have TypeScript, React, and Kubernetes production experience."
    const unauth = await fetch(`${BASE_URL}/api/interview-prep`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resumeId: evidenceResume.id, jobDescription: description }) })
    assert.equal(unauth.status, 401)

    const forbidden = await fetch(`${BASE_URL}/api/interview-prep`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: `token=${otherToken}` }, body: JSON.stringify({ resumeId: evidenceResume.id, jobDescription: description }) })
    assert.equal(forbidden.status, 403)

    const missingText = await fetch(`${BASE_URL}/api/interview-prep`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: `token=${ownerToken}` }, body: JSON.stringify({ resumeId: emptyResume.id, jobDescription: description }) })
    assert.equal(missingText.status, 400)

    const matched = await fetch(`${BASE_URL}/api/interview-prep`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: `token=${ownerToken}` }, body: JSON.stringify({ resumeId: evidenceResume.id, jobDescription: description }) })
    assert.equal(matched.status, 200)
    const data = await matched.json()
    assert.equal(data.success, true)
    assert.ok(data.questions.length <= 5)
    const evidence = data.questions.find((question) => question.evidenceStatus === "evidence")
    const gap = data.questions.find((question) => question.evidenceStatus === "gap" && question.jobRequirement.includes("Kubernetes"))
    assert.ok(evidence, "Expected a retrieval-backed question")
    assert.equal(evidence.resumeExcerpt, "Built TypeScript services and React dashboards for customer analytics.")
    assert.ok(gap, "Expected a partially matched requirement to be a practice gap")
    assert.equal(gap.resumeExcerpt, null)

    const javaOnly = await fetch(`${BASE_URL}/api/interview-prep`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: `token=${ownerToken}` }, body: JSON.stringify({ resumeId: evidenceResume.id, jobDescription: "Required Java experience for your role." }) })
    assert.equal(javaOnly.status, 200)
    const javaData = await javaOnly.json()
    assert.equal(javaData.questions[0].evidenceStatus, "gap", "JavaScript must not count as evidence for Java")
    assert.equal(javaData.questions[0].resumeExcerpt, null)
    console.log("✓ Interview prep: evidence, partial/gap, missing text, and unauthorized access passed.")
  } finally {
    if (evidenceResume) await prisma.resume.delete({ where: { id: evidenceResume.id } })
    if (emptyResume) await prisma.resume.delete({ where: { id: emptyResume.id } })
    if (owner) await prisma.user.delete({ where: { id: owner.id } })
    if (otherUser) await prisma.user.delete({ where: { id: otherUser.id } })
  }
}

runInterviewPrepTests().catch((error) => { console.error(error); process.exit(1) })
