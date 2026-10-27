"use client"

import { useState } from "react"
import { signOut } from "next-auth/react"

export type NavigationTab =
  | "dashboard"
  | "resumes"
  | "jobs"
  | "applications"
  | "recommendations"

interface NavbarProps {
  user?: {
    name?: string | null
    email?: string | null
    image?: string | null
  } | null
  activeTab?: NavigationTab
  onTabChange?: (tab: NavigationTab) => void
  searchQuery?: string
  onSearchChange?: (q: string) => void
}

const NAV_ITEMS: Array<{ id: NavigationTab; label: string; icon: string }> = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "resumes", label: "My Resumes", icon: "📄" },
  { id: "jobs", label: "Job Matches", icon: "🎯" },
  { id: "applications", label: "Applications", icon: "📋" },
  { id: "recommendations", label: "Career Recommendations", icon: "💡" }
]

export default function Navbar({
  user,
  activeTab = "dashboard",
  onTabChange,
  searchQuery = "",
  onSearchChange
}: NavbarProps) {
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

    window.location.href = "/"
  }

  const initial = user?.name ? user.name.charAt(0).toUpperCase() : "U"

  return (
    <header className="sticky top-0 z-40 w-full bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand & Logo */}
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => {
              if (onTabChange) onTabChange("dashboard")
            }}
            className="flex items-center gap-2.5 text-left group"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shadow-sm group-hover:scale-105 transition">
              ✦
            </div>
            <div>
              <span className="text-base font-bold text-white tracking-tight block">
                AI Career Copilot
              </span>
              <span className="text-[10px] text-emerald-400 font-mono tracking-wider block">
                INTELLIGENT SUITE
              </span>
            </div>
          </button>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (onTabChange) onTabChange(item.id)
                  }}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                    isActive
                      ? "bg-neutral-800 text-white shadow-sm border border-neutral-700/80"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-900"
                  }`}
                >
                  <span className="text-sm opacity-80">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Search & Profile Area */}
        <div className="flex items-center gap-3">
          {/* Functional Search Bar */}
          <div className="relative hidden md:block">
            <span className="absolute left-3 top-2.5 text-neutral-500 text-xs">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                if (onSearchChange) onSearchChange(e.target.value)
              }}
              placeholder="Search jobs, skills, roles..."
              className="w-48 lg:w-64 bg-neutral-900 border border-neutral-800 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 focus:w-72 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  if (onSearchChange) onSearchChange("")
                }}
                className="absolute right-2.5 top-2.5 text-neutral-500 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-900 border border-neutral-800"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>

          {/* User Profile Menu */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="w-9 h-9 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center font-bold text-xs text-white hover:border-neutral-600 transition"
              aria-label="User account menu"
            >
              {user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image}
                  alt={user.name ?? "User avatar"}
                  className="w-9 h-9 rounded-xl object-cover"
                />
              ) : (
                initial
              )}
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-4 py-3 border-b border-neutral-800">
                  <p className="text-xs font-bold text-white truncate">
                    {user?.name || "Professional"}
                  </p>
                  {user?.email && (
                    <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                      {user.email}
                    </p>
                  )}
                </div>

                <div className="p-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false)
                      if (onTabChange) onTabChange("resumes")
                    }}
                    className="w-full text-left text-xs text-neutral-300 hover:text-white hover:bg-neutral-800 px-3 py-2 rounded-xl transition flex items-center gap-2"
                  >
                    <span>📄</span> My Resumes
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false)
                      if (onTabChange) onTabChange("applications")
                    }}
                    className="w-full text-left text-xs text-neutral-300 hover:text-white hover:bg-neutral-800 px-3 py-2 rounded-xl transition flex items-center gap-2"
                  >
                    <span>📋</span> Application Pipeline
                  </button>

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

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-neutral-800 bg-neutral-950 p-4 flex flex-col gap-3">
          {/* Mobile Search */}
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-neutral-500 text-xs">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                if (onSearchChange) onSearchChange(e.target.value)
              }}
              placeholder="Search jobs, skills, roles..."
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-8 pr-7 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none"
            />
          </div>

          <nav className="flex flex-col gap-1 pt-1">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    if (onTabChange) onTabChange(item.id)
                  }}
                  className={`text-xs font-semibold px-3 py-2.5 rounded-xl transition flex items-center gap-2.5 text-left ${
                    isActive
                      ? "bg-neutral-800 text-white border border-neutral-700"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-900"
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      )}
    </header>
  )
}
