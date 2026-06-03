import bcrypt from "bcryptjs"

import { findUserByEmail }
from "@/backend/repositories/userRepository"

export async function loginService(
  email: string,
  password: string
) {

  const user = await findUserByEmail(email)

  if (!user) {
    throw new Error("User not found")
  }

  const isValidPassword =
    await bcrypt.compare(
      password,
      user.password
    )

  if (!isValidPassword) {
    throw new Error("Invalid password")
  }

  return user
}