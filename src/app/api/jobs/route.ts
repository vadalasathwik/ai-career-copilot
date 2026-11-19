import { NextResponse } from "next/server"
import { z } from "zod"
import { authenticateApiUser } from "@/backend/auth/session"
import { prisma } from "@/backend/db/prisma"
import { extractSkillsFromJobText } from "@/backend/services/scoringEngine"

const createJobSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Job title must be at least 2 characters.")
    .max(200, "Job title cannot exceed 200 characters."),
  company: z
    .string()
    .trim()
    .min(2, "Company name must be at least 2 characters.")
    .max(200, "Company name cannot exceed 200 characters."),
  description: z
    .string()
    .trim()
    .min(10, "Job description must be at least 10 characters.")
    .max(25000, "Job description cannot exceed 25,000 characters."),
  location: z.string().trim().max(100).optional().nullable(),
  remoteStatus: z.enum(["REMOTE", "HYBRID", "ON_SITE"]).optional().nullable(),
  employmentType: z.string().trim().max(50).optional().nullable(),
  salary: z.string().trim().max(100).optional().nullable(),
  url: z.string().trim().url().optional().or(z.literal("")).nullable(),
  skills: z.array(z.string().trim()).optional()
})

/**
 * GET /api/jobs
 * Retrieves all active jobs saved in the database.
 */
export async function GET(req: Request) {
  const auth = await authenticateApiUser()
  if (auth.errorResponse) {
    return auth.errorResponse
  }

  const url = new URL(req.url)
  const query = url.searchParams.get("query")?.trim()
  const remoteOnly = url.searchParams.get("remoteOnly") === "true"

  const whereClause: Record<string, unknown> = { isActive: true }
  if (remoteOnly) {
    whereClause.remoteStatus = "REMOTE"
  }
  if (query) {
    whereClause.OR = [
      { title: { contains: query, mode: "insensitive" } },
      { company: { contains: query, mode: "insensitive" } }
    ]
  }

  try {
    const jobs = await prisma.job.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: 100
    })

    return NextResponse.json({
      success: true,
      jobs,
      count: jobs.length
    })
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Failed to retrieve jobs."
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/jobs
 * Allows an authenticated user to manually enter a job or paste a job description.
 * Heuristically extracts technical skills if not explicitly provided.
 */
export async function POST(req: Request) {
  const auth = await authenticateApiUser()
  if (auth.errorResponse) {
    return auth.errorResponse
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON request body." },
      { status: 400 }
    )
  }

  const validation = createJobSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        message: validation.error.issues[0]?.message || "Validation failed."
      },
      { status: 400 }
    )
  }

  const data = validation.data

  // If skills were not provided or empty, extract recognized skills from description text
  let finalSkills: string[] = []
  if (data.skills && data.skills.length > 0) {
    finalSkills = data.skills.map((s) => s.trim()).filter(Boolean)
  } else {
    finalSkills = extractSkillsFromJobText(data.description)
  }

  try {
    const newJob = await prisma.job.create({
      data: {
        title: data.title,
        company: data.company,
        description: data.description,
        location: data.location || null,
        remoteStatus: data.remoteStatus || null,
        employmentType: data.employmentType || "Full-time",
        salary: data.salary || null,
        url: data.url || null,
        skills: finalSkills,
        source: "Manual Entry",
        sourceJobId: `manual_${Date.now()}`,
        isSample: false,
        isActive: true,
        lastVerifiedAt: new Date()
      }
    })

    return NextResponse.json(
      {
        success: true,
        message: "Job opportunity successfully created and ready for matching.",
        job: newJob
      },
      { status: 201 }
    )
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Failed to save job opportunity."
      },
      { status: 500 }
    )
  }
}
