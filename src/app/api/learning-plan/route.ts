import { NextResponse } from "next/server"
import { z } from "zod"
import { authenticateApiUser } from "@/backend/auth/session"
import { createLearningPlan } from "@/backend/services/learningPlanService"

const learningPlanRequestSchema = z.object({
  missingSkills: z.array(z.string().trim().min(1).max(100)).min(1).max(10)
})

export async function POST(request: Request) {
  const auth = await authenticateApiUser()
  if (auth.errorResponse) return auth.errorResponse

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON request body." }, { status: 400 })
  }

  const parsed = learningPlanRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Provide between one and ten valid missing skills." },
      { status: 400 }
    )
  }

  return NextResponse.json({ success: true, plan: createLearningPlan(parsed.data.missingSkills) })
}
