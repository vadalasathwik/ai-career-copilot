import { NextRequest, NextResponse } from "next/server"
import { authenticateApiUser } from "@/backend/auth/session"
import { deleteUserResume } from "@/backend/services/resumeService"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  const auth = await authenticateApiUser()
  if (auth.errorResponse) {
    return auth.errorResponse
  }
  const user = auth.user

  const { id } = await context.params
  const resumeId = Number(id)

  if (!resumeId || isNaN(resumeId) || resumeId <= 0) {
    return NextResponse.json(
      { success: false, message: "Invalid resume ID supplied." },
      { status: 400 }
    )
  }

  try {
    const result = await deleteUserResume(resumeId, user.id)

    if (result.status === "NOT_FOUND") {
      return NextResponse.json(
        { success: false, message: "Resume not found." },
        { status: 404 }
      )
    }

    if (result.status === "FORBIDDEN") {
      return NextResponse.json(
        { success: false, message: "Forbidden: You do not have permission to delete this resume." },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { success: true, message: "Resume and associated file deleted successfully." },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to delete resume."
      },
      { status: 500 }
    )
  }
}
