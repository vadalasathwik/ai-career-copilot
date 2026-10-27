import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Next.js 16 Proxy handler.
 * Performs fast edge-level route guarding for protected paths.
 * Full cryptographic and database verification takes place server-side
 * via getCurrentUser() in Server Components and Route Handlers.
 */
export function proxy(request: NextRequest) {
  const hasAuthJsSession =
    request.cookies.has("authjs.session-token") ||
    request.cookies.has("__Secure-authjs.session-token") ||
    request.cookies.has("next-auth.session-token") ||
    request.cookies.has("__Secure-next-auth.session-token")

  const hasLocalToken = request.cookies.has("token")

  if (!hasAuthJsSession && !hasLocalToken) {
    const loginUrl = new URL("/auth", request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const middleware = proxy

export const config = {
  matcher: ["/dashboard/:path*"]
}
