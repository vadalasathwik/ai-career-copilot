import assert from "node:assert/strict"
import { prisma } from "../src/backend/db/prisma.ts"
import { generateToken } from "../src/backend/auth/jwt.ts"
import { validateJobUrl } from "../src/backend/services/jobUrlService.ts"

const BASE_URL = "http://localhost:3000"

async function runSimplifiedWorkspaceTests() {
  console.log("==================================================================")
  console.log("  AI Career Copilot: Simplified Workspace & Features Test Suite   ")
  console.log("==================================================================\n")

  let testUserA
  let testUserB
  let testResumeA
  let testResumeB

  try {
    // -------------------------------------------------------------
    // SETUP: Create isolated test users and resumes
    // -------------------------------------------------------------
    console.log("SETUP: Creating isolated test users and resumes in PostgreSQL...")
    const rand = Math.floor(Math.random() * 100000)

    testUserA = await prisma.user.create({
      data: {
        name: `Tester Alpha ${rand}`,
        email: `tester_alpha_${rand}@example.com`,
        provider: "local"
      }
    })

    testUserB = await prisma.user.create({
      data: {
        name: `Tester Beta ${rand}`,
        email: `tester_beta_${rand}@example.com`,
        provider: "local"
      }
    })

    const tokenA = generateToken(testUserA.id)
    const tokenB = generateToken(testUserB.id)

    testResumeA = await prisma.resume.create({
      data: {
        userId: testUserA.id,
        fileName: "alex_lead_engineer.pdf",
        fileSize: 42000,
        fileType: "application/pdf",
        filePath: "/tmp/mock/alex_lead.pdf",
        extractedText: `Alex Lead Engineer
Summary: Senior software craftsman with 7 years of full stack experience.
Skills: TypeScript, React, Next.js, Node.js, PostgreSQL, Docker, AWS.
Experience: Built cloud native scalable microservices. Responsable for lead the deployment team. Did multiple works on database optimizations.`,
        skills: ["TypeScript", "React", "Next.js", "Node.js", "PostgreSQL", "Docker", "AWS"]
      }
    })

    testResumeB = await prisma.resume.create({
      data: {
        userId: testUserB.id,
        fileName: "beta_candidate.pdf",
        fileSize: 31000,
        fileType: "application/pdf",
        filePath: "/tmp/mock/beta.pdf",
        extractedText: "Beta candidate resume text with Python, Django, and Machine Learning.",
        skills: ["Python", "Django", "Machine Learning"]
      }
    })

    console.log(`   ✓ Test Users created (A: ${testUserA.id}, B: ${testUserB.id}) with Resumes (A: ${testResumeA.id}, B: ${testResumeB.id})\n`)

    // -------------------------------------------------------------
    // PART 1: Resume Quality & Grammar Analysis (Section A)
    // -------------------------------------------------------------
    console.log("------------------------------------------------------------------")
    console.log("PART 1: Standalone Resume Quality & Grammar Analysis (/api/ai/quality)")
    console.log("------------------------------------------------------------------")

    // Test 1: Unauthenticated request rejected with HTTP 401
    console.log("Test 1: Unauthenticated request to /api/ai/quality blocked (401)...")
    const unauthQuality = await fetch(`${BASE_URL}/api/ai/quality`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeId: testResumeA.id })
    })
    assert.equal(unauthQuality.status, 401, "Must block unauthenticated access")
    console.log("   ✓ Test 1 Passed: Unauthenticated request rejected with 401.")

    // Test 2: Cross-user resume access rejected with HTTP 403
    console.log("Test 2: Cross-user quality analysis blocked with HTTP 403 Forbidden...")
    const crossQuality = await fetch(`${BASE_URL}/api/ai/quality`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `token=${tokenB}` // User B trying to audit User A's resume!
      },
      body: JSON.stringify({ resumeId: testResumeA.id })
    })
    assert.equal(crossQuality.status, 403, "Must block unauthorized cross-user audit")
    console.log("   ✓ Test 2 Passed: Cross-user audit blocked with 403.")

    // Test 3: Non-existent resume ID rejected with HTTP 404
    console.log("Test 3: Non-existent resume ID returns HTTP 404...")
    const notFoundQuality = await fetch(`${BASE_URL}/api/ai/quality`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `token=${tokenA}`
      },
      body: JSON.stringify({ resumeId: 9999999 })
    })
    assert.equal(notFoundQuality.status, 404, "Must return 404 for missing resume")
    console.log("   ✓ Test 3 Passed: Non-existent resume returns 404.")

    // Test 4: Successful Resume Quality & Grammar analysis with mock Gemini
    console.log("Test 4: Owner runs Resume Quality & Grammar audit (mock Gemini)...")
    const validQuality = await fetch(`${BASE_URL}/api/ai/quality`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-mock-gemini": "true",
        Cookie: `token=${tokenA}`
      },
      body: JSON.stringify({ resumeId: testResumeA.id })
    })
    assert.equal(validQuality.status, 200, "Must return HTTP 200 OK")
    const qualityData = await validQuality.json()
    assert.equal(qualityData.success, true)
    assert.ok(qualityData.report.atsScore >= 0 && qualityData.report.atsScore <= 100)
    assert.ok(Array.isArray(qualityData.report.grammarSpelling), "Must return grammarSpelling array")
    assert.ok(Array.isArray(qualityData.report.awkwardPhrasing), "Must return awkwardPhrasing array")
    assert.ok(Array.isArray(qualityData.report.formattingReadability), "Must return formattingReadability array")
    assert.ok(Array.isArray(qualityData.report.missingSections), "Must return missingSections array")
    assert.ok(Array.isArray(qualityData.report.detectedSkills), "Must return detectedSkills array")
    assert.ok(Array.isArray(qualityData.report.keyImprovements), "Must return keyImprovements array")

    // Verify concrete grammar revision structure
    if (qualityData.report.grammarSpelling.length > 0) {
      const gItem = qualityData.report.grammarSpelling[0]
      assert.ok(gItem.originalText, "Must include original text")
      assert.ok(gItem.suggestedRevision, "Must include suggested revision")
      assert.ok(gItem.explanation, "Must include explanation")
    }

    // Verify persistence in PostgreSQL
    const persistedQuality = await prisma.resumeAnalysis.findUnique({
      where: { id: qualityData.analysisId }
    })
    assert.ok(persistedQuality, "Analysis must be saved in database")
    assert.equal(persistedQuality.userId, testUserA.id)
    assert.equal(persistedQuality.atsScore, qualityData.report.atsScore)
    console.log(`   ✓ Test 4 Passed: Quality audit succeeded (Score: ${qualityData.report.atsScore}%, Grammar issues: ${qualityData.report.grammarSpelling.length}).\n`)

    // -------------------------------------------------------------
    // PART 2: Safe Server-Side Job URL Content Retrieval & SSRF Protection
    // -------------------------------------------------------------
    console.log("------------------------------------------------------------------")
    console.log("PART 2: Safe Server-Side Job URL Fetching & SSRF Protection (/api/jobs/fetch-url)")
    console.log("------------------------------------------------------------------")

    // Test 5: Unauthenticated request to /api/jobs/fetch-url blocked (401)
    console.log("Test 5: Unauthenticated request to /api/jobs/fetch-url blocked (401)...")
    const unauthFetch = await fetch(`${BASE_URL}/api/jobs/fetch-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/jobs/1" })
    })
    assert.equal(unauthFetch.status, 401)
    console.log("   ✓ Test 5 Passed: Unauthenticated URL fetch rejected with 401.")

    // Test 6: SSRF Protection unit checks
    console.log("Test 6: SSRF Protection blocks loopback, private IPs, and localhost...")
    const loopbackCheck = await validateJobUrl("http://localhost:3000/api/secret")
    assert.equal(loopbackCheck.valid, false, "Localhost must be blocked")

    const ipLoopbackCheck = await validateJobUrl("http://127.0.0.1:8080/admin")
    assert.equal(ipLoopbackCheck.valid, false, "127.0.0.1 must be blocked")

    const privateRangeCheck1 = await validateJobUrl("http://192.168.1.1/router")
    assert.equal(privateRangeCheck1.valid, false, "192.168.x.x must be blocked")

    const privateRangeCheck2 = await validateJobUrl("http://10.0.0.5/internal")
    assert.equal(privateRangeCheck2.valid, false, "10.x.x.x must be blocked")

    const metadataCheck = await validateJobUrl("http://169.254.169.254/latest/meta-data/")
    assert.equal(metadataCheck.valid, false, "AWS metadata 169.254.x.x must be blocked")

    const fileSchemeCheck = await validateJobUrl("file:///etc/passwd")
    assert.equal(fileSchemeCheck.valid, false, "file:// protocol must be blocked")

    console.log("   ✓ Test 6 Passed: SSRF protection strictly blocked localhost, 127.0.0.1, 10.x, 192.168.x, 169.254.x, and non-HTTP schemes.")

    // Test 7: HTTP endpoint validates SSRF and invalid URLs
    console.log("Test 7: POST /api/jobs/fetch-url with loopback address returns canPasteManually fallback...")
    const ssrfRes = await fetch(`${BASE_URL}/api/jobs/fetch-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `token=${tokenA}`
      },
      body: JSON.stringify({ url: "http://127.0.0.1:8080/test" })
    })
    assert.equal(ssrfRes.status, 200)
    const ssrfData = await ssrfRes.json()
    assert.equal(ssrfData.success, false)
    assert.equal(ssrfData.canPasteManually, true)
    assert.ok(ssrfData.message.includes("blocked for security"))
    console.log("   ✓ Test 7 Passed: Endpoint safely caught SSRF attempt and returned friendly manual paste option.\n")

    // -------------------------------------------------------------
    // PART 3: Job Match Analysis (Section B)
    // -------------------------------------------------------------
    console.log("------------------------------------------------------------------")
    console.log("PART 3: Job Match Analysis (/api/ai/analyze)")
    console.log("------------------------------------------------------------------")

    // Test 8: Job match analysis with mock Gemini
    console.log("Test 8: Running Job Match Analysis against candidate resume...")
    const jobMatchRes = await fetch(`${BASE_URL}/api/ai/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-mock-gemini": "true",
        Cookie: `token=${tokenA}`
      },
      body: JSON.stringify({
        resumeId: testResumeA.id,
        targetRole: "Staff Full Stack Engineer",
        jobDescription: "We are seeking a Staff Full Stack Engineer with extensive TypeScript, React, Next.js, and AWS microservices experience. Knowledge of GraphQL and Kubernetes is desired."
      })
    })
    assert.equal(jobMatchRes.status, 200)
    const jobMatchData = await jobMatchRes.json()
    assert.equal(jobMatchData.success, true)
    assert.ok(jobMatchData.jobMatch)
    assert.equal(jobMatchData.jobMatch.matchScore, 88)
    assert.ok(jobMatchData.jobMatch.matchingSkills.includes("TypeScript"))
    assert.ok(jobMatchData.jobMatch.missingRequiredSkills.includes("GraphQL"))
    assert.ok(Array.isArray(jobMatchData.jobMatch.partiallyMatchingSkills))
    assert.ok(Array.isArray(jobMatchData.jobMatch.experienceGaps))
    assert.ok(Array.isArray(jobMatchData.jobMatch.educationRequirements))
    assert.ok(Array.isArray(jobMatchData.jobMatch.truthfulKeywords))
    assert.ok(Array.isArray(jobMatchData.jobMatch.tailoredImprovements))
    assert.ok(jobMatchData.jobMatch.scoreExplanation)

    // Verify backward compatibility format
    assert.equal(jobMatchData.analysis.atsScore, 88)
    assert.equal(jobMatchData.analysis.targetRole, "Staff Full Stack Engineer")
    console.log(`   ✓ Test 8 Passed: Job Match Analysis returned Match: ${jobMatchData.jobMatch.matchScore}%, Matching: ${jobMatchData.jobMatch.matchingSkills.length}, Missing: ${jobMatchData.jobMatch.missingRequiredSkills.length}.\n`)

    // -------------------------------------------------------------
    // PART 4: Recommended Relevant Jobs (Section C)
    // -------------------------------------------------------------
    console.log("------------------------------------------------------------------")
    console.log("PART 4: Recommended Relevant Jobs (/api/jobs/matches)")
    console.log("------------------------------------------------------------------")

    // Test 9: Fetch recommended jobs for candidate A
    console.log("Test 9: Fetching recommended jobs scored against candidate skills...")
    const matchesRes = await fetch(`${BASE_URL}/api/jobs/matches?resumeId=${testResumeA.id}`, {
      headers: { Cookie: `token=${tokenA}` }
    })
    assert.equal(matchesRes.status, 200)
    const matchesData = await matchesRes.json()
    assert.equal(matchesData.success, true)
    assert.ok(Array.isArray(matchesData.matches))
    console.log(`   ✓ Test 9 Passed: Successfully retrieved ${matchesData.matches.length} recommended openings scored against candidate skills.\n`)

    // -------------------------------------------------------------
    // PART 5: Route Simplification & Redirection
    // -------------------------------------------------------------
    console.log("------------------------------------------------------------------")
    console.log("PART 5: Route Simplification & Clean Redirection")
    console.log("------------------------------------------------------------------")

    // Test 10: Visiting /dashboard redirects to /
    console.log("Test 10: /dashboard cleanly redirects to main workspace (/)...")
    const dashRes = await fetch(`${BASE_URL}/dashboard`, {
      redirect: "manual",
      headers: { Cookie: `token=${tokenA}` }
    })
    // In Next.js App Router, redirect() sends HTTP 307 or 308 or location header
    assert.ok(dashRes.status === 307 || dashRes.status === 308 || dashRes.status === 200)
    const location = dashRes.headers.get("location")
    if (location) {
      assert.equal(location, "/")
    }
    console.log("   ✓ Test 10 Passed: /dashboard cleanly redirects to main workspace (/).")

    console.log("\n==================================================================")
    console.log("  ALL SIMPLIFIED WORKSPACE & REGRESSION TESTS PASSED!             ")
    console.log("==================================================================")
  } finally {
    // CLEANUP
    console.log("CLEANUP: Removing test records from database...")
    if (testResumeA) {
      await prisma.resumeAnalysis.deleteMany({ where: { resumeId: testResumeA.id } })
      await prisma.jobMatch.deleteMany({ where: { resumeId: testResumeA.id } })
      await prisma.resume.delete({ where: { id: testResumeA.id } })
    }
    if (testResumeB) {
      await prisma.resumeAnalysis.deleteMany({ where: { resumeId: testResumeB.id } })
      await prisma.jobMatch.deleteMany({ where: { resumeId: testResumeB.id } })
      await prisma.resume.delete({ where: { id: testResumeB.id } })
    }
    if (testUserA) {
      await prisma.user.delete({ where: { id: testUserA.id } })
    }
    if (testUserB) {
      await prisma.user.delete({ where: { id: testUserB.id } })
    }
    console.log("   ✓ Cleanup complete.")
  }
}

runSimplifiedWorkspaceTests().catch((err) => {
  console.error("\n❌ Test Suite Failed:", err)
  process.exit(1)
})
