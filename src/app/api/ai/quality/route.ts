import { NextResponse } from "next/server"
import { z } from "zod"
import { authenticateApiUser } from "@/backend/auth/session"
import { prisma } from "@/backend/db/prisma"
import {
  analyzeResumeQuality,
  MissingApiKeyError,
  GeminiAnalysisError
} from "@/backend/services/aiService"

const qualityRequestSchema = z.object({
  resumeId: z.coerce
    .number({ message: "A valid resume ID must be selected." })
    .int()
    .positive("A valid resume ID must be selected.")
})

export async function POST(req: Request) {
  const auth = await authenticateApiUser()
  if (auth.errorResponse) {
    return auth.errorResponse
  }
  const user = auth.user

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON request body." },
      { status: 400 }
    )
  }

  const validation = qualityRequestSchema.safeParse(rawBody)
  if (!validation.success) {
    const errorMsg = validation.error.issues[0]?.message || "Invalid request parameters."
    return NextResponse.json(
      { success: false, message: errorMsg },
      { status: 400 }
    )
  }

  const { resumeId } = validation.data

  const resume = await prisma.resume.findUnique({
    where: { id: resumeId }
  })

  if (!resume) {
    return NextResponse.json(
      { success: false, message: "The selected resume was not found." },
      { status: 404 }
    )
  }

  if (resume.userId !== user.id) {
    return NextResponse.json(
      { success: false, message: "You are not authorized to analyze this resume." },
      { status: 403 }
    )
  }

  if (!resume.extractedText || resume.extractedText.trim().length < 20) {
    return NextResponse.json(
      {
        success: false,
        message: "The selected resume contains insufficient extracted text. Please upload a readable PDF or DOCX resume."
      },
      { status: 400 }
    )
  }

  try {
    const forceMock =
      process.env.NODE_ENV !== "production" && req.headers.get("x-test-mock-gemini") === "true"

    const report = await analyzeResumeQuality({
      resumeText: resume.extractedText,
      forceMock
    })

    const savedRecord = await prisma.resumeAnalysis.create({
      data: {
        userId: user.id,
        resumeId: resume.id,
        targetRole: "Resume Quality & Grammar Audit",
        jobDescription: null,
        atsScore: report.atsScore,
        skillsFound: report.detectedSkills,
        skillsMissing: report.missingSections,
        strengths: report.detectedSkills,
        improvements: report.keyImprovements,
        keywords: [],
        rawAnalysis: JSON.stringify(report)
      }
    })

    return NextResponse.json(
      {
        success: true,
        report,
        analysisId: savedRecord.id,
        resumeFileName: resume.fileName
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    if (error instanceof MissingApiKeyError) {
      return NextResponse.json(
        {
          success: false,
          code: "MISSING_API_KEY",
          message: error.message
        },
        { status: 503 }
      )
    }

    if (error instanceof GeminiAnalysisError) {
      return NextResponse.json(
        {
          success: false,
          message: error.message
        },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to analyze resume quality."
      },
      { status: 500 }
    )
  }
}
