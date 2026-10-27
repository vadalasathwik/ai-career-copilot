import { NextResponse } from "next/server"
import { z } from "zod"
import { authenticateApiUser } from "@/backend/auth/session"
import { prisma } from "@/backend/db/prisma"

const updateApplicationSchema = z.object({
  status: z
    .enum(["INTERESTED", "SAVED", "APPLIED", "INTERVIEW", "OFFER", "REJECTED"])
    .optional(),
  notes: z.string().trim().max(5000).optional(),
  applicationUrl: z.string().trim().url().optional().or(z.literal(""))
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiUser()
  if (auth.errorResponse) {
    return auth.errorResponse
  }
  const user = auth.user

  const { id: rawId } = await params
  const applicationId = parseInt(rawId, 10)
  if (isNaN(applicationId) || applicationId <= 0) {
    return NextResponse.json(
      { success: false, message: "Invalid application ID." },
      { status: 400 }
    )
  }

  const existing = await prisma.jobApplication.findUnique({
    where: { id: applicationId }
  })

  if (!existing) {
    return NextResponse.json(
      { success: false, message: "Application record not found." },
      { status: 404 }
    )
  }

  if (existing.userId !== user.id) {
    return NextResponse.json(
      { success: false, message: "You are not authorized to update this application." },
      { status: 403 }
    )
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

  const validation = updateApplicationSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { success: false, message: validation.error.issues[0]?.message || "Validation error" },
      { status: 400 }
    )
  }

  const updated = await prisma.jobApplication.update({
    where: { id: applicationId },
    data: {
      status: validation.data.status,
      notes: validation.data.notes,
      applicationUrl: validation.data.applicationUrl || undefined,
      updatedAt: new Date()
    }
  })

  return NextResponse.json(
    {
      success: true,
      message: "Application updated successfully.",
      application: updated
    },
    { status: 200 }
  )
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiUser()
  if (auth.errorResponse) {
    return auth.errorResponse
  }
  const user = auth.user

  const { id: rawId } = await params
  const applicationId = parseInt(rawId, 10)
  if (isNaN(applicationId) || applicationId <= 0) {
    return NextResponse.json(
      { success: false, message: "Invalid application ID." },
      { status: 400 }
    )
  }

  const existing = await prisma.jobApplication.findUnique({
    where: { id: applicationId }
  })

  if (!existing) {
    return NextResponse.json(
      { success: false, message: "Application record not found." },
      { status: 404 }
    )
  }

  if (existing.userId !== user.id) {
    return NextResponse.json(
      { success: false, message: "You are not authorized to delete this application." },
      { status: 403 }
    )
  }

  await prisma.jobApplication.delete({
    where: { id: applicationId }
  })

  return NextResponse.json(
    {
      success: true,
      message: "Application deleted successfully."
    },
    { status: 200 }
  )
}
