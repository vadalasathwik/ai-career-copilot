import { NextResponse } from "next/server"
import { z } from "zod"
import { authenticateApiUser } from "@/backend/auth/session"
import { fetchJobContentFromUrl } from "@/backend/services/jobUrlService"

const fetchUrlSchema = z.object({
  url: z.string({ message: "A valid job URL is required." }).trim().url("Please enter a valid HTTP or HTTPS URL.")
})

export async function POST(req: Request) {
  const auth = await authenticateApiUser()
  if (auth.errorResponse) {
    return auth.errorResponse
  }

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON request body." },
      { status: 400 }
    )
  }

  const validation = fetchUrlSchema.safeParse(rawBody)
  if (!validation.success) {
    const errorMsg = validation.error.issues[0]?.message || "Invalid URL parameter."
    return NextResponse.json(
      { success: false, message: errorMsg },
      { status: 400 }
    )
  }

  try {
    const result = await fetchJobContentFromUrl(validation.data.url)
    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        canPasteManually: true,
        message: err instanceof Error ? err.message : "Failed to retrieve job content from URL."
      },
      { status: 500 }
    )
  }
}
