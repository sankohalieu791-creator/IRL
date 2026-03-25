"use client"

import { usePathname, useRouter } from "next/navigation"

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()

  const tabs = [
    {
      href: "/hub",
      label: "Hub",
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#00D4FF" : "#71717a"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      )
    },
    {
      href: "/sessions",
      label: "Sessions",
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#00D4FF" : "#71717a"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
      )
    },
    {
      href: "/rewards",
      label: "Rewards",
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#00D4FF" : "#71717a"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="6"/>
          <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
        </svg>
      )
    },
    {
      href: "/profile",
      label: "Profile",
      icon: (active: boolean) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#00D4FF" : "#71717a"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      )
    },
  ]

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-zinc-950/95 border-t border-zinc-800 flex z-50">
      {tabs.map(tab => {
        const active = pathname === tab.href
        return (
          <button
            key={tab.href}
            onClick={() => router.push(tab.href)}
            className="flex-1 flex flex-col items-center justify-center py-2.5 gap-1"
          >
            {tab.icon(active)}
            <span className={`text-[10px] font-semibold ${active ? "text-cyan-400" : "text-zinc-500"}`}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}