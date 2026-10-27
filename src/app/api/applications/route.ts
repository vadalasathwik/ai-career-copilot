import { NextResponse } from "next/server"
import { z } from "zod"
import { authenticateApiUser } from "@/backend/auth/session"
import { prisma } from "@/backend/db/prisma"

const createApplicationSchema = z.object({
  jobId: z.coerce.number().int().positive().optional(),
  company: z.string().trim().optional(),
  role: z.string().trim().optional(),
  status: z
    .enum(["INTERESTED", "SAVED", "APPLIED", "INTERVIEW", "OFFER", "REJECTED"])
    .default("SAVED"),
  notes: z.string().trim().max(5000).optional(),
  applicationUrl: z.string().trim().url().optional().or(z.literal(""))
})

export async function POST(req: Request) {
  const auth = await authenticateApiUser()
  if (auth.errorResponse) {
    return auth.errorResponse
  }
  const user = auth.user

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON request body." },
      { status: 400 }
    )
  }

  const validation = createApplicationSchema.safeParse(body)
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

  let company = data.company
  let role = data.role
  let applicationUrl = data.applicationUrl

  // If jobId is supplied, verify and inherit job details
  if (data.jobId) {
    const job = await prisma.job.findUnique({
      where: { id: data.jobId }
    })

    if (!job) {
      return NextResponse.json(
        { success: false, message: "Target job opportunity not found." },
        { status: 404 }
      )
    }

    company = company || job.company
    role = role || job.title
    applicationUrl = applicationUrl || job.url || undefined

    // Upsert to strictly prevent duplicate entries for the same job and user
    const app = await prisma.jobApplication.upsert({
      where: {
        userId_jobId: {
          userId: user.id,
          jobId: data.jobId
        }
      },
      update: {
        status: data.status,
        notes: data.notes !== undefined ? data.notes : undefined,
        applicationUrl: applicationUrl || undefined,
        updatedAt: new Date()
      },
      create: {
        userId: user.id,
        jobId: data.jobId,
        company: company || "Unknown Company",
        role: role || "Unknown Role",
        status: data.status,
        notes: data.notes || null,
        applicationUrl: applicationUrl || null
      }
    })

    return NextResponse.json(
      {
        success: true,
        message:
          data.status === "SAVED"
            ? "Opportunity saved successfully."
            : "Application status updated successfully.",
        application: app
      },
      { status: 200 }
    )
  }

  // If jobId is not supplied, manual application logging
  if (!company || !role) {
    return NextResponse.json(
      {
        success: false,
        message: "Company and Role are required when logging a manual application."
      },
      { status: 400 }
    )
  }

  const app = await prisma.jobApplication.create({
    data: {
      userId: user.id,
      company,
      role,
      status: data.status,
      notes: data.notes || null,
      applicationUrl: applicationUrl || null
    }
  })

  return NextResponse.json(
    {
      success: true,
      message: "Application tracked successfully.",
      application: app
    },
    { status: 201 }
  )
}

export async function GET() {
  const auth = await authenticateApiUser()
  if (auth.errorResponse) {
    return auth.errorResponse
  }
  const user = auth.user

  const applications = await prisma.jobApplication.findMany({
    where: { userId: user.id },
    orderBy: { appliedDate: "desc" },
    include: {
      job: {
        select: {
          id: true,
          title: true,
          company: true,
          location: true,
          source: true,
          url: true,
          salary: true,
          isSample: true
        }
      }
    }
  })

  return NextResponse.json(
    {
      success: true,
      applications,
      count: applications.length
    },
    { status: 200 }
  )
}
