"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { signIn, useSession } from "next-auth/react"

export default function AuthForm() {
  const router = useRouter()
  const { data: session } = useSession()

  useEffect(() => {
    if (session) {
      router.push("/")
    }
  }, [session, router])

  const [isLogin, setIsLogin] = useState(true)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const endpoint = isLogin ? "/api/login" : "/api/signup"
      const payload = isLogin ? { email, password } : { name, email, password }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Authentication failed")
      }

      router.push("/")
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-neutral-900/90 border border-neutral-800 p-8 sm:p-10 rounded-3xl w-full max-w-md flex flex-col gap-6 shadow-2xl">
      {/* Product Branding & Description */}
      <div className="text-center flex flex-col items-center gap-2">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-cyan-500 flex items-center justify-center text-white font-bold text-xl shadow-sm mb-1">
          ✦
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">AI Career Copilot</h1>
        <p className="text-xs text-neutral-400 max-w-xs leading-relaxed">
          Minimal resume quality auditor, job-description matcher, and career recommendation tool.
        </p>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
          <span className="text-sm font-bold text-white">{isLogin ? "Sign In" : "Create Account"}</span>
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin)
              setError("")
            }}
            className="text-xs text-emerald-400 hover:text-emerald-300 transition"
          >
            {isLogin ? "Need an account? Signup" : "Already registered? Login"}
          </button>
        </div>

        {error && (
          <div className="bg-rose-950/80 border border-rose-800 text-rose-300 text-xs p-3 rounded-xl flex items-center justify-between">
            <span>⚠️ {error}</span>
            <button type="button" onClick={() => setError("")} className="text-rose-400 font-bold ml-2">
              ✕
            </button>
          </div>
        )}

        {!isLogin && (
          <div>
            <label className="block text-[11px] font-medium text-neutral-400 mb-1">Your Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Alex Morgan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 p-3 rounded-xl text-xs text-white placeholder-neutral-500 outline-none focus:border-neutral-600"
            />
          </div>
        )}

        <div>
          <label className="block text-[11px] font-medium text-neutral-400 mb-1">Email Address</label>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 p-3 rounded-xl text-xs text-white placeholder-neutral-500 outline-none focus:border-neutral-600"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-neutral-400 mb-1">Password</label>
          <input
            type="password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 p-3 rounded-xl text-xs text-white placeholder-neutral-500 outline-none focus:border-neutral-600"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-white hover:bg-neutral-200 text-black p-3 rounded-xl font-semibold text-xs transition duration-200 mt-1 disabled:opacity-50"
        >
          {loading ? "Processing..." : isLogin ? "Sign In" : "Create Account"}
        </button>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-neutral-800" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase">
            <span className="bg-neutral-900 px-2 text-neutral-500 font-mono">Or continue with</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="w-full bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 p-3 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2"
        >
          <span>G</span>
          <span>Google Account</span>
        </button>
      </form>
    </div>
  )
}
