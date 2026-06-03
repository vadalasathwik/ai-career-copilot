"use client"

import { useState } from "react"
import { signOut } from "next-auth/react"

export default function Navbar() {

  const [open, setOpen] = useState(false)

async function handleLogout() {
  await signOut({
    redirect: false
  })

  window.location.href = "/"
}

  return (
    <nav className="w-full h-16 bg-neutral-900 text-white flex items-center justify-between px-6 border-b border-neutral-800">
      
      <h1 className="text-xl font-bold">
        AI Job Agent
      </h1>

      <div className="flex items-center gap-4">

        <input
          type="text"
          placeholder="Search..."
          className="bg-neutral-800 px-4 py-2 rounded-lg outline-none"
        />

<div className="relative">

  <button
    onClick={() => setOpen(!open)}
    className="
      w-10
      h-10
      rounded-full
      bg-neutral-700
      flex
      items-center
      justify-center
    "
  >
    P
  </button>

  {open && (
    <div
      className="
        absolute
        right-0
        mt-2
        w-40
        bg-neutral-900
        border
        border-neutral-700
        rounded-lg
        overflow-hidden
        z-50
      "
    >

      <button
        className="
          w-full
          text-left
          px-4
          py-2
          hover:bg-neutral-800
        "
      >
        Profile
      </button>

      <button
        onClick={handleLogout}
        className="
          w-full
          text-left
          px-4
          py-2
          hover:bg-neutral-800
          text-red-500
        "
      >
        Logout
      </button>

    </div>
  )}

</div>

      </div>

    </nav>
  )
}