import { NextRequest, NextResponse } from "next/server"
import { authenticateApiUser } from "@/backend/auth/session"
import { processAndSaveResume } from "@/backend/services/resumeService"

export async function POST(request: NextRequest) {
  const auth = await authenticateApiUser()
  if (auth.errorResponse) {
    return auth.errorResponse
  }
  const user = auth.user

  try {
    const formData = await request.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: "No file was provided in the upload request." },
        { status: 400 }
      )
    }

    if (file.size === 0) {
      return NextResponse.json(
        { success: false, message: "The uploaded file is empty." },
        { status: 400 }
      )
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, message: "The file exceeds the maximum allowed size of 5 MB." },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const resume = await processAndSaveResume({
      buffer,
      originalName: file.name,
      userId: user.id
    })

    return NextResponse.json(
      {
        success: true,
        message: "Resume uploaded and text extracted successfully.",
        resume
      },
      { status: 201 }
    )
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to process resume upload."
      },
      { status: 400 }
    )
  }
}
