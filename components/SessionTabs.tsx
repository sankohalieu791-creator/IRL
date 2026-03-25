"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export default function SessionTabs() {

  const path = usePathname()

  const tabs = [
    { name: "Sessions", href: "/sessions" },
    { name: "Groups", href: "/groups" },
    { name: "Leaderboard", href: "/leaderboard" }
  ]

  return (

    <div className="flex gap-2 mb-6">

      {tabs.map((tab) => {

        const active = path === tab.href

        return (
          <Link
            key={tab.name}
            href={tab.href}
            className={`px-4 py-2 rounded-full text-sm font-medium transition
            ${active
              ? "bg-gradient-to-r from-purple-500 to-cyan-400 text-white"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {tab.name}
          </Link>
        )

      })}

    </div>

  )
}