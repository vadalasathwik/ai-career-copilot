import { NextRequest, NextResponse } from "next/server"
import { authenticateApiUser } from "@/backend/auth/session"
import { processAndSaveResume, ResumeInputError } from "@/backend/services/resumeService"

export async function POST(request: NextRequest) {
  const auth = await authenticateApiUser()
  if (auth.errorResponse) {
    return auth.errorResponse
  }
  const user = auth.user

  try {
    const formData = await request.formData()
    // The workspace submits `resume`; keep `file` for existing API clients/tests.
    const file = formData.get("resume") ?? formData.get("file")

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
    if (error instanceof ResumeInputError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      )
    }

    // Do not expose storage/database details or document contents to the client.
    console.error("[resume-upload] Unexpected processing failure", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : "Unknown error"
    })
    return NextResponse.json(
      {
        success: false,
        message: "We could not save your resume right now. Please try again."
      },
      { status: 500 }
    )
  }
}
