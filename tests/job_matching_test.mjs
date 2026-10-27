import assert from "node:assert/strict"
import pg from "pg"
import { generateToken } from "../src/backend/auth/jwt.ts"
import {
  calculateDeterministicMatchScore,
  computeMatchInputHash,
  estimateCandidateYearsOfExperience,
  parseSeniorityTier,
  extractSkillsFromJobText,
  isSkillEvidencedInCandidate,
  evaluateJobMatchLocally
} from "../src/backend/services/scoringEngine.ts"
import { databaseJobProvider } from "../src/backend/services/jobProviders/databaseJobProvider.ts"
import {
  discoverActiveJobs,
  getDiscoveryProvidersStatus
} from "../src/backend/services/jobProviders/jobDiscoveryService.ts"

console.log("==================================================================")
console.log("   AI Career Copilot: Phase 6 Deterministic Job Matching Tests   ")
console.log("==================================================================\n")

const { Client } = pg
const db = new Client({ connectionString: process.env.DATABASE_URL })
await db.connect()

let userAId = 0
let userBId = 0
let resumeAId = 0
let resumeBId = 0
let testJobId = 0
let createdAppId = 0
let createdManualJobId = 0

async function setup() {
  console.log("SETUP: Setting up isolated test records in PostgreSQL...")

  // 1. User A
  const resUserA = await db.query(
    "SELECT id FROM \"User\" WHERE email = $1",
    ["job_test_user_a@example.com"]
  )
  if (resUserA.rows.length > 0) {
    userAId = resUserA.rows[0].id
  } else {
    const insertA = await db.query(
      "INSERT INTO \"User\" (name, email, password, provider) VALUES ($1, $2, $3, $4) RETURNING id",
      ["Job Test Candidate A", "job_test_user_a@example.com", "hashedpassword123", "local"]
    )
    userAId = insertA.rows[0].id
  }

  // 2. User B
  const resUserB = await db.query(
    "SELECT id FROM \"User\" WHERE email = $1",
    ["job_test_user_b@example.com"]
  )
  if (resUserB.rows.length > 0) {
    userBId = resUserB.rows[0].id
  } else {
    const insertB = await db.query(
      "INSERT INTO \"User\" (name, email, password, provider) VALUES ($1, $2, $3, $4) RETURNING id",
      ["Job Test Candidate B", "job_test_user_b@example.com", "hashedpassword123", "local"]
    )
    userBId = insertB.rows[0].id
  }

  // 3. Resume A (Senior Full Stack Engineer, 6 years experience)
  const textA = `
    Jordan Rivera
    Senior Full Stack Engineer
    Experience: 6 years building high-throughput web applications with TypeScript, React, Next.js, and Node.js.
    Expertise: PostgreSQL database modeling, Prisma ORM, Redis caching, and Docker containerization.
    Cloud: Led microservices architecture on AWS (ECS, S3, CloudFront).
  `
  const insertResumeA = await db.query(
    `INSERT INTO "Resume" ("userId", "fileName", "fileSize", "fileType", "filePath", "extractedText", "skills", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id`,
    [
      userAId,
      "jordan_rivera_resume.pdf",
      1024,
      "application/pdf",
      "/storage/test/jordan_rivera.pdf",
      textA,
      ["TypeScript", "React", "Next.js", "Node.js", "PostgreSQL", "Prisma", "Docker", "AWS"]
    ]
  )
  resumeAId = insertResumeA.rows[0].id

  // 4. Resume B (Junior Frontend Intern, 1 year experience)
  const textB = `
    Taylor Vance
    Junior Frontend Developer
    Experience: 1 year building responsive UI components with HTML, CSS, JavaScript, and React.
    Foundations: Git version control, basic Tailwind CSS styling.
  `
  const insertResumeB = await db.query(
    `INSERT INTO "Resume" ("userId", "fileName", "fileSize", "fileType", "filePath", "extractedText", "skills", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id`,
    [
      userBId,
      "taylor_vance_resume.pdf",
      1024,
      "application/pdf",
      "/storage/test/taylor_vance.pdf",
      textB,
      ["HTML", "CSS", "JavaScript", "React", "Git"]
    ]
  )
  resumeBId = insertResumeB.rows[0].id

  // 5. Test Job Listing
  const insertJob = await db.query(
    `INSERT INTO "Job" ("title", "company", "location", "remoteStatus", "employmentType", "salary", "description", "skills", "source", "sourceJobId", "isActive", "isSample", "lastVerifiedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()) RETURNING id`,
    [
      "Senior Full Stack Engineer",
      "Apex Cloud Systems",
      "Remote",
      "REMOTE",
      "Full-time",
      "$150,000 - $180,000",
      "Seeking a Senior Full Stack Engineer with 5+ years of experience in TypeScript, React, Next.js, and PostgreSQL. Docker and AWS preferred.",
      ["TypeScript", "React", "Next.js", "PostgreSQL", "Docker", "AWS", "GraphQL"],
      "Database Repository",
      "apex_sr_fullstack_2026",
      true,
      false
    ]
  )
  testJobId = insertJob.rows[0].id

  console.log(`   ✓ Created Test User A (${userAId}) with Resume (${resumeAId})`)
  console.log(`   ✓ Created Test User B (${userBId}) with Resume (${resumeBId})`)
  console.log(`   ✓ Created Test Job (${testJobId})\n`)
}

async function runScoringEngineUnitTests() {
  console.log("------------------------------------------------------------------")
  console.log("PART 1: Local Deterministic Scoring Engine & Heuristics (₹0 Cost)")
  console.log("------------------------------------------------------------------")

  // Test 1: Perfect match evaluates to 100%
  console.log("Test 1: Perfect candidate match evaluates to exactly 100%...")
  const perfectScore = calculateDeterministicMatchScore({
    requiredTotal: 4,
    requiredMatched: 4, // 45 pts
    preferredTotal: 2,
    preferredMatched: 2, // 20 pts
    candidateYears: 6,
    jobSeniorityTier: 3, // Senior (20 exp + 10 seniority = 30 pts)
    remoteStatus: "REMOTE" // 5 pts
  })
  assert.equal(perfectScore.total, 100)
  assert.equal(perfectScore.requiredSkillsScore, 45)
  assert.equal(perfectScore.preferredSkillsScore, 20)
  assert.equal(perfectScore.experienceScore, 20)
  assert.equal(perfectScore.seniorityScore, 10)
  assert.equal(perfectScore.locationScore, 5)
  console.log("   ✓ Test 1 Passed: Perfect candidate match evaluates to 100%.")

  // Test 2: Weak match bounds and realistic scoring
  console.log("Test 2: Junior candidate with partial skills evaluates realistically (< 45%)...")
  const weakScore = calculateDeterministicMatchScore({
    requiredTotal: 4,
    requiredMatched: 2, // 50% of 45 = 23 pts
    preferredTotal: 2,
    preferredMatched: 0, // 0 pts
    candidateYears: 1,
    jobSeniorityTier: 3, // Junior applying to Senior: 8 exp + 3 seniority = 11 pts
    remoteStatus: "ON_SITE" // 3 pts
  })
  assert.ok(weakScore.total >= 0 && weakScore.total <= 100)
  assert.ok(weakScore.total < 45, `Expected score < 45, got ${weakScore.total}`)
  console.log(`   ✓ Test 2 Passed: Junior candidate scored realistically at ${weakScore.total}%.`)

  // Test 3: Zero skills / empty inputs boundary check (never NaN or negative)
  console.log("Test 3: Zero skills boundary condition clamped safely [0, 100]...")
  const zeroScore = calculateDeterministicMatchScore({
    requiredTotal: 0,
    requiredMatched: 0,
    preferredTotal: 0,
    preferredMatched: 0,
    candidateYears: 0,
    jobSeniorityTier: 2,
    remoteStatus: null
  })
  assert.ok(!isNaN(zeroScore.total), "Total must not be NaN")
  assert.ok(zeroScore.total >= 0 && zeroScore.total <= 100)
  console.log(`   ✓ Test 3 Passed: Zero skills evaluated safely to ${zeroScore.total}%.`)

  // Test 4: Skill extraction from raw job description
  console.log("Test 4: Extracting recognized technical skills from pasted job posting...")
  const samplePosting = `
    We are looking for a Senior Python Developer with deep experience in Django, PostgreSQL, Docker, and AWS.
    Familiarity with React or TypeScript is a strong plus.
  `
  const extractedSkills = extractSkillsFromJobText(samplePosting)
  assert.ok(extractedSkills.includes("Python"))
  assert.ok(extractedSkills.includes("Django"))
  assert.ok(extractedSkills.includes("PostgreSQL"))
  assert.ok(extractedSkills.includes("Docker"))
  assert.ok(extractedSkills.includes("AWS"))
  assert.ok(extractedSkills.includes("React"))
  assert.ok(extractedSkills.includes("TypeScript"))
  console.log(`   ✓ Test 4 Passed: Extracted ${extractedSkills.length} skills from job text without LLM.`)

  // Test 5: Alias normalization and word boundary checks
  console.log("Test 5: Resilient alias and synonym matching (e.g. react.js -> React, postgres -> PostgreSQL)...")
  assert.equal(isSkillEvidencedInCandidate("React", ["react.js"], "Some resume text"), true)
  assert.equal(isSkillEvidencedInCandidate("PostgreSQL", ["postgres"], "Some resume text"), true)
  assert.equal(isSkillEvidencedInCandidate("AWS", [], "Built microservices on Amazon Web Services"), true)
  assert.equal(isSkillEvidencedInCandidate("Docker", [], "Candidate has not used containerization"), false)
  console.log("   ✓ Test 5 Passed: Alias normalization and resume text searching verified.")

  // Test 6: Experience and Seniority tier heuristic parsing
  console.log("Test 6: Estimating years of experience and seniority parsing...")
  const years = estimateCandidateYearsOfExperience("Over 7 years of software engineering experience.")
  assert.equal(years, 7)
  const sen1 = parseSeniorityTier("Lead Staff Software Architect")
  assert.equal(sen1.tier, 4)
  const sen2 = parseSeniorityTier("Senior Frontend Engineer")
  assert.equal(sen2.tier, 3)
  const sen3 = parseSeniorityTier("Junior Developer Intern")
  assert.equal(sen3.tier, 1)
  console.log("   ✓ Test 6 Passed: Experience and seniority correctly parsed.")

  // Test 7: Full local semantic qualification evaluation (₹0 budget)
  console.log("Test 7: Complete local evaluation of Jordan Rivera against Apex Systems...")
  const localEval = evaluateJobMatchLocally({
    resumeText: "6 years building high-throughput web applications with TypeScript, React, Next.js, and Node.js. PostgreSQL and AWS.",
    candidateSkills: ["TypeScript", "React", "Next.js", "Node.js", "PostgreSQL", "Prisma", "Docker", "AWS"],
    jobTitle: "Senior Full Stack Engineer",
    jobCompany: "Apex Systems",
    jobDescription: "Requirements: TypeScript, React, Next.js, PostgreSQL. Nice to have: Docker, AWS, GraphQL.",
    jobSkills: ["TypeScript", "React", "Next.js", "PostgreSQL", "Docker", "AWS", "GraphQL"],
    remoteStatus: "REMOTE"
  })
  assert.ok(localEval.matchScore >= 80, `Expected strong match >= 80, got ${localEval.matchScore}`)
  assert.ok(localEval.requiredSkillsMatched.length > 0)
  assert.equal(localEval.experienceLevelAlignment, "STRONG")
  assert.equal(localEval.seniorityAlignment, "MATCH")
  assert.ok(localEval.reasonsForMatch.length > 0)
  assert.ok(localEval.actionableRecommendations.length > 0)
  console.log(`   ✓ Test 7 Passed: Local evaluation computed match score ${localEval.matchScore}% with zero API calls.`)

  // Test 8: Input hash computation consistency for caching
  console.log("Test 8: SHA-256 caching fingerprint consistency...")
  const hash1 = computeMatchInputHash("Resume A", ["React", "TypeScript"], "Job A", ["React", "TypeScript"])
  const hash2 = computeMatchInputHash("Resume A", ["TypeScript", "React"], "Job A", ["TypeScript", "React"])
  assert.equal(hash1, hash2, "Sorted arrays must produce identical hashes")
  const hash3 = computeMatchInputHash("Resume A (Changed)", ["React"], "Job A", ["React"])
  assert.notEqual(hash1, hash3, "Content change must produce new hash")
  console.log("   ✓ Test 8 Passed: SHA-256 fingerprint validates cache correctly.\n")
}

async function runProviderTests() {
  console.log("------------------------------------------------------------------")
  console.log("PART 2: Job Discovery Providers & Database Repository Verification")
  console.log("------------------------------------------------------------------")

  // Test 9: Database Provider queries actual saved jobs
  console.log("Test 9: Database Repository Provider queries real PostgreSQL jobs...")
  const dbStatus = await databaseJobProvider.getStatus()
  assert.equal(dbStatus.status, "ACTIVE")
  const dbJobs = await databaseJobProvider.searchJobs()
  assert.ok(dbJobs.length > 0, "Database provider must return saved test job")
  const firstJob = dbJobs[0]
  assert.ok(firstJob.title)
  assert.ok(firstJob.company)
  assert.ok(firstJob.source)
  console.log(`   ✓ Test 9 Passed: Database Provider returned ${dbJobs.length} active vacancies.`)

  // Test 10: Discovery service aggregation
  console.log("Test 10: Provider discovery aggregation & status report...")
  const discovered = await discoverActiveJobs()
  assert.ok(discovered.length > 0)
  const providerStatuses = await getDiscoveryProvidersStatus()
  assert.equal(providerStatuses.length, 1)
  console.log(`   ✓ Test 10 Passed: Discovery service aggregated ${discovered.length} active listings.\n`)
}

async function runApiIntegrationTests() {
  console.log("------------------------------------------------------------------")
  console.log("PART 4: API Endpoints, Security, Manual Job Entry & User Isolation")
  console.log("------------------------------------------------------------------")

  const tokenUserA = generateToken(userAId)
  const tokenUserB = generateToken(userBId)

  // Test 16: Unauthenticated request to /api/jobs/matches rejected (401)
  console.log("Test 16: Unauthenticated access to /api/jobs/matches blocked (401)...")
  const unauthRes = await fetch("http://localhost:3000/api/jobs/matches")
  assert.equal(unauthRes.status, 401)
  console.log("   ✓ Test 16 Passed: Unauthenticated request rejected with HTTP 401.")

  // Test 17: Provider status endpoint /api/jobs/providers
  console.log("Test 17: GET /api/jobs/providers returns live provider configuration...")
  const provRes = await fetch("http://localhost:3000/api/jobs/providers", {
    headers: { Cookie: `token=${tokenUserA}` }
  })
  assert.equal(provRes.status, 200)
  const provData = await provRes.json()
  assert.equal(provData.success, true)
  assert.ok(Array.isArray(provData.jobProviders))
  console.log("   ✓ Test 17 Passed: Provider configuration status retrieved successfully.")

  // Test 18: Manual Job Entry / Pasted Job Description via POST /api/jobs
  console.log("Test 18: Manual job entry and pasted job description via POST /api/jobs...")
  const createJobRes = await fetch("http://localhost:3000/api/jobs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `token=${tokenUserA}`
    },
    body: JSON.stringify({
      title: "Senior Node.js & Cloud Architect",
      company: "Vertex Cloud Labs",
      location: "Remote - US",
      remoteStatus: "REMOTE",
      salary: "$160,000 - $190,000",
      description: "We are seeking a senior architect with 6+ years of experience in Node.js, TypeScript, PostgreSQL, and AWS. Docker experience is required."
    })
  })
  assert.equal(createJobRes.status, 201)
  const createJobData = await createJobRes.json()
  assert.equal(createJobData.success, true)
  assert.ok(createJobData.job.id > 0)
  assert.equal(createJobData.job.source, "Manual Entry")
  assert.ok(createJobData.job.skills.includes("TypeScript"))
  assert.ok(createJobData.job.skills.includes("Node.js"))
  createdManualJobId = createJobData.job.id
  console.log(`   ✓ Test 18 Passed: Manual job created (ID: ${createdManualJobId}) with auto-extracted skills: ${createJobData.job.skills.join(", ")}.`)

  // Test 19: User A fetching matches for their resume
  console.log("Test 19: User A fetching intelligent job matches via GET /api/jobs/matches...")
  const matchesRes = await fetch(`http://localhost:3000/api/jobs/matches?resumeId=${resumeAId}`, {
    headers: {
      Cookie: `token=${tokenUserA}`
    }
  })
  assert.equal(matchesRes.status, 200)
  const matchesData = await matchesRes.json()
  assert.equal(matchesData.success, true)
  assert.ok(Array.isArray(matchesData.matches))
  assert.ok(matchesData.matches.length > 0)
  const topMatch = matchesData.matches[0]
  assert.ok(topMatch.matchScore >= 0 && topMatch.matchScore <= 100)
  assert.ok(topMatch.scoreBreakdown.total === topMatch.matchScore)
  console.log(`   ✓ Test 19 Passed: User A received ${matchesData.matches.length} matches (Top: ${topMatch.matchScore}%).`)

  // Test 20: On-demand match endpoint /api/jobs/match
  console.log("Test 20: On-demand single match calculation via POST /api/jobs/match...")
  const singleMatchRes = await fetch("http://localhost:3000/api/jobs/match", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `token=${tokenUserA}`
    },
    body: JSON.stringify({
      resumeId: resumeAId,
      jobId: createdManualJobId
    })
  })
  assert.equal(singleMatchRes.status, 200)
  const singleMatchData = await singleMatchRes.json()
  assert.equal(singleMatchData.success, true)
  assert.equal(singleMatchData.match.jobId, createdManualJobId)
  assert.ok(singleMatchData.match.matchScore >= 70)
  console.log(`   ✓ Test 20 Passed: On-demand match evaluated manually created job at ${singleMatchData.match.matchScore}%.`)

  // Test 21: Save Job action (POST /api/applications with status SAVED)
  console.log("Test 21: Saving a job via POST /api/applications...")
  const saveRes = await fetch("http://localhost:3000/api/applications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `token=${tokenUserA}`
    },
    body: JSON.stringify({
      jobId: testJobId,
      status: "SAVED"
    })
  })
  assert.equal(saveRes.status, 200)
  const saveData = await saveRes.json()
  assert.equal(saveData.success, true)
  assert.equal(saveData.application.status, "SAVED")
  assert.equal(saveData.application.userId, userAId)
  createdAppId = saveData.application.id
  console.log(`   ✓ Test 21 Passed: Job saved with Application ID ${createdAppId}.`)

  // Test 22: Duplicate Prevention on re-saving or updating application
  console.log("Test 22: Duplicate prevention: re-saving updates status rather than creating duplicates...")
  const dupRes = await fetch("http://localhost:3000/api/applications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `token=${tokenUserA}`
    },
    body: JSON.stringify({
      jobId: testJobId,
      status: "APPLIED",
      notes: "Submitted via company portal"
    })
  })
  assert.equal(dupRes.status, 200)
  const dupData = await dupRes.json()
  assert.equal(dupData.application.id, createdAppId, "Must reuse existing application record ID")
  assert.equal(dupData.application.status, "APPLIED")

  const appCount = await db.query(
    "SELECT COUNT(*) FROM \"JobApplication\" WHERE \"userId\" = $1 AND \"jobId\" = $2",
    [userAId, testJobId]
  )
  assert.equal(parseInt(appCount.rows[0].count, 10), 1, "Must have exactly 1 record for this (user, job) pair")
  console.log("   ✓ Test 22 Passed: Duplicate prevented; status cleanly updated to APPLIED.")

  // Test 23: Cross-user application isolation (User B cannot delete User A's application)
  console.log("Test 23: Cross-user application deletion blocked (403)...")
  const crossDelRes = await fetch(`http://localhost:3000/api/applications/${createdAppId}`, {
    method: "DELETE",
    headers: {
      Cookie: `token=${tokenUserB}`
    }
  })
  assert.equal(crossDelRes.status, 403)
  console.log("   ✓ Test 23 Passed: Cross-user deletion blocked with HTTP 403.")

  // Test 24: Owner successfully deletes their application
  console.log("Test 24: Deleting application via DELETE /api/applications/[id]...")
  const delRes = await fetch(`http://localhost:3000/api/applications/${createdAppId}`, {
    method: "DELETE",
    headers: {
      Cookie: `token=${tokenUserA}`
    }
  })
  assert.equal(delRes.status, 200)
  const checkDel = await db.query(
    "SELECT id FROM \"JobApplication\" WHERE id = $1",
    [createdAppId]
  )
  assert.equal(checkDel.rows.length, 0)
  console.log("   ✓ Test 24 Passed: Application successfully deleted.\n")
}

async function cleanup() {
  console.log("CLEANUP: Cleaning up test records...")
  if (createdAppId) {
    await db.query("DELETE FROM \"JobApplication\" WHERE id = $1", [createdAppId]).catch(() => {})
  }
  if (createdManualJobId) {
    await db.query("DELETE FROM \"Job\" WHERE id = $1", [createdManualJobId]).catch(() => {})
  }
  if (resumeAId) {
    await db.query("DELETE FROM \"Resume\" WHERE id = $1", [resumeAId]).catch(() => {})
  }
  if (resumeBId) {
    await db.query("DELETE FROM \"Resume\" WHERE id = $1", [resumeBId]).catch(() => {})
  }
  if (testJobId) {
    await db.query("DELETE FROM \"Job\" WHERE id = $1", [testJobId]).catch(() => {})
  }
  if (userAId) {
    await db.query("DELETE FROM \"User\" WHERE id = $1", [userAId]).catch(() => {})
  }
  if (userBId) {
    await db.query("DELETE FROM \"User\" WHERE id = $1", [userBId]).catch(() => {})
  }
  console.log("   ✓ Test records cleaned up.\n")
}

try {
  await setup()
  await runScoringEngineUnitTests()
  await runProviderTests()
  await runApiIntegrationTests()
  console.log("==================================================================")
  console.log("   ALL DETERMINISTIC JOB MATCHING TESTS COMPLETED SUCCESSFULLY!   ")
  console.log("==================================================================")
} catch (error) {
  console.error("TEST FAILED:", error)
  process.exitCode = 1
} finally {
  await cleanup()
  await db.end()
  process.exit(process.exitCode || 0)
}
