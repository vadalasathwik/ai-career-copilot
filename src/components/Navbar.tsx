"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { signOut } from "next-auth/react"

interface NavbarProps {
  user?: {
    name?: string | null
    email?: string | null
    image?: string | null
  } | null
}

export default function Navbar({ user }: NavbarProps) {
  const [profileOpen, setProfileOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") setProfileOpen(false) }
    function closeOnOutside(event: MouseEvent) { if (!menuRef.current?.contains(event.target as Node)) setProfileOpen(false) }
    document.addEventListener("keydown", closeOnEscape); document.addEventListener("mousedown", closeOnOutside)
    return () => { document.removeEventListener("keydown", closeOnEscape); document.removeEventListener("mousedown", closeOnOutside) }
  }, [])

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
  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">✦</span><span className="truncate">AI Career Copilot</span></Link>
        <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex max-w-[12rem] items-center gap-2 rounded-lg px-2 py-1.5 text-slate-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="User account menu" aria-expanded={profileOpen} aria-haspopup="menu"
            >
              {user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image}
                  alt={user.name || "User"}
                  className="h-7 w-7 rounded-full border border-stone-200 object-cover"
                />
              ) : (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700">
                  {initial}
                </div>
              )}
              <span className="hidden max-w-[120px] truncate text-xs font-medium sm:block">
                {user?.name || "Account"}
              </span>
              <span className="text-[10px] text-slate-400">⌄</span>
            </button>

            {/* Profile Dropdown Menu */}
            {profileOpen && (
              <div role="menu" className="absolute right-0 mt-2 w-56 rounded-xl border border-stone-200 bg-white p-2 shadow-lg">
                <div className="border-b border-stone-100 px-3 py-2">
                  <p className="truncate text-xs font-semibold text-slate-900">
                    {user?.name || "User"}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">
                    {user?.email || ""}
                  </p>
                </div>

                <div className="pt-1 flex flex-col gap-0.5">
                  <Link
                    href="/profile"
                    onClick={() => setProfileOpen(false)}
                    role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-700 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <span>👤</span> Profile
                  </Link>

                  <div className="my-1 border-t border-stone-100" />

                  <button
                    type="button"
                    onClick={handleLogout}
                    role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-rose-700 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <span>🚪</span> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
      </div>
    </header>
  )
}
