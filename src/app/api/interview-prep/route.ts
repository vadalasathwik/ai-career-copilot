import { NextResponse } from "next/server"
import { z } from "zod"
import { authenticateApiUser } from "@/backend/auth/session"
import { prisma } from "@/backend/db/prisma"
import { applyVectorEvidence, createInterviewPracticeQuestions } from "@/backend/services/interviewPrepService"
import { ensureResumeEvidenceIndex, retrieveResumeEvidenceCandidates } from "@/backend/services/resumeEvidenceService"
import { generateGroundedInterviewQuestions } from "@/backend/services/aiService"

const requestSchema = z.object({
  resumeId: z.coerce.number().int().positive(),
  jobDescription: z.string().trim().min(30).max(25000)
})

export async function POST(req: Request) {
  const auth = await authenticateApiUser()
  if (auth.errorResponse) return auth.errorResponse

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON request body." }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "A resume and detailed job description are required." }, { status: 400 })
  }

  const resume = await prisma.resume.findUnique({ where: { id: parsed.data.resumeId } })
  if (!resume) {
    return NextResponse.json({ success: false, message: "The selected resume was not found." }, { status: 404 })
  }
  if (resume.userId !== auth.user.id) {
    return NextResponse.json({ success: false, message: "You are not authorized to use this resume." }, { status: 403 })
  }
  if (resume.extractedText.trim().length < 20) {
    return NextResponse.json({ success: false, message: "The selected resume contains no readable extracted text. Please upload a readable resume." }, { status: 400 })
  }

  const baselineQuestions = createInterviewPracticeQuestions(parsed.data.jobDescription, resume.extractedText).slice(0, 5)
  const index = await ensureResumeEvidenceIndex(resume.id, resume.extractedText)
  const vectorResults = index.available
    ? await Promise.all(baselineQuestions.map((question) => retrieveResumeEvidenceCandidates(resume.id, question.jobRequirement)))
    : []
  const retrievedQuestions = baselineQuestions.map((question, index) =>
    vectorResults[index]?.available
      ? applyVectorEvidence(question, vectorResults[index].candidates)
      : question
  )
  const approved = retrievedQuestions.map((question, requirementIndex) =>
    question.resumeExcerpt ? [{ id: `r${requirementIndex}-e1`, text: question.resumeExcerpt }] : []
  )
  let questions = retrievedQuestions
  try {
    const testScenario = process.env.NODE_ENV !== "production" ? req.headers.get("x-test-mock-interview") : null
    const generated = await generateGroundedInterviewQuestions({
      items: retrievedQuestions.map((question, requirementIndex) => ({ requirement: question.jobRequirement, approvedExcerpts: approved[requirementIndex] })),
      forceMock: testScenario === "true"
        ? true
        : testScenario === "wrong-id" || testScenario === "wrong-requirement-id" || testScenario === "no-evidence-id" || testScenario === "failure" || testScenario === "timeout"
          ? testScenario
          : false
    })
    if (
      generated.length !== retrievedQuestions.length ||
      generated.some((item) => item.requirementIndex >= retrievedQuestions.length) ||
      new Set(generated.map((item) => item.requirementIndex)).size !== generated.length
    ) throw new Error("Interview question generation did not return one result per requirement.")
    const generatedByRequirement = new Map(generated.map((item) => [item.requirementIndex, item]))
    questions = retrievedQuestions.map((question, requirementIndex) => {
      const item = generatedByRequirement.get(requirementIndex)
      const allowed = approved[requirementIndex]
      const citationIsValid = question.resumeExcerpt
        ? item?.excerptId === allowed[0]?.id
        : item?.excerptId === null
      if (!item || !citationIsValid) return question
      return { ...question, question: item.question, questionGeneration: "gemini" as const }
    })
  } catch {
    // Deterministic templates remain available during provider failures.
  }
  return NextResponse.json({
    success: true,
    questions,
    retrieval: {
      vectorAvailable: index.available,
      vectorFallbackReason: index.available ? undefined : index.reason,
      keywordFallbackUsed: questions.some((question) => question.evidenceMethod === "keyword"),
      questionGenerationFallbackUsed: questions.some((question) => question.questionGeneration === "template")
    }
  })
}
