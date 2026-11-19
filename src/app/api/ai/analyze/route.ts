import { NextResponse } from "next/server"
import { z } from "zod"
import { authenticateApiUser } from "@/backend/auth/session"
import { prisma } from "@/backend/db/prisma"
import {
  analyzeJobMatchWithGemini,
  MissingApiKeyError,
  GeminiAnalysisError,
  StructuredResumeAnalysis
} from "@/backend/services/aiService"

const analyzeRequestSchema = z.object({
  resumeId: z.coerce
    .number({ message: "A valid numeric resume ID must be selected." })
    .int("Resume ID must be an integer.")
    .positive("A valid resume ID must be selected."),
  targetRole: z
    .string({ message: "Target job title is required." })
    .trim()
    .min(2, "Target job title must be at least 2 characters long.")
    .max(150, "Target job title cannot exceed 150 characters."),
  jobDescription: z
    .string({ message: "Job description is required." })
    .trim()
    .min(30, "Please provide a detailed job description of at least 30 characters for meaningful ATS analysis.")
    .max(25000, "Job description exceeds the maximum limit of 25,000 characters.")
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

  // 1. Validate request payload using Zod
  const validation = analyzeRequestSchema.safeParse(rawBody)
  if (!validation.success) {
    const firstError = validation.error.issues[0]?.message || "Invalid request parameters."
    return NextResponse.json(
      { success: false, message: firstError },
      { status: 400 }
    )
  }

  const { resumeId, targetRole, jobDescription } = validation.data

  // 2. Load resume and verify ownership strictly
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
        message: "The selected resume contains no readable extracted text. Please upload a resume with readable text."
      },
      { status: 400 }
    )
  }

  // 3. Perform Gemini AI analysis
  try {
    const forceMock =
      process.env.NODE_ENV !== "production" && req.headers.get("x-test-mock-gemini") === "true"

    const jobMatch = await analyzeJobMatchWithGemini({
      resumeText: resume.extractedText,
      jobDescription,
      targetRole,
      forceMock
    })

    // 4. Persist analysis to PostgreSQL
    const savedRecord = await prisma.resumeAnalysis.create({
      data: {
        userId: user.id,
        resumeId: resume.id,
        targetRole,
        jobDescription,
        atsScore: jobMatch.matchScore,
        skillsFound: jobMatch.matchingSkills,
        skillsMissing: jobMatch.missingRequiredSkills,
        strengths: jobMatch.matchingSkills,
        improvements: jobMatch.tailoredImprovements,
        keywords: jobMatch.truthfulKeywords,
        rawAnalysis: JSON.stringify(jobMatch)
      }
    })

    return NextResponse.json(
      {
        success: true,
        jobMatch,
        analysis: {
          id: savedRecord.id,
          resumeId: savedRecord.resumeId,
          resumeFileName: resume.fileName,
          targetRole: savedRecord.targetRole,
          jobDescription: savedRecord.jobDescription,
          atsScore: savedRecord.atsScore,
          skillsFound: savedRecord.skillsFound,
          skillsMissing: savedRecord.skillsMissing,
          strengths: savedRecord.strengths,
          improvements: savedRecord.improvements,
          keywords: savedRecord.keywords,
          summary: jobMatch.summary,
          overallAssessment: jobMatch.summary,
          recommendations: jobMatch.tailoredImprovements,
          createdAt: savedRecord.createdAt,
          disclaimer: "Match score is an AI-generated qualification estimate and does not guarantee employer hiring decisions."
        }
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
        message: "An unexpected error occurred during resume analysis. Please try again."
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/ai/analyze
 * Returns the authenticated user's previous resume analyses,
 * ordered by most recent first, with strict user isolation.
 */
export async function GET() {
  const auth = await authenticateApiUser()
  if (auth.errorResponse) {
    return auth.errorResponse
  }
  const user = auth.user

  try {
    const analyses = await prisma.resumeAnalysis.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        resume: {
          select: {
            id: true,
            fileName: true
          }
        }
      }
    })

    const safeAnalyses = analyses.map((a) => {
      let extra: Partial<StructuredResumeAnalysis> = {}
      if (a.rawAnalysis) {
        try {
          extra = JSON.parse(a.rawAnalysis)
        } catch {
          // ignore corrupted raw analysis
        }
      }

      const summaryText = extra.summary || extra.overallAssessment || ""

      return {
        id: a.id,
        resumeId: a.resumeId,
        resumeFileName: a.resume?.fileName || "Deleted Resume",
        targetRole: a.targetRole || "General Analysis",
        atsScore: a.atsScore,
        skillsFound: a.skillsFound,
        skillsMissing: a.skillsMissing,
        strengths: a.strengths,
        improvements: a.improvements,
        keywords: a.keywords,
        summary: summaryText,
        overallAssessment: summaryText,
        recommendations: extra.recommendations || [],
        createdAt: a.createdAt
      }
    })

    return NextResponse.json(
      {
        success: true,
        analyses: safeAnalyses
      },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to retrieve analyses."
      },
      { status: 500 }
    )
  }
}
