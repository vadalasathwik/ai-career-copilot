import { NextResponse } from "next/server"
import { authenticateApiUser } from "@/backend/auth/session"
import { prisma } from "@/backend/db/prisma"
import { StructuredResumeAnalysis } from "@/backend/services/aiService"

export async function GET(
  _req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiUser()
  if (auth.errorResponse) {
    return auth.errorResponse
  }
  const user = auth.user

  const { id } = await props.params
  const numericId = Number(id)
  if (!numericId || !Number.isInteger(numericId) || numericId <= 0) {
    return NextResponse.json(
      { success: false, message: "A valid analysis ID is required." },
      { status: 400 }
    )
  }

  const analysis = await prisma.resumeAnalysis.findUnique({
    where: { id: numericId },
    include: {
      resume: {
        select: {
          id: true,
          fileName: true
        }
      }
    }
  })

  if (!analysis) {
    return NextResponse.json(
      { success: false, message: "Analysis record not found." },
      { status: 404 }
    )
  }

  if (analysis.userId !== user.id) {
    return NextResponse.json(
      { success: false, message: "You are not authorized to view this analysis." },
      { status: 403 }
    )
  }

  let extra: Partial<StructuredResumeAnalysis> = {}
  if (analysis.rawAnalysis) {
    try {
      extra = JSON.parse(analysis.rawAnalysis)
    } catch {}
  }

  return NextResponse.json({
    success: true,
    analysis: {
      id: analysis.id,
      resumeId: analysis.resumeId,
      resumeFileName: analysis.resume?.fileName || "Deleted Resume",
      targetRole: analysis.targetRole,
      jobDescription: analysis.jobDescription,
      atsScore: analysis.atsScore,
      skillsFound: analysis.skillsFound,
      skillsMissing: analysis.skillsMissing,
      strengths: analysis.strengths,
      improvements: analysis.improvements,
      keywords: analysis.keywords,
      recommendations: extra.recommendations || [],
      overallAssessment: extra.overallAssessment || "",
      createdAt: analysis.createdAt
    }
  })
}

export async function DELETE(
  _req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiUser()
  if (auth.errorResponse) {
    return auth.errorResponse
  }
  const user = auth.user

  const { id } = await props.params
  const numericId = Number(id)
  if (!numericId || !Number.isInteger(numericId) || numericId <= 0) {
    return NextResponse.json(
      { success: false, message: "A valid analysis ID is required." },
      { status: 400 }
    )
  }

  const analysis = await prisma.resumeAnalysis.findUnique({
    where: { id: numericId }
  })

  if (!analysis) {
    return NextResponse.json(
      { success: false, message: "Analysis record not found." },
      { status: 404 }
    )
  }

  if (analysis.userId !== user.id) {
    return NextResponse.json(
      { success: false, message: "You are not authorized to delete this analysis." },
      { status: 403 }
    )
  }

  await prisma.resumeAnalysis.delete({
    where: { id: numericId }
  })

  return NextResponse.json({
    success: true,
    message: "Analysis record deleted successfully."
  })
}
