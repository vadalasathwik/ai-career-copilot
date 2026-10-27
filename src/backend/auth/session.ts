import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/backend/db/prisma"
import { verifyToken } from "@/backend/auth/jwt"

export interface AuthenticatedUser {
  id: number
  name: string
  email: string
  image: string | null
  provider: string
  providerId: string | null
}

const USER_SELECT_FIELDS = {
  id: true,
  name: true,
  email: true,
  image: true,
  provider: true,
  providerId: true
} as const

/**
 * Resolves the authenticated user on the server from either:
 * 1. Auth.js session (Google OAuth)
 * 2. Signed HTTP-only JWT cookie ('token')
 *
 * Always returns a validated database User record with password omitted.
 * Client-supplied IDs are never trusted.
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  try {
    // 1. Check Auth.js session (Google OAuth)
    const session = await auth()
    if (session?.user) {
      if (session.user.id) {
        const numericId = Number(session.user.id)
        if (!isNaN(numericId) && numericId > 0) {
          const user = await prisma.user.findUnique({
            where: { id: numericId },
            select: USER_SELECT_FIELDS
          })
          if (user) {
            return user
          }
        }
      }

      if (session.user.email) {
        const user = await prisma.user.findUnique({
          where: { email: session.user.email },
          select: USER_SELECT_FIELDS
        })
        if (user) {
          return user
        }
      }
    }

    // 2. Check local JWT cookie
    const cookieStore = await cookies()
    const token = cookieStore.get("token")?.value
    if (token) {
      const payload = verifyToken(token)
      if (payload?.userId) {
        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
          select: USER_SELECT_FIELDS
        })
        if (user) {
          return user
        }
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Helper for API routes to verify authentication.
 * Returns either { user } or { errorResponse } with HTTP 401.
 */
export async function authenticateApiUser(): Promise<
  { user: AuthenticatedUser; errorResponse?: never } | { user?: never; errorResponse: NextResponse }
> {
  const user = await getCurrentUser()
  if (!user) {
    return {
      errorResponse: NextResponse.json(
        {
          success: false,
          message: "Unauthorized. Please sign in to access this resource."
        },
        { status: 401 }
      )
    }
  }

  return { user }
}
