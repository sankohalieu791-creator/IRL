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
  rank?: number
}

type Community = {
  id: string
  name: string
  total_lp: number
  member_count?: number
}

export default function Leaderboard() {
  const router = useRouter()
  const [users, setUsers] = useState<LeaderboardUser[]>([])
  const [communities, setCommunities] = useState<Community[]>([])
  const [currentUser, setCurrentUser] = useState("")
  const [activeTab, setActiveTab] = useState<"solo" | "community">("solo")
  const [resetTimer, setResetTimer] = useState<string>("")

  useEffect(() => {
    const u = getUser()
    if (u) setCurrentUser(u)
    loadLeaderboard()
    loadCommunities()
    loadResetTimer()
  }, [])

  useEffect(() => {
    const interval = setInterval(loadResetTimer, 1000)
    return () => clearInterval(interval)
  }, [])

  async function loadLeaderboard() {
    const { data } = await supabase
      .from("leaderboard")
      .select("*")
      .order("points", { ascending: false })
      .limit(50)

    if (!data) return

    const withSessions = await Promise.all(
      data.map(async (u, i) => {
        const { count } = await supabase
          .from("session_attempts")
          .select("*", { count: "exact", head: true })
          .eq("user_name", u.user_name)
          .eq("status", "accepted")
        return { ...u, session_count: count || 0, rank: i + 1 }
      })
    )

    setUsers(withSessions)
  }

  async function loadCommunities() {
    const { data } = await supabase
      .from("communities")
      .select("*")
      .order("total_lp", { ascending: false })
      .limit(50)

    if (!data) return

    const withCounts = await Promise.all(
      data.map(async (c) => {
        const { count } = await supabase
          .from("community_members")
          .select("*", { count: "exact", head: true })
          .eq("community_id", c.id)
          .eq("status", "accepted")
        return { ...c, member_count: count || 0 }
      })
    )

    setCommunities(withCounts)
  }

  function loadResetTimer() {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const daysUntilMonday = (1 - dayOfWeek + 7) % 7 || 7

    const nextReset = new Date(now)
    nextReset.setDate(nextReset.getDate() + daysUntilMonday)
    nextReset.setHours(0, 0, 0, 0)

    if (daysUntilMonday === 0 && now.getHours() === 0 && now.getMinutes() < 1) {
      nextReset.setDate(nextReset.getDate() + 14)
    }

    const diff = nextReset.getTime() - now.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
    const minutes = Math.floor((diff / 1000 / 60) % 60)
    const seconds = Math.floor((diff / 1000) % 60)

    setResetTimer(`${days}d ${hours}h ${minutes}m`)
  }

  const medals = ["🥇", "🥈", "🥉"]
  const topThree = users.slice(0, 3)
  const top5to50 = users.slice(3, 50)

  return (
    <div className="flex flex-col h-full bg-black text-white overflow-hidden">
      <main className="flex flex-col flex-1 overflow-y-auto pb-16 p-6 space-y-4">

        {/* HEADER */}
        <button
          onClick={() => router.push("/sessions")}
          className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm w-fit"
        >
          ← Back to Sessions
        </button>

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-cyan-400">Leaderboard 🏆</h1>
          <div style={{
            background: "rgba(0,212,255,0.1)",
            border: "1px solid rgba(0,212,255,0.3)",
            borderRadius: 10, padding: "6px 12px",
            textAlign: "center", fontSize: 12, fontWeight: 700
          }}>
            <div style={{ color: "#00D4FF", fontSize: 11, marginBottom: 2 }}>Resets in</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 10 }}>{resetTimer}</div>
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-2">
          {(["solo", "community"] as const).map(tab => (
            <button key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2.5 px-4 rounded-xl text-sm font-bold transition-colors ${
                activeTab === tab
                  ? "bg-gradient-to-r from-purple-500 to-cyan-400 text-white"
                  : "bg-zinc-800 text-zinc-400"
              }`}
            >
              {tab === "solo" ? "👤 Solo" : "👥 Community"}
            </button>
          ))}
        </div>

        {activeTab === "solo" && (
          <>
            {/* TOP 3 - VISUAL DISPLAY */}
            {topThree.length > 0 && (
              <div style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 20, padding: 24,
                display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 16,
                minHeight: 280, position: "relative"
              }}>
                {/* Rank 2 (Silver) */}
                {topThree[1] && (
                  <div style={{
                    flex: 1, display: "flex", flexDirection: "column",
                    alignItems: "center", gap: 12, height: 200
                  }}>
                    <div style={{
                      width: 80, height: 80, borderRadius: "50%",
                      background: "linear-gradient(135deg, #c0c0c0, #e8e8e8)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 36, fontWeight: 900, border: "3px solid #c0c0c0"
                    }}>
                      {topThree[1].user_name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{
                        background: "rgba(192,192,192,0.15)",
                        border: "2px solid #c0c0c0",
                        borderRadius: 12, padding: "8px 16px",
                        marginBottom: 8
                      }}>
                        <p style={{ fontSize: 32, fontWeight: 900 }}>🥈</p>
                      </div>
                      <p style={{ color: "white", fontWeight: 800, fontSize: 14 }}>{topThree[1].user_name}</p>
                      <p style={{ color: "#c0c0c0", fontWeight: 700, fontSize: 16, marginTop: 4 }}>
                        {topThree[1].points} LP
                      </p>
                    </div>
                  </div>
                )}

                {/* Rank 1 (Gold) */}
                {topThree[0] && (
                  <div style={{
                    flex: 1, display: "flex", flexDirection: "column",
                    alignItems: "center", gap: 12, height: 250
                  }}>
                    <div style={{
                      width: 90, height: 90, borderRadius: "50%",
                      background: "linear-gradient(135deg, #FFD700, #FFA500)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 40, fontWeight: 900, border: "3px solid #FFD700"
                    }}>
                      {topThree[0].user_name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{
                        background: "rgba(255,215,0,0.2)",
                        border: "2px solid #FFD700",
                        borderRadius: 12, padding: "8px 16px",
                        marginBottom: 8
                      }}>
                        <p style={{ fontSize: 36, fontWeight: 900 }}>🥇</p>
                      </div>
                      <p style={{ color: "white", fontWeight: 800, fontSize: 16 }}>{topThree[0].user_name}</p>
                      <p style={{ color: "#FFD700", fontWeight: 700, fontSize: 18, marginTop: 4 }}>
                        {topThree[0].points} LP
                      </p>
                    </div>
                  </div>
                )}

                {/* Rank 3 (Bronze) */}
                {topThree[2] && (
                  <div style={{
                    flex: 1, display: "flex", flexDirection: "column",
                    alignItems: "center", gap: 12, height: 180
                  }}>
                    <div style={{
                      width: 70, height: 70, borderRadius: "50%",
                      background: "linear-gradient(135deg, #CD7F32, #d4844f)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 32, fontWeight: 900, border: "3px solid #CD7F32"
                    }}>
                      {topThree[2].user_name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{
                        background: "rgba(205,127,50,0.15)",
                        border: "2px solid #CD7F32",
                        borderRadius: 12, padding: "8px 16px",
                        marginBottom: 8
                      }}>
                        <p style={{ fontSize: 28, fontWeight: 900 }}>🥉</p>
                      </div>
                      <p style={{ color: "white", fontWeight: 800, fontSize: 12 }}>{topThree[2].user_name}</p>
                      <p style={{ color: "#CD7F32", fontWeight: 700, fontSize: 14, marginTop: 4 }}>
                        {topThree[2].points} LP
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TOP 5-50 LIST */}
            <div className="space-y-2">
              <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>
                Top 5 and Beyond
              </p>
              {top5to50.map((u, i) => (
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
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%",
                      background: "linear-gradient(135deg, #B400FF, #00D4FF)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, fontWeight: 900, color: "white", flexShrink: 0
                    }}>
                      {u.user_name.charAt(0).toUpperCase()}
                    </div>

                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ color: "white", fontWeight: 700, fontSize: 14 }}>
                          #{i + 4} {u.user_name}
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
            </div>
          </>
        )}

        {activeTab === "community" && (
          <div className="space-y-2">
            {communities.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <p style={{ fontSize: 32, marginBottom: 8 }}>👥</p>
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No communities yet</p>
              </div>
            )}

            {communities.map((c, i) => (
              <div
                key={c.id}
                className={`rounded-xl p-4 flex justify-between items-center border transition-opacity ${
                  i === 0 ? "bg-yellow-500/10 border-yellow-500/40" :
                  i === 1 ? "bg-zinc-400/10 border-zinc-400/40" :
                  i === 2 ? "bg-orange-500/10 border-orange-500/40" :
                  "bg-zinc-900 border-zinc-800"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: "linear-gradient(135deg, #B400FF, #00D4FF)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 900, color: "white", flexShrink: 0
                  }}>
                    {c.name.charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ color: "white", fontWeight: 700, fontSize: 14 }}>
                        {i < 3 ? medals[i] : `#${i + 1}`} {c.name}
                      </span>
                    </div>
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>
                      {c.member_count} members
                    </p>
                  </div>
                </div>

                <span style={{ color: "#00D4FF", fontWeight: 700, fontSize: 15 }}>
                  {c.total_lp} LP
                </span>
              </div>
            ))}
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}