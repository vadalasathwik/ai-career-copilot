import assert from "node:assert/strict"
import fs from "node:fs"
import bcrypt from "bcryptjs"
import { prisma } from "../src/backend/db/prisma.ts"

const BASE_URL = "http://localhost:3000"

async function runResumeUploadRegression() {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`
  let user
  let resumeId

  try {
    const email = `upload_regression_${suffix}@example.com`
    const password = "SyntheticPassword123!"
    user = await prisma.user.create({
      data: { name: "Upload Regression User", email, password: await bcrypt.hash(password, 10), provider: "local" }
    })
    const login = await fetch(`${BASE_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    })
    assert.equal(login.status, 200, "Synthetic local user must be able to sign in")
    const cookie = login.headers.get("set-cookie")?.match(/token=[^;]+/)?.[0]
    assert.ok(cookie, "Sign-in must establish the session cookie")
    const form = new FormData()
    form.append(
      "resume",
      new Blob([fs.readFileSync("tests/fixtures/known_good_resume.pdf")], { type: "application/pdf" }),
      "synthetic_text_resume.pdf"
    )

    const upload = await fetch(`${BASE_URL}/api/resumes/upload`, {
      method: "POST",
      headers: { Cookie: cookie },
      body: form
    })
    const uploadData = await upload.json()
    assert.equal(upload.status, 201, "Workspace form field must upload a valid PDF successfully")
    assert.equal(uploadData.success, true)
    resumeId = uploadData.resume.id

    const resumes = await fetch(`${BASE_URL}/api/resumes`, { headers: { Cookie: cookie } })
    const resumesData = await resumes.json()
    assert.equal(resumes.status, 200)
    assert.ok(resumesData.resumes.some((resume) => resume.id === resumeId), "Uploaded resume must be visible in the workspace list")

    const invalid = new FormData()
    invalid.append("resume", new Blob(["not a PDF"], { type: "application/pdf" }), "invalid.pdf")
    const invalidUpload = await fetch(`${BASE_URL}/api/resumes/upload`, {
      method: "POST",
      headers: { Cookie: cookie },
      body: invalid
    })
    assert.equal(invalidUpload.status, 400, "Invalid PDF content must remain a client validation error")

    const quality = await fetch(`${BASE_URL}/api/ai/quality`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie, "x-test-mock-gemini": "true" },
      body: JSON.stringify({ resumeId })
    })
    assert.equal(quality.status, 200, "Newly uploaded resume must support quality review")

    const jobDescription = "Required: React, TypeScript, and Docker experience for a full stack engineering role."
    const jobMatch = await fetch(`${BASE_URL}/api/ai/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie, "x-test-mock-gemini": "true" },
      body: JSON.stringify({ resumeId, targetRole: "Full Stack Engineer", jobDescription })
    })
    assert.equal(jobMatch.status, 200, "Newly uploaded resume must support Job Match")

    const prep = await fetch(`${BASE_URL}/api/interview-prep`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ resumeId, jobDescription })
    })
    const prepData = await prep.json()
    assert.equal(prep.status, 200, "Newly uploaded resume must support Interview Prep")
    assert.ok(Array.isArray(prepData.questions))
    console.log("✓ Sign-in, workspace upload field, 201 persistence, quality review, Job Match, Interview Prep, and invalid-file 400 behavior passed.")
  } finally {
    if (resumeId) await prisma.resume.delete({ where: { id: resumeId } })
    if (user) await prisma.user.delete({ where: { id: user.id } })
  }
}

runResumeUploadRegression().catch((error) => { console.error(error); process.exit(1) })
