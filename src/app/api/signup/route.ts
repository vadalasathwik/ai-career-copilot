import { NextRequest, NextResponse } from "next/server"
import { signupService } from "@/backend/services/signupService"
import { generateToken } from "@/backend/auth/jwt"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const user = await signupService(body)
    const token = generateToken(user.id)

    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          provider: user.provider
        }
      },
      { status: 201 }
    )

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7
    })

    return response
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Something went wrong"
      },
      { status: 400 }
    )
  }
}
