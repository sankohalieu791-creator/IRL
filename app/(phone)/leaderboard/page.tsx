"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import BottomNav from "@/components/BottomNav"
import { getUser } from "@/lib/auth"

type LeaderboardUser = {
  user_name: string
  school?: string
  points: number
  session_count?: number
}

export default function Leaderboard() {
  const router = useRouter()
  const [users, setUsers] = useState<LeaderboardUser[]>([])
  const [currentUser, setCurrentUser] = useState("")

  useEffect(() => {
    const u = getUser()
    if (u) setCurrentUser(u)
    loadLeaderboard()
  }, [])

  async function loadLeaderboard() {
    const { data } = await supabase
      .from("leaderboard")
      .select("*")
      .order("points", { ascending: false })
      .limit(20)

    if (!data) return

    // Get session counts for verified badges
    const withSessions = await Promise.all(
      data.map(async (u) => {
        const { count } = await supabase
          .from("session_attempts")
          .select("*", { count: "exact", head: true })
          .eq("user_name", u.user_name)
          .eq("status", "accepted")
        return { ...u, session_count: count || 0 }
      })
    )

    setUsers(withSessions)
  }

  const medals = ["🥇", "🥈", "🥉"]

  return (
    <div className="flex flex-col h-full bg-black text-white overflow-hidden">
      <main className="flex flex-col flex-1 overflow-y-auto pb-16 p-6 space-y-4">

        <button
          onClick={() => router.push("/sessions")}
          className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm w-fit"
        >
          ← Back to Sessions
        </button>

        <h1 className="text-2xl font-bold text-cyan-400">Leaderboard 🏆</h1>

        {users.map((u, i) => (
          <div
            key={`${u.user_name}-${i}`}
            onClick={() => router.push(`/user/${u.user_name}`)}
            style={{ cursor: "pointer" }}
            className={`rounded-xl p-4 flex justify-between items-center border transition-opacity active:opacity-70 ${
              i === 0 ? "bg-yellow-500/10 border-yellow-500/40" :
              i === 1 ? "bg-zinc-400/10 border-zinc-400/40" :
              i === 2 ? "bg-orange-500/10 border-orange-500/40" :
              "bg-zinc-900 border-zinc-800"
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "linear-gradient(135deg, #B400FF, #00D4FF)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 900, color: "white", flexShrink: 0,
                border: (u.session_count || 0) >= 20 ? "2px solid #00D4FF" : "2px solid transparent"
              }}>
                {u.user_name.charAt(0).toUpperCase()}
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ color: "white", fontWeight: 700, fontSize: 14 }}>
                    {i < 3 ? medals[i] : `#${i + 1}`} {u.user_name}
                  </span>
                  {(u.session_count || 0) >= 20 && (
                    <div style={{
                      background: "linear-gradient(135deg, #B400FF, #00D4FF)",
                      borderRadius: "50%", width: 16, height: 16,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, color: "white", fontWeight: 800
                    }}>
                      ✓
                    </div>
                  )}
                </div>
                {u.school && (
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{u.school}</p>
                )}
              </div>
            </div>

            <span style={{ color: "#00D4FF", fontWeight: 700, fontSize: 15 }}>
              {u.points} LP
            </span>
          </div>
        ))}

      </main>
      <BottomNav />
    </div>
  )
}