import bcrypt from "bcryptjs"
import { findUserByEmail } from "@/backend/repositories/userRepository"

export async function loginService(
  email: string,
  password: string
) {
  if (!email || !password) {
    throw new Error("Email and password are required")
  }

  const user = await findUserByEmail(email)

  if (!user) {
    throw new Error("Invalid email or password")
  }

  if (!user.password) {
    throw new Error("This account is registered with Google. Please sign in with Google.")
  }

  const isValidPassword = await bcrypt.compare(
    password,
    user.password
  )

  if (!isValidPassword) {
    throw new Error("Invalid email or password")
  }

  return user
}
