import { NextResponse } from "next/server"
import { z } from "zod"
import { authenticateApiUser } from "@/backend/auth/session"
import { matchResumeToJob } from "@/backend/services/matchingEngine"

const singleMatchSchema = z.object({
  jobId: z.coerce.number().int().positive("A valid job ID is required."),
  resumeId: z.coerce.number().int().positive("A valid resume ID is required."),
  bypassCache: z.boolean().optional()
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

  const validation = singleMatchSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { success: false, message: validation.error.issues[0]?.message || "Validation error" },
      { status: 400 }
    )
  }

  const { jobId, resumeId, bypassCache } = validation.data

  try {
    const match = await matchResumeToJob({
      userId: user.id,
      resumeId,
      jobId,
      bypassCache
    })

    return NextResponse.json(
      {
        success: true,
        match
      },
      { status: 200 }
    )
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Failed to calculate job match."
      },
      { status: 500 }
    )
  }
}
