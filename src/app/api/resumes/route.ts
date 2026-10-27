import { NextResponse } from "next/server"
import { authenticateApiUser } from "@/backend/auth/session"
import { getUserResumes } from "@/backend/services/resumeService"

export async function GET() {
  const auth = await authenticateApiUser()
  if (auth.errorResponse) {
    return auth.errorResponse
  }
  const user = auth.user

  try {
    const resumes = await getUserResumes(user.id)
    return NextResponse.json(
      {
        success: true,
        resumes
      },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to retrieve resumes."
      },
      { status: 500 }
    )
  }
}
