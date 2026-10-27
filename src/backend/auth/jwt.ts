import jwt, { type JwtPayload } from "jsonwebtoken"

export interface LocalTokenPayload extends JwtPayload {
  userId: number
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.AUTH_SECRET
  if (!secret) {
    throw new Error("JWT_SECRET or AUTH_SECRET environment variable is required")
  }
  return secret
}

export function generateToken(userId: number): string {
  if (typeof userId !== "number" || isNaN(userId) || userId <= 0) {
    throw new Error("A valid numeric user ID is required to generate a token")
  }

  return jwt.sign(
    { userId },
    getJwtSecret(),
    {
      expiresIn: "7d"
    }
  )
}

export function verifyToken(token: string): LocalTokenPayload | null {
  if (!token || typeof token !== "string") {
    return null
  }

  try {
    const secret = getJwtSecret()
    const decoded = jwt.verify(token, secret)

    if (
      typeof decoded === "object" &&
      decoded !== null &&
      "userId" in decoded &&
      typeof (decoded as LocalTokenPayload).userId === "number" &&
      !isNaN((decoded as LocalTokenPayload).userId) &&
      (decoded as LocalTokenPayload).userId > 0
    ) {
      return decoded as LocalTokenPayload
    }

    return null
  } catch {
    return null
  }
}
