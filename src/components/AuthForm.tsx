"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { useSession } from "next-auth/react"
import { useEffect } from "react"

export default function AuthForm() {

  const router = useRouter()

  const { data: session } = useSession()

useEffect(() => {
  if (session) {
    router.push("/dashboard")
  }
}, [session, router])

  const [isLogin, setIsLogin] = useState(true)

  const [name, setName] = useState("")
const [email, setEmail] = useState("")
const [password, setPassword] = useState("")

const [loading, setLoading] = useState(false)
const [error, setError] = useState("")

async function handleSubmit() {

  setError("")
  setLoading(true)

  try {

    const endpoint = isLogin
      ? "/api/login"
      : "/api/signup"

    const payload = isLogin
      ? {
          email,
          password
        }
      : {
          name,
          email,
          password
        }

    const response = await fetch(
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    )

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message)
    }

    console.log("SUCCESS:", data)

    router.push("/dashboard")

  } catch (error) {

    setError(
      error instanceof Error
        ? error.message
        : "Something went wrong"
    )

  } finally {

    setLoading(false)

  }

}

  return (
    <div className="bg-neutral-900 p-8 rounded-2xl w-full max-w-md">



      <h1 className="text-3xl font-bold mb-6">
        {isLogin ? "Login" : "Signup"}
      </h1>

      <div className="flex flex-col gap-4">

        {error && (
  <p className="text-red-500 text-sm">
    {error}
  </p>
)}


        {!isLogin && (
<input
  type="text"
  placeholder="Name"
  value={name}
  onChange={(e) => setName(e.target.value)}
  className="bg-neutral-800 p-3 rounded-lg outline-none"
/>
        )}

      <input
  type="email"
  placeholder="Email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  className="bg-neutral-800 p-3 rounded-lg outline-none"
/>

<input
  type="password"
  placeholder="Password"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
  className="bg-neutral-800 p-3 rounded-lg outline-none"
/>

        <button
          onClick={handleSubmit}
          className="bg-white text-black p-3 rounded-lg font-semibold"
        >
{loading
  ? "Please wait..."
  : isLogin
    ? "Login"
    : "Signup"
}        </button>

        <button
          onClick={() => setIsLogin(!isLogin)}
          className="text-sm text-neutral-400"
        >
          {isLogin
            ? "Don't have an account? Signup"
            : "Already have an account? Login"}
        </button>


        <button
onClick={() =>
  signIn("google", {
    callbackUrl: "/dashboard"
  })
}
  className="
    bg-blue-600
    text-white
    p-3
    rounded-lg
  "
>
  Continue with Google
</button>

      </div>

    </div>
  )
}