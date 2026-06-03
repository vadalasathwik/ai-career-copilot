import bcrypt from "bcryptjs"

import {
  createUser,
  findUserByEmail
} from "@/backend/repositories/userRepository"

import {
  signupSchema,
  SignupInput
} from "@/backend/validations/signupSchema"

export async function signupService(data: SignupInput) {

  const validatedData = signupSchema.parse(data)

  const existingUser = await findUserByEmail(
    validatedData.email
  )

  if (existingUser) {
    throw new Error("Email already exists")
  }

  const hashedPassword = await bcrypt.hash(
    validatedData.password,
    10
  )

  const user = await createUser(
    validatedData.name,
    validatedData.email,
    hashedPassword
  )

  return user
}