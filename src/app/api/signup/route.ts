import { NextRequest, NextResponse } from "next/server"

import { signupService } from "../../../backend/services/signupService"
export async function POST(
  request: NextRequest
) {

  try {

    console.log("API HIT")

    const body = await request.json()

    console.log("BODY:", body)

    const user = await signupService(body)

    console.log("USER CREATED:", user)

    return NextResponse.json(
      {
        success: true,
        user
      },
      {
        status: 201
      }
    )

  } catch (error) {

    console.error("SIGNUP ERROR:", error)

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Something went wrong"
      },
      {
        status: 400
      }
    )

  }

}