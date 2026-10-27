import assert from "node:assert/strict"
import pg from "pg"
import { generateToken } from "../src/backend/auth/jwt.ts"
import { getDashboardData } from "../src/backend/services/dashboardService.ts"

console.log("==================================================================")
console.log("   AI Career Copilot: Job Saving & Application Tracking Tests    ")
console.log("==================================================================\n")

const { Client } = pg
const db = new Client({ connectionString: process.env.DATABASE_URL })
await db.connect()

let userAId = 0
let userBId = 0
let testJob1Id = 0
let testJob2Id = 0
let testJob3Id = 0
let app1Id = 0
let app2Id = 0

async function setup() {
  console.log("SETUP: Setting up isolated test records in PostgreSQL...")

  // 1. User A
  const resUserA = await db.query(
    "SELECT id FROM \"User\" WHERE email = $1",
    ["track_user_a@example.com"]
  )
  if (resUserA.rows.length > 0) {
    userAId = resUserA.rows[0].id
  } else {
    const insertA = await db.query(
      "INSERT INTO \"User\" (name, email, password, provider) VALUES ($1, $2, $3, $4) RETURNING id",
      ["Track User A", "track_user_a@example.com", "hashedpass", "local"]
    )
    userAId = insertA.rows[0].id
  }

  // 2. User B
  const resUserB = await db.query(
    "SELECT id FROM \"User\" WHERE email = $1",
    ["track_user_b@example.com"]
  )
  if (resUserB.rows.length > 0) {
    userBId = resUserB.rows[0].id
  } else {
    const insertB = await db.query(
      "INSERT INTO \"User\" (name, email, password, provider) VALUES ($1, $2, $3, $4) RETURNING id",
      ["Track User B", "track_user_b@example.com", "hashedpass", "local"]
    )
    userBId = insertB.rows[0].id
  }

  // 3. Test Jobs
  const insertJob1 = await db.query(
    `INSERT INTO "Job" ("title", "company", "location", "remoteStatus", "description", "skills", "source", "sourceJobId", "isActive", "isSample")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    ["Frontend Engineer", "Alpha Corp", "Remote", "REMOTE", "React and TypeScript role", ["React", "TypeScript"], "Manual Entry", "alpha_1", true, false]
  )
  testJob1Id = insertJob1.rows[0].id

  const insertJob2 = await db.query(
    `INSERT INTO "Job" ("title", "company", "location", "remoteStatus", "description", "skills", "source", "sourceJobId", "isActive", "isSample")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    ["Backend Architect", "Beta Systems", "Hybrid", "HYBRID", "Node.js and PostgreSQL", ["Node.js", "PostgreSQL"], "Manual Entry", "beta_2", true, false]
  )
  testJob2Id = insertJob2.rows[0].id

  const insertJob3 = await db.query(
    `INSERT INTO "Job" ("title", "company", "location", "remoteStatus", "description", "skills", "source", "sourceJobId", "isActive", "isSample")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    ["Staff DevOps Engineer", "Gamma Cloud", "On-site", "ON_SITE", "Kubernetes and AWS", ["Docker", "Kubernetes", "AWS"], "Manual Entry", "gamma_3", true, false]
  )
  testJob3Id = insertJob3.rows[0].id

  // Clean any prior applications for these test users
  await db.query("DELETE FROM \"JobApplication\" WHERE \"userId\" IN ($1, $2)", [userAId, userBId])

  console.log(`   ✓ Test User A (${userAId}) and User B (${userBId}) ready.`)
  console.log(`   ✓ Created 3 Test Jobs (IDs: ${testJob1Id}, ${testJob2Id}, ${testJob3Id})\n`)
}

async function runApplicationLifecycleTests() {
  console.log("------------------------------------------------------------------")
  console.log("PART 1: Application Statuses & Lifecycle Transitions")
  console.log("------------------------------------------------------------------")

  const tokenA = generateToken(userAId)

  // Test 1: Unauthenticated request rejected (401)
  console.log("Test 1: Unauthenticated request to /api/applications blocked (401)...")
  const unauthRes = await fetch("http://localhost:3000/api/applications")
  assert.equal(unauthRes.status, 401)
  console.log("   ✓ Test 1 Passed: Unauthenticated access blocked with HTTP 401.")

  // Test 2: User A saves a job (status: SAVED)
  console.log("Test 2: Saving a job with status SAVED...")
  const saveRes = await fetch("http://localhost:3000/api/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `token=${tokenA}` },
    body: JSON.stringify({ jobId: testJob1Id, status: "SAVED" })
  })
  assert.equal(saveRes.status, 200)
  const saveData = await saveRes.json()
  assert.equal(saveData.success, true)
  assert.equal(saveData.application.status, "SAVED")
  assert.equal(saveData.application.jobId, testJob1Id)
  app1Id = saveData.application.id
  console.log(`   ✓ Test 2 Passed: Job saved with status SAVED (App ID: ${app1Id}).`)

  // Test 3: User A tracks interest in another job (status: INTERESTED)
  console.log("Test 3: Marking another job as INTERESTED...")
  const interestRes = await fetch("http://localhost:3000/api/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `token=${tokenA}` },
    body: JSON.stringify({ jobId: testJob2Id, status: "INTERESTED" })
  })
  assert.equal(interestRes.status, 200)
  const interestData = await interestRes.json()
  assert.equal(interestData.success, true)
  assert.equal(interestData.application.status, "INTERESTED")
  app2Id = interestData.application.id
  console.log(`   ✓ Test 3 Passed: Job marked as INTERESTED (App ID: ${app2Id}).`)

  // Test 4: Verify Dashboard counts for pre-application stages (SAVED & INTERESTED)
  console.log("Test 4: Verifying dashboard counts for pre-application stages...")
  const dashDataPre = await getDashboardData(userAId)
  assert.equal(dashDataPre.applicationsCount, 0, "Pre-application statuses (SAVED/INTERESTED) must NOT count as submitted applications")
  assert.equal(dashDataPre.savedJobsCount, 2, "Saved opportunities count must equal 2")
  assert.ok(dashDataPre.applicationsSubtitle.includes("0 submitted (2 saved for later)"), `Subtitle was: ${dashDataPre.applicationsSubtitle}`)
  console.log(`   ✓ Test 4 Passed: Dashboard correctly shows Applications: 0 and Subtitle: "${dashDataPre.applicationsSubtitle}".`)

  // Test 5: Transition from SAVED to APPLIED (Verifies Duplicate Prevention)
  console.log("Test 5: Transitioning job from SAVED to APPLIED (reusing record ID)...")
  const applyRes = await fetch("http://localhost:3000/api/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `token=${tokenA}` },
    body: JSON.stringify({ jobId: testJob1Id, status: "APPLIED", notes: "Submitted via portal" })
  })
  assert.equal(applyRes.status, 200)
  const applyData = await applyRes.json()
  assert.equal(applyData.application.id, app1Id, "Duplicate prevented: must update existing record ID")
  assert.equal(applyData.application.status, "APPLIED")

  // Verify exactly 1 row exists in DB for this (user, job) pair
  const countRow = await db.query(
    "SELECT COUNT(*) FROM \"JobApplication\" WHERE \"userId\" = $1 AND \"jobId\" = $2",
    [userAId, testJob1Id]
  )
  assert.equal(parseInt(countRow.rows[0].count, 10), 1)
  console.log("   ✓ Test 5 Passed: Record updated to APPLIED without creating duplicate.")

  // Test 6: Verify Dashboard counts now reflect 1 submitted application and 1 saved
  console.log("Test 6: Verifying dashboard counts after applying...")
  const dashDataApplied = await getDashboardData(userAId)
  assert.equal(dashDataApplied.applicationsCount, 1, "Submitted application must be counted")
  assert.equal(dashDataApplied.savedJobsCount, 1, "Remaining saved opportunity must be counted")
  assert.ok(dashDataApplied.applicationsSubtitle.includes("1 submitted • 1 saved"), `Subtitle was: ${dashDataApplied.applicationsSubtitle}`)
  console.log(`   ✓ Test 6 Passed: Dashboard reflects Applications: 1 and Subtitle: "${dashDataApplied.applicationsSubtitle}".`)

  // Test 7: Lifecycle progression: APPLIED -> INTERVIEW -> OFFER
  console.log("Test 7: Progression through INTERVIEW and OFFER stages...")
  const patchInterview = await fetch(`http://localhost:3000/api/applications/${app1Id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: `token=${tokenA}` },
    body: JSON.stringify({ status: "INTERVIEW", notes: "Technical round scheduled" })
  })
  assert.equal(patchInterview.status, 200)
  const intData = await patchInterview.json()
  assert.equal(intData.application.status, "INTERVIEW")

  const patchOffer = await fetch(`http://localhost:3000/api/applications/${app1Id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: `token=${tokenA}` },
    body: JSON.stringify({ status: "OFFER" })
  })
  assert.equal(patchOffer.status, 200)
  const offerData = await patchOffer.json()
  assert.equal(offerData.application.status, "OFFER")
  console.log("   ✓ Test 7 Passed: Successfully transitioned through INTERVIEW to OFFER.")

  // Test 8: REJECTED status
  console.log("Test 8: Setting status to REJECTED...")
  const patchReject = await fetch(`http://localhost:3000/api/applications/${app1Id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: `token=${tokenA}` },
    body: JSON.stringify({ status: "REJECTED" })
  })
  assert.equal(patchReject.status, 200)
  const rejData = await patchReject.json()
  assert.equal(rejData.application.status, "REJECTED")
  console.log("   ✓ Test 8 Passed: Successfully transitioned to REJECTED.\n")
}

async function runSecurityAndIsolationTests() {
  console.log("------------------------------------------------------------------")
  console.log("PART 2: User Isolation, Ownership & Cross-User Security")
  console.log("------------------------------------------------------------------")

  const tokenA = generateToken(userAId)
  const tokenB = generateToken(userBId)

  // Test 9: User B cannot modify User A's application (403)
  console.log("Test 9: Cross-user modification blocked with 403 Forbidden...")
  const crossPatch = await fetch(`http://localhost:3000/api/applications/${app1Id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: `token=${tokenB}` },
    body: JSON.stringify({ status: "OFFER" })
  })
  assert.equal(crossPatch.status, 403)
  console.log("   ✓ Test 9 Passed: Cross-user update blocked with HTTP 403.")

  // Test 10: User B cannot delete User A's application (403)
  console.log("Test 10: Cross-user deletion blocked with 403 Forbidden...")
  const crossDelete = await fetch(`http://localhost:3000/api/applications/${app1Id}`, {
    method: "DELETE",
    headers: { Cookie: `token=${tokenB}` }
  })
  assert.equal(crossDelete.status, 403)
  console.log("   ✓ Test 10 Passed: Cross-user delete blocked with HTTP 403.")

  // Test 11: User B fetching applications list only sees their own
  console.log("Test 11: GET /api/applications returns strictly user-scoped records...")
  const listB = await fetch("http://localhost:3000/api/applications", {
    headers: { Cookie: `token=${tokenB}` }
  })
  assert.equal(listB.status, 200)
  const dataB = await listB.json()
  assert.equal(dataB.applications.length, 0, "User B should not see any of User A's applications")
  console.log("   ✓ Test 11 Passed: User B list is empty, confirming zero leakage.")

  // Test 12: User A successfully deletes their application
  console.log("Test 12: Owner deletes application via DELETE /api/applications/[id]...")
  const delRes = await fetch(`http://localhost:3000/api/applications/${app1Id}`, {
    method: "DELETE",
    headers: { Cookie: `token=${tokenA}` }
  })
  assert.equal(delRes.status, 200)
  const checkDel = await db.query("SELECT id FROM \"JobApplication\" WHERE id = $1", [app1Id])
  assert.equal(checkDel.rows.length, 0)
  console.log("   ✓ Test 12 Passed: Owner successfully deleted application from PostgreSQL.\n")
}

async function cleanup() {
  console.log("CLEANUP: Removing test records from database...")
  await db.query("DELETE FROM \"JobApplication\" WHERE \"userId\" IN ($1, $2)", [userAId, userBId]).catch(() => {})
  await db.query("DELETE FROM \"Job\" WHERE id IN ($1, $2, $3)", [testJob1Id, testJob2Id, testJob3Id]).catch(() => {})
  await db.query("DELETE FROM \"User\" WHERE id IN ($1, $2)", [userAId, userBId]).catch(() => {})
  console.log("   ✓ Cleanup complete.\n")
}

try {
  await setup()
  await runApplicationLifecycleTests()
  await runSecurityAndIsolationTests()
  console.log("==================================================================")
  console.log("   ALL JOB SAVING & APPLICATION TRACKING TESTS PASSED!            ")
  console.log("==================================================================")
} catch (error) {
  console.error("TEST FAILED:", error)
  process.exitCode = 1
} finally {
  await cleanup()
  await db.end()
  process.exit(process.exitCode || 0)
}
