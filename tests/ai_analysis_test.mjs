import assert from "node:assert/strict"
import pg from "pg"
import { generateToken } from "../src/backend/auth/jwt.ts"
import {
  analyzeResumeWithGemini,
  setMockGeminiClient,
  resetMockGeminiClient,
  MissingApiKeyError,
  GeminiAnalysisError
} from "../src/backend/services/aiService.ts"

console.log("==================================================================")
console.log("   AI Career Copilot: Phase 5 Gemini Resume Analysis Test Suite   ")
console.log("==================================================================\n")

const { Client } = pg
const db = new Client({ connectionString: process.env.DATABASE_URL })
await db.connect()

let userAId = 0
let userBId = 0
let resumeAId = 0
let resumeBId = 0
let createdAnalysisId = 0

async function setup() {
  console.log("SETUP: Preparing isolated test users and resumes in PostgreSQL...")

  // 1. Create or retrieve User A
  const resUserA = await db.query(
    "SELECT id FROM \"User\" WHERE email = $1",
    ["test_candidate_a@example.com"]
  )
  if (resUserA.rows.length > 0) {
    userAId = resUserA.rows[0].id
  } else {
    const insertA = await db.query(
      "INSERT INTO \"User\" (name, email, password, provider) VALUES ($1, $2, $3, $4) RETURNING id",
      ["Test Candidate A", "test_candidate_a@example.com", "hashedpassword123", "local"]
    )
    userAId = insertA.rows[0].id
  }

  // 2. Create or retrieve User B
  const resUserB = await db.query(
    "SELECT id FROM \"User\" WHERE email = $1",
    ["test_candidate_b@example.com"]
  )
  if (resUserB.rows.length > 0) {
    userBId = resUserB.rows[0].id
  } else {
    const insertB = await db.query(
      "INSERT INTO \"User\" (name, email, password, provider) VALUES ($1, $2, $3, $4) RETURNING id",
      ["Test Candidate B", "test_candidate_b@example.com", "hashedpassword123", "local"]
    )
    userBId = insertB.rows[0].id
  }

  // 3. Create synthetic resume for User A
  const textA = `
    Jordan Rivera
    Senior Full Stack Engineer
    Experience: 6 years building high-throughput web applications with TypeScript, React, Next.js, and Node.js.
    Expertise: PostgreSQL database modeling, Prisma ORM, Redis caching, and Docker containerization.
    Led migration of monolithic architecture to cloud-native microservices on AWS (ECS, S3, CloudFront).
  `
  const insertResumeA = await db.query(
    `INSERT INTO "Resume" ("userId", "fileName", "fileSize", "fileType", "filePath", "extractedText", "skills", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id`,
    [
      userAId,
      "candidate_a_resume.pdf",
      1024,
      "application/pdf",
      "/storage/test/candidate_a.pdf",
      textA,
      ["TypeScript", "React", "Next.js", "Node.js", "PostgreSQL", "Docker", "AWS"]
    ]
  )
  resumeAId = insertResumeA.rows[0].id

  // 4. Create synthetic resume for User B
  const textB = `
    Taylor Vance
    Data Scientist & Machine Learning Specialist
    Experience: 4 years designing predictive models using Python, PyTorch, Scikit-learn, and SQL.
    Expertise: NLP, sentiment classification, pandas data pipelines, and Databricks.
  `
  const insertResumeB = await db.query(
    `INSERT INTO "Resume" ("userId", "fileName", "fileSize", "fileType", "filePath", "extractedText", "skills", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id`,
    [
      userBId,
      "candidate_b_resume.pdf",
      1024,
      "application/pdf",
      "/storage/test/candidate_b.pdf",
      textB,
      ["Python", "PyTorch", "SQL", "Pandas"]
    ]
  )
  resumeBId = insertResumeB.rows[0].id

  console.log(`   ✓ Created Test User A (ID: ${userAId}) with Resume (ID: ${resumeAId})`)
  console.log(`   ✓ Created Test User B (ID: ${userBId}) with Resume (ID: ${resumeBId})\n`)
}

async function runUnitTests() {
  console.log("------------------------------------------------------------------")
  console.log("PART 1: aiService.ts Unit Tests (Mocked & Validation)")
  console.log("------------------------------------------------------------------")

  // Test 1: Missing GEMINI_API_KEY detection
  console.log("Test 1: Rejection when GEMINI_API_KEY is missing...");
  resetMockGeminiClient()
  const originalApiKey = process.env.GEMINI_API_KEY
  delete process.env.GEMINI_API_KEY
  try {
    await analyzeResumeWithGemini({
      resumeText: "Valid candidate resume text exceeding twenty characters.",
      jobDescription: "Looking for an engineer with at least thirty characters of description."
    })
    assert.fail("Should have thrown MissingApiKeyError")
  } catch (err) {
    assert.ok(err instanceof MissingApiKeyError, "Must be an instance of MissingApiKeyError")
    assert.ok(err.message.includes("GEMINI_API_KEY"), "Error message must mention GEMINI_API_KEY")
    console.log("   ✓ Test 1 Passed: MissingApiKeyError correctly thrown when key is absent.")
  } finally {
    if (originalApiKey) process.env.GEMINI_API_KEY = originalApiKey
  }

  // Test 2: Insufficient resume text
  console.log("Test 2: Rejection of insufficient extracted resume text (< 20 chars)...");
  try {
    await analyzeResumeWithGemini({
      resumeText: "Too short",
      jobDescription: "Valid job description exceeding minimum thirty characters length."
    })
    assert.fail("Should have rejected short resume text")
  } catch (err) {
    assert.ok(err instanceof GeminiAnalysisError)
    assert.equal(err.statusCode, 400)
    assert.ok(err.message.includes("insufficient extracted text"))
    console.log("   ✓ Test 2 Passed: Short resume text rejected with status 400.")
  }

  // Test 3: Insufficient job description (< 30 chars)
  console.log("Test 3: Rejection of short job description (< 30 chars)...");
  try {
    await analyzeResumeWithGemini({
      resumeText: "Valid candidate resume with sufficient length for analysis.",
      jobDescription: "Too short"
    })
    assert.fail("Should have rejected short job description")
  } catch (err) {
    assert.ok(err instanceof GeminiAnalysisError)
    assert.equal(err.statusCode, 400)
    assert.ok(err.message.includes("at least 30 characters"))
    console.log("   ✓ Test 3 Passed: Short job description rejected with status 400.")
  }

  // Test 4: Excessively long job description (> 25,000 chars)
  console.log("Test 4: Rejection of oversized job description (> 25,000 chars)...");
  try {
    await analyzeResumeWithGemini({
      resumeText: "Valid candidate resume with sufficient length for analysis.",
      jobDescription: "A".repeat(25001)
    })
    assert.fail("Should have rejected oversized job description")
  } catch (err) {
    assert.ok(err instanceof GeminiAnalysisError)
    assert.equal(err.statusCode, 400)
    assert.ok(err.message.includes("maximum length"))
    console.log("   ✓ Test 4 Passed: Oversized job description rejected with status 400.")
  }

  // Test 5: Successful structured analysis with Mock Gemini Client
  console.log("Test 5: Successful structured analysis parsing & score normalization...");
  const mockSuccessPayload = {
    atsScore: 84.7, // Verify score clamping & rounding
    skillsFound: ["TypeScript", "React", "Next.js", "PostgreSQL"],
    skillsMissing: ["Kubernetes", "GraphQL"],
    strengths: [
      "Extensive full-stack TypeScript experience",
      "Demonstrated cloud infrastructure architecture on AWS"
    ],
    improvements: [
      "Provide quantified throughput or latency metrics for APIs",
      "Highlight automated CI/CD pipeline implementation"
    ],
    keywords: ["Microservices", "CI/CD", "Kubernetes"],
    recommendations: [
      "Add container orchestration details in project summaries",
      "Emphasize testing and code quality practices"
    ],
    overallAssessment: "Strong candidate for the Senior Full Stack Engineer position with minor container orchestration gaps."
  }

  setMockGeminiClient({
    models: {
      generateContent: async () => ({
        text: JSON.stringify(mockSuccessPayload)
      })
    }
  })

  const result = await analyzeResumeWithGemini({
    resumeText: "Valid candidate resume text exceeding 20 chars with TypeScript and React.",
    jobDescription: "Senior Full Stack Engineer job description requiring TypeScript, React, and Kubernetes.",
    targetRole: "Senior Full Stack Engineer"
  })

  assert.equal(result.atsScore, 85, "ATS score must be clamped & rounded to 85")
  assert.equal(result.skillsFound.length, 4)
  assert.ok(result.skillsMissing.includes("Kubernetes"))
  assert.equal(result.strengths.length, 2)
  assert.equal(result.improvements.length, 2)
  assert.equal(result.keywords.length, 3)
  assert.equal(result.recommendations.length, 2)
  assert.ok(result.overallAssessment.startsWith("Strong candidate"))
  console.log("   ✓ Test 5 Passed: Successfully parsed and clamped structured Gemini response.")

  // Test 6: Handling Markdown-wrapped JSON (```json ... ```)
  console.log("Test 6: Handling Markdown code fence wrapping in model output...");
  setMockGeminiClient({
    models: {
      generateContent: async () => ({
        text: `\`\`\`json\n${JSON.stringify(mockSuccessPayload)}\n\`\`\``
      })
    }
  })

  const wrappedResult = await analyzeResumeWithGemini({
    resumeText: "Valid candidate resume text exceeding 20 chars with TypeScript and React.",
    jobDescription: "Senior Full Stack Engineer job description requiring TypeScript, React, and Kubernetes."
  })
  assert.equal(wrappedResult.atsScore, 85)
  console.log("   ✓ Test 6 Passed: Code fences successfully stripped and parsed.")

  // Test 7: Malformed non-JSON Gemini output
  console.log("Test 7: Error handling on non-JSON model output...");
  setMockGeminiClient({
    models: {
      generateContent: async () => ({
        text: "I am unable to evaluate this resume because..."
      })
    }
  })
  try {
    await analyzeResumeWithGemini({
      resumeText: "Valid candidate resume text exceeding 20 chars with TypeScript and React.",
      jobDescription: "Senior Full Stack Engineer job description requiring TypeScript, React, and Kubernetes."
    })
    assert.fail("Should have rejected non-JSON output")
  } catch (err) {
    assert.ok(err instanceof GeminiAnalysisError)
    assert.equal(err.statusCode, 502)
    assert.ok(err.message.includes("Failed to parse Gemini output as JSON"))
    console.log("   ✓ Test 7 Passed: Non-JSON output handled with status 502.")
  }

  // Test 8: Output missing required schema properties
  console.log("Test 8: Error handling on schema mismatch / missing fields...");
  setMockGeminiClient({
    models: {
      generateContent: async () => ({
        text: JSON.stringify({ atsScore: "not-a-number" })
      })
    }
  })
  try {
    await analyzeResumeWithGemini({
      resumeText: "Valid candidate resume text exceeding 20 chars with TypeScript and React.",
      jobDescription: "Senior Full Stack Engineer job description requiring TypeScript, React, and Kubernetes."
    })
    assert.fail("Should have rejected schema mismatch")
  } catch (err) {
    assert.ok(err instanceof GeminiAnalysisError)
    assert.equal(err.statusCode, 502)
    assert.ok(err.message.includes("did not match expected structure"))
    console.log("   ✓ Test 8 Passed: Schema validation caught invalid fields.")
  }

  // Test 9: Rate limiting error translation (429)
  console.log("Test 9: Rate limit exception translation (429)...");
  setMockGeminiClient({
    models: {
      generateContent: async () => {
        throw new Error("[GoogleGenAI: 429] RESOURCE_EXHAUSTED Quota exceeded")
      }
    }
  })
  try {
    await analyzeResumeWithGemini({
      resumeText: "Valid candidate resume text exceeding 20 chars with TypeScript and React.",
      jobDescription: "Senior Full Stack Engineer job description requiring TypeScript, React, and Kubernetes."
    })
    assert.fail("Should have translated rate limit")
  } catch (err) {
    assert.ok(err instanceof GeminiAnalysisError)
    assert.equal(err.statusCode, 429)
    assert.ok(err.message.includes("rate limit exceeded"))
    console.log("   ✓ Test 9 Passed: Rate limit error correctly returned as status 429.")
  }

  // Test 10: Invalid API key exception translation (403)
  console.log("Test 10: Unauthorized/Invalid API key exception translation (403)...");
  setMockGeminiClient({
    models: {
      generateContent: async () => {
        throw new Error("[GoogleGenAI: 403] API_KEY_INVALID")
      }
    }
  })
  try {
    await analyzeResumeWithGemini({
      resumeText: "Valid candidate resume text exceeding 20 chars with TypeScript and React.",
      jobDescription: "Senior Full Stack Engineer job description requiring TypeScript, React, and Kubernetes."
    })
    assert.fail("Should have translated invalid API key")
  } catch (err) {
    assert.ok(err instanceof GeminiAnalysisError)
    assert.equal(err.statusCode, 403)
    assert.ok(err.message.includes("invalid or unauthorized"))
    console.log("   ✓ Test 10 Passed: Invalid key error correctly returned as status 403.")
  }

  // Test 10b: Model not found / unavailable error translation (404)
  console.log("Test 10b: Model not found exception translation (404)...");
  setMockGeminiClient({
    models: {
      generateContent: async () => {
        throw new Error("[GoogleGenAI: 404] NOT_FOUND models/obsolete-model is no longer available")
      }
    }
  })
  try {
    await analyzeResumeWithGemini({
      resumeText: "Valid candidate resume text exceeding 20 chars with TypeScript and React.",
      jobDescription: "Senior Full Stack Engineer job description requiring TypeScript, React, and Kubernetes."
    })
    assert.fail("Should have translated model not found")
  } catch (err) {
    assert.ok(err instanceof GeminiAnalysisError)
    assert.equal(err.statusCode, 404)
    assert.ok(err.message.includes("unavailable or no longer supported"))
    console.log("   ✓ Test 10b Passed: Model not found error correctly returned as status 404.\n")
  } finally {
    resetMockGeminiClient()
  }
}

async function runIntegrationAndRouteTests() {
  console.log("------------------------------------------------------------------")
  console.log("PART 2: Live HTTP Endpoints, Security & Database Persistence Tests")
  console.log("------------------------------------------------------------------")

  const userAToken = generateToken(userAId)
  const userBToken = generateToken(userBId)

  // Test 11: Unauthenticated request to POST /api/ai/analyze
  console.log("Test 11: Unauthenticated request rejected with HTTP 401...");
  const unauthRes = await fetch("http://localhost:3000/api/ai/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      resumeId: resumeAId,
      targetRole: "Full Stack Engineer",
      jobDescription: "Valid description exceeding 30 characters"
    })
  })
  assert.equal(unauthRes.status, 401)
  console.log("   ✓ Test 11 Passed: Unauthenticated request blocked with 401.")

  // Test 12: Invalid resume ID (non-numeric or <= 0)
  console.log("Test 12: Invalid resume ID rejected with HTTP 400...");
  const invalidIdRes = await fetch("http://localhost:3000/api/ai/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `token=${userAToken}`
    },
    body: JSON.stringify({
      resumeId: "invalid",
      targetRole: "Full Stack Engineer",
      jobDescription: "Valid description exceeding 30 characters"
    })
  })
  assert.equal(invalidIdRes.status, 400)
  console.log("   ✓ Test 12 Passed: Non-numeric resume ID rejected with 400.")

  // Test 12b: Missing targetRole rejected with HTTP 400 by Zod
  console.log("Test 12b: Missing targetRole rejected with HTTP 400...");
  const missingRoleRes = await fetch("http://localhost:3000/api/ai/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `token=${userAToken}`
    },
    body: JSON.stringify({
      resumeId: resumeAId,
      jobDescription: "Valid description exceeding 30 characters"
    })
  })
  assert.equal(missingRoleRes.status, 400)
  console.log("   ✓ Test 12b Passed: Missing targetRole rejected with 400 by Zod.")

  // Test 13: Non-existent resume ID
  console.log("Test 13: Non-existent resume ID rejected with HTTP 404...");
  const notFoundRes = await fetch("http://localhost:3000/api/ai/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `token=${userAToken}`
    },
    body: JSON.stringify({
      resumeId: 9999999,
      targetRole: "Full Stack Engineer",
      jobDescription: "Valid description exceeding 30 characters"
    })
  })
  assert.equal(notFoundRes.status, 404)
  console.log("   ✓ Test 13 Passed: Non-existent resume ID returned 404.")

  // Test 14: Cross-user access: User A attempting to analyze User B's resume
  console.log("Test 14: Cross-user access rejected with HTTP 403 Forbidden...");
  const forbiddenRes = await fetch("http://localhost:3000/api/ai/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `token=${userAToken}`
    },
    body: JSON.stringify({
      resumeId: resumeBId, // Belongs to User B!
      targetRole: "Data Scientist",
      jobDescription: "Valid description exceeding 30 characters required."
    })
  })
  assert.equal(forbiddenRes.status, 403)
  const forbiddenData = await forbiddenRes.json()
  assert.ok(forbiddenData.message.includes("not authorized to analyze"))
  console.log("   ✓ Test 14 Passed: Cross-user resume access blocked with 403.")

  // Test 15: Missing API key handling at API endpoint level
  console.log("Test 15: Missing API key handling (503 Service Unavailable)...");
  const missingKeyRes = await fetch("http://localhost:3000/api/ai/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `token=${userAToken}`
    },
    body: JSON.stringify({
      resumeId: resumeAId,
      targetRole: "Full Stack Engineer",
      jobDescription: "Looking for an experienced engineer with TypeScript and React background."
    })
  })
  // If GEMINI_API_KEY is not set in .env, should return 503 MISSING_API_KEY
  if (!process.env.GEMINI_API_KEY) {
    assert.equal(missingKeyRes.status, 503)
    const missingKeyData = await missingKeyRes.json()
    assert.equal(missingKeyData.code, "MISSING_API_KEY")
    console.log("   ✓ Test 15 Passed: Missing API key correctly returned HTTP 503 with code MISSING_API_KEY.")
  } else {
    console.log("   ℹ Test 15 Skipped: GEMINI_API_KEY is present in environment.")
  }

  // Test 16: Valid resume analysis with mock Gemini & DB persistence
  console.log("Test 16: Valid resume analysis with mock Gemini & PostgreSQL persistence...");
  const validRes = await fetch("http://localhost:3000/api/ai/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-test-mock-gemini": "true",
      Cookie: `token=${userAToken}`
    },
    body: JSON.stringify({
      resumeId: resumeAId,
      targetRole: "Staff Software Engineer",
      jobDescription: "Looking for an experienced Staff Engineer with deep TypeScript, React, Next.js, and AWS microservices background."
    })
  })

  assert.equal(validRes.status, 200, "Must return HTTP 200 OK")
  const validData = await validRes.json()
  assert.equal(validData.success, true)
  assert.ok(validData.analysis.id > 0)
  assert.equal(validData.analysis.atsScore, 88)
  assert.equal(validData.analysis.targetRole, "Staff Software Engineer")
  assert.equal(validData.analysis.resumeFileName, "candidate_a_resume.pdf")
  assert.ok(validData.analysis.skillsFound.includes("TypeScript"))
  assert.ok(validData.analysis.skillsMissing.includes("GraphQL"))
  assert.ok(validData.analysis.recommendations.length > 0)
  assert.ok(validData.analysis.overallAssessment.includes("Strong candidate"))

  createdAnalysisId = validData.analysis.id
  console.log(`   ✓ Test 16 Passed: Analysis succeeded and saved with DB ID: ${createdAnalysisId}`)

  // Test 17: Verify direct database persistence in PostgreSQL
  console.log("Test 17: Verifying saved analysis in PostgreSQL...");
  const dbRes = await db.query(
    "SELECT * FROM \"ResumeAnalysis\" WHERE id = $1",
    [createdAnalysisId]
  )
  assert.equal(dbRes.rows.length, 1, "Record must exist in PostgreSQL")
  const dbRecord = dbRes.rows[0]
  assert.equal(dbRecord.userId, userAId)
  assert.equal(dbRecord.resumeId, resumeAId)
  assert.equal(dbRecord.atsScore, 88)
  assert.equal(dbRecord.targetRole, "Staff Software Engineer")
  assert.ok(dbRecord.skillsFound.includes("TypeScript"))
  assert.ok(dbRecord.rawAnalysis?.includes("Strong candidate"))
  console.log("   ✓ Test 17 Passed: PostgreSQL record matches all analysis fields.")

  // Test 18: User A fetching analysis history via GET /api/ai/analyses
  console.log("Test 18: User A fetching analysis history via GET /api/ai/analyses...");
  const listResUserA = await fetch("http://localhost:3000/api/ai/analyses", {
    headers: { Cookie: `token=${userAToken}` }
  })
  assert.equal(listResUserA.status, 200)
  const listDataUserA = await listResUserA.json()
  assert.equal(listDataUserA.success, true)
  assert.ok(listDataUserA.analyses.some((a) => a.id === createdAnalysisId))
  console.log(`   ✓ Test 18 Passed: User A history contains ${listDataUserA.analyses.length} analysis record(s).`)

  // Test 18b: User A fetching analysis history via GET /api/ai/analyze (alias endpoint)
  console.log("Test 18b: User A fetching history via GET /api/ai/analyze...");
  const aliasRes = await fetch("http://localhost:3000/api/ai/analyze", {
    headers: { Cookie: `token=${userAToken}` }
  })
  assert.equal(aliasRes.status, 200)
  const aliasData = await aliasRes.json()
  assert.equal(aliasData.success, true)
  assert.ok(aliasData.analyses.some((a) => a.id === createdAnalysisId))
  console.log("   ✓ Test 18b Passed: GET /api/ai/analyze returned analysis history.")

  // Test 19: User Isolation in history - User B does NOT see User A's analyses
  console.log("Test 19: User B history does not leak User A's analysis...");
  const listResUserB = await fetch("http://localhost:3000/api/ai/analyses", {
    headers: { Cookie: `token=${userBToken}` }
  })
  assert.equal(listResUserB.status, 200)
  const listDataUserB = await listResUserB.json()
  assert.equal(listDataUserB.success, true)
  assert.ok(!listDataUserB.analyses.some((a) => a.id === createdAnalysisId), "User B must not see User A's analysis")
  console.log("   ✓ Test 19 Passed: Strict user isolation confirmed across analysis history.")

  // Test 20: User B attempting to fetch User A's analysis by ID
  console.log("Test 20: User B cannot access User A's analysis via GET /api/ai/analyses/[id]...");
  const getResUserB = await fetch(`http://localhost:3000/api/ai/analyses/${createdAnalysisId}`, {
    headers: { Cookie: `token=${userBToken}` }
  })
  assert.equal(getResUserB.status, 403, "User B must receive HTTP 403 Forbidden")
  console.log("   ✓ Test 20 Passed: Cross-user analysis view blocked with 403.")

  // Test 21: User A successfully retrieves their analysis by ID
  console.log("Test 21: User A retrieves their analysis via GET /api/ai/analyses/[id]...");
  const getResUserA = await fetch(`http://localhost:3000/api/ai/analyses/${createdAnalysisId}`, {
    headers: { Cookie: `token=${userAToken}` }
  })
  assert.equal(getResUserA.status, 200)
  const getDataUserA = await getResUserA.json()
  assert.equal(getDataUserA.analysis.id, createdAnalysisId)
  assert.equal(getDataUserA.analysis.atsScore, 88)
  console.log("   ✓ Test 21 Passed: Direct analysis retrieval verified.")

  // Test 22: Delete analysis
  console.log("Test 22: Deleting analysis record via DELETE /api/ai/analyses/[id]...");
  const delRes = await fetch(`http://localhost:3000/api/ai/analyses/${createdAnalysisId}`, {
    method: "DELETE",
    headers: { Cookie: `token=${userAToken}` }
  })
  assert.equal(delRes.status, 200)
  const delCheck = await db.query(
    "SELECT id FROM \"ResumeAnalysis\" WHERE id = $1",
    [createdAnalysisId]
  )
  assert.equal(delCheck.rows.length, 0, "Record must be deleted from PostgreSQL")
  console.log("   ✓ Test 22 Passed: Analysis successfully deleted from database.\n")
}

async function runRealGeminiIntegrationTest() {
  console.log("------------------------------------------------------------------")
  console.log("PART 3: Real Gemini API Live Integration Test")
  console.log("------------------------------------------------------------------")

  if (!process.env.GEMINI_API_KEY) {
    console.log("   ℹ Skipped: GEMINI_API_KEY is not configured in the environment.\n")
    return
  }

  console.log("Test 23: Executing genuine live API request against Google Gemini...")
  resetMockGeminiClient()

  const liveResult = await analyzeResumeWithGemini({
    resumeText: "Jordan Rivera, Senior Full Stack Engineer. 6 years experience with TypeScript, React, Next.js, Node.js, PostgreSQL, Docker, AWS.",
    jobDescription: "Looking for an experienced Senior Full Stack Engineer with strong TypeScript, React, Next.js, and cloud microservices experience. GraphQL and Kubernetes are preferred.",
    targetRole: "Senior Full Stack Engineer"
  })

  assert.ok(typeof liveResult.atsScore === "number", "Live ATS score must be a number")
  assert.ok(liveResult.atsScore >= 0 && liveResult.atsScore <= 100, "Live ATS score must be 0-100")
  assert.ok(Array.isArray(liveResult.skillsFound) && liveResult.skillsFound.length > 0, "Live skillsFound must be non-empty array")
  assert.ok(Array.isArray(liveResult.strengths) && liveResult.strengths.length > 0, "Live strengths must be non-empty array")
  assert.ok(typeof liveResult.summary === "string" && liveResult.summary.length > 20, "Live summary must be detailed string")
  assert.ok(Array.isArray(liveResult.recommendations) && liveResult.recommendations.length > 0, "Live recommendations must be non-empty array")

  console.log(`   ✓ Test 23 Passed: Real Gemini live API returned genuine evaluation with ATS Score: ${liveResult.atsScore}%`)
  console.log(`     Identified Skills: ${liveResult.skillsFound.slice(0, 4).join(", ")}`)
  console.log(`     Summary: ${liveResult.summary.slice(0, 100)}...\n`)
}

async function cleanup() {
  console.log("CLEANUP: Cleaning up synthetic test records...");
  resetMockGeminiClient()
  if (resumeAId) {
    await db.query("DELETE FROM \"Resume\" WHERE id = $1", [resumeAId]).catch(() => {})
  }
  if (resumeBId) {
    await db.query("DELETE FROM \"Resume\" WHERE id = $1", [resumeBId]).catch(() => {})
  }
  if (userAId) {
    await db.query("DELETE FROM \"User\" WHERE id = $1", [userAId]).catch(() => {})
  }
  if (userBId) {
    await db.query("DELETE FROM \"User\" WHERE id = $1", [userBId]).catch(() => {})
  }
  console.log("   ✓ Test cleanup complete.\n")
}

try {
  await setup()
  await runUnitTests()
  await runIntegrationAndRouteTests()
  await runRealGeminiIntegrationTest()
  console.log("==================================================================")
  console.log("  ALL UNIT, INTEGRATION, AND REAL GEMINI API TESTS PASSED!        ")
  console.log("==================================================================")
} catch (error) {
  console.error("TEST FAILED:", error)
  process.exitCode = 1
} finally {
  await cleanup()
  await db.end()
  process.exit(process.exitCode || 0)
}
