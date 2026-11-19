"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"

interface NavbarProps {
  user?: {
    name?: string | null
    email?: string | null
    image?: string | null
  } | null
}

export default function Navbar({ user }: NavbarProps) {
  const pathname = usePathname()
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  async function handleLogout() {
    try {
      await fetch("/api/logout", {
        method: "POST"
      })
    } catch {
      // Continue even if local cookie invalidation encounters an issue
    }

    try {
      await signOut({
        redirect: false
      })
    } catch {
      // Continue
    }

    window.location.href = "/auth"
  }

  const initial = user?.name ? user.name.charAt(0).toUpperCase() : "U"
  const isWorkspace = pathname === "/" || pathname === "/dashboard"

  return (
    <header className="sticky top-0 z-40 w-full bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand & Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shadow-sm group-hover:scale-105 transition">
              ✦
            </div>
            <div>
              <span className="text-base font-bold text-white tracking-tight block">
                AI Career Copilot
              </span>
            </div>
          </Link>

          {/* Primary Navigation Item: Workspace */}
          <nav className="hidden sm:flex items-center gap-1">
            <Link
              href="/"
              className={`text-xs font-semibold px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                isWorkspace
                  ? "bg-neutral-800 text-white shadow-sm border border-neutral-700/80"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-900"
              }`}
            >
              <span>⚡</span>
              <span>Workspace</span>
            </Link>
          </nav>
        </div>

        {/* User Profile Menu & Mobile Toggle */}
        <div className="flex items-center gap-3">
          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-900 border border-neutral-800"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>

          {/* User Profile Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2.5 p-1 rounded-full hover:ring-2 hover:ring-neutral-700 transition"
              aria-label="User account menu"
            >
              {user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image}
                  alt={user.name || "User"}
                  className="w-8 h-8 rounded-full border border-neutral-700 object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xs font-bold text-emerald-400">
                  {initial}
                </div>
              )}
              <span className="hidden md:block text-xs font-medium text-neutral-300 max-w-[120px] truncate">
                {user?.name || "Account"}
              </span>
              <span className="text-[10px] text-neutral-500 hidden md:block">▼</span>
            </button>

            {/* Profile Dropdown Menu */}
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-2 border-b border-neutral-800">
                  <p className="text-xs font-semibold text-white truncate">
                    {user?.name || "User"}
                  </p>
                  <p className="text-[11px] text-neutral-400 truncate">
                    {user?.email || ""}
                  </p>
                </div>

                <div className="pt-1 flex flex-col gap-0.5">
                  <Link
                    href="/profile"
                    onClick={() => setProfileOpen(false)}
                    className="w-full text-left text-xs text-neutral-300 hover:text-white hover:bg-neutral-800 px-3 py-2 rounded-xl transition flex items-center gap-2"
                  >
                    <span>👤</span> Profile
                  </Link>

                  <div className="my-1 border-t border-neutral-800" />

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 px-3 py-2 rounded-xl transition flex items-center gap-2"
                  >
                    <span>🚪</span> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-neutral-800 bg-neutral-950 p-4 flex flex-col gap-2">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className={`text-xs font-semibold px-3.5 py-2.5 rounded-xl transition flex items-center gap-2 ${
              isWorkspace
                ? "bg-neutral-800 text-white"
                : "text-neutral-400 hover:text-white hover:bg-neutral-900"
            }`}
          >
            <span>⚡</span> Workspace
          </Link>

          <Link
            href="/profile"
            onClick={() => setMobileMenuOpen(false)}
            className={`text-xs font-semibold px-3.5 py-2.5 rounded-xl transition flex items-center gap-2 ${
              pathname === "/profile"
                ? "bg-neutral-800 text-white"
                : "text-neutral-400 hover:text-white hover:bg-neutral-900"
            }`}
          >
            <span>👤</span> Profile
          </Link>

          <div className="border-t border-neutral-800 my-1" />

          <button
            type="button"
            onClick={handleLogout}
            className="w-full text-left text-xs font-semibold text-rose-400 hover:bg-rose-950/40 px-3.5 py-2.5 rounded-xl transition flex items-center gap-2"
          >
            <span>🚪</span> Sign Out
          </button>
        </div>
      )}
    </header>
  )
}
