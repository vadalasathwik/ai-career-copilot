import {
  NextRequest,
  NextResponse
} from "next/server"

import {
  loginService
} from "@/backend/services/loginService"

import { generateToken } from "@/backend/auth/jwt"

export async function POST(
  request: NextRequest
) {

  try {

    const body =
      await request.json()

    const user =
      await loginService(
        body.email,
        body.password
      )

const token = generateToken(
  user.id
)

const response =
  NextResponse.json(
    {
      success: true,
      user
    },
    {
      status: 200
    }
  )

response.cookies.set(
  "token",
  token,
  {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  }
)

console.log("TOKEN GENERATED:", token)

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
      {
        status: 400
      }
    )

  }

}