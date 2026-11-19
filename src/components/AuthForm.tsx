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
  const [showPassword, setShowPassword] = useState(false)

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
    <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl sm:p-8">
      {/* Product Branding & Description */}
      <div className="text-center flex flex-col items-center gap-2">
        <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-bold text-white shadow-sm">
          ✦
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-950">AI Career Copilot</h1>
        <p className="max-w-xs text-xs leading-relaxed text-slate-600">A focused workspace for your resume, target roles, and interview practice.</p>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <span className="text-sm font-bold text-slate-950">{isLogin ? "Sign in" : "Create account"}</span>
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin)
              setError("")
            }}
            className="text-xs font-semibold text-indigo-700 hover:text-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
          >
            {isLogin ? "Create account" : "Sign in instead"}
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
            <label className="mb-1 block text-[11px] font-medium text-slate-700">Your name</label>
            <input
              type="text"
              required
              placeholder="e.g. Alex Morgan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-stone-300 bg-white p-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-700">Email address</label>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-stone-300 bg-white p-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-700">Password</label><div className="relative"><input
              type={showPassword ? "text" : "password"}
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-stone-300 bg-white p-3 pr-14 text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
            /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-semibold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">{showPassword ? "Hide" : "Show"}</button></div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-1 w-full rounded-lg bg-indigo-600 p-3 text-sm font-semibold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? "Processing..." : isLogin ? "Sign In" : "Create Account"}
        </button>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-stone-200" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase">
            <span className="bg-white px-2 font-mono text-slate-400">Or continue with</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white p-3 text-sm font-semibold text-slate-700 transition hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <span>G</span>
          <span>Google Account</span>
        </button>
      </form>
    </div>
  )
}
