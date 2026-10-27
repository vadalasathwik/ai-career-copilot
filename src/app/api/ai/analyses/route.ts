import { NextResponse } from "next/server"
import { authenticateApiUser } from "@/backend/auth/session"
import { prisma } from "@/backend/db/prisma"
import { StructuredResumeAnalysis } from "@/backend/services/aiService"

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
      take: 20,
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

      return {
        id: a.id,
        resumeId: a.resumeId,
        resumeFileName: a.resume?.fileName || "Deleted Resume",
        targetRole: a.targetRole,
        jobDescription: a.jobDescription,
        atsScore: a.atsScore,
        skillsFound: a.skillsFound,
        skillsMissing: a.skillsMissing,
        strengths: a.strengths,
        improvements: a.improvements,
        keywords: a.keywords,
        summary: extra.summary || extra.overallAssessment || "",
        overallAssessment: extra.summary || extra.overallAssessment || "",
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
