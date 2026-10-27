import { NextRequest, NextResponse } from "next/server"
import { loginService } from "@/backend/services/loginService"
import { generateToken } from "@/backend/auth/jwt"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body?.email || !body?.password) {
      return NextResponse.json(
        {
          success: false,
          message: "Email and password are required"
        },
        { status: 400 }
      )
    }

    const user = await loginService(body.email, body.password)
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
      { status: 200 }
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
            : "Login failed"
      },
      { status: 400 }
    )
  }
}
