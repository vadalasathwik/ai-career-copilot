import Link from "next/link"

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-6">

      <h1 className="text-5xl font-bold">
        AI Job Agent
      </h1>

      <p className="text-neutral-400 text-lg">
        Find jobs smarter with AI
      </p>

      <Link
        href="/auth"
        className="
          bg-white
          text-black
          px-6
          py-3
          rounded-lg
          font-semibold
        "
      >
        Login / Signup
      </Link>

    </main>
  )
}