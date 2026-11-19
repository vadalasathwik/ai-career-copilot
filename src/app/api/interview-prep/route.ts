import { NextResponse } from "next/server"
import { z } from "zod"
import { authenticateApiUser } from "@/backend/auth/session"
import { prisma } from "@/backend/db/prisma"
import { createInterviewPracticeQuestions } from "@/backend/services/interviewPrepService"

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

  const questions = createInterviewPracticeQuestions(parsed.data.jobDescription, resume.extractedText).slice(0, 5)
  return NextResponse.json({
    success: true,
    questions,
    retrieval: { keywordFallbackUsed: questions.some((question) => question.evidenceMethod === "keyword") }
  })
}
