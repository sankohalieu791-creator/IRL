"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import BottomNav from "@/components/BottomNav"
import { getUser } from "@/lib/auth"

type Reward = {
  id: string
  title: string
  points_required: number
  description?: string
  icon?: string
}

export default function Rewards() {
  const [user, setUser] = useState("")
  const [points, setPoints] = useState(0)
  const [sessionCount, setSessionCount] = useState(0)
  const [rewards, setRewards] = useState<Reward[]>([])
  const [claimed, setClaimed] = useState<string[]>([])
  const [claiming, setClaiming] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const u = getUser() || ""
    setUser(u)
  }, [])

  useEffect(() => {
    if (user) loadData()
  }, [user])

  async function loadData() {
    const { data: lb } = await supabase
      .from("leaderboard").select("points").eq("user_name", user)
      .order("points", { ascending: false }).limit(1).maybeSingle()
    if (lb) setPoints(lb.points)

    const { count: sc } = await supabase
      .from("session_attempts").select("*", { count: "exact", head: true })
      .eq("user_name", user).eq("status", "accepted")
    if (sc !== null) setSessionCount(sc)

    const { data: rewardsData } = await supabase
      .from("rewards").select("*").order("points_required", { ascending: true }).limit(25)
    if (rewardsData) setRewards(rewardsData)

    const { data: claimedData } = await supabase
      .from("user_rewards").select("reward_id").eq("user_name", user)
    if (claimedData) setClaimed(claimedData.map(r => r.reward_id))

    setLoading(false)
  }

  async function claimReward(rewardId: string, cost: number) {
    setClaiming(rewardId)
    const { data: userData } = await supabase
      .from("leaderboard").select("points").eq("user_name", user)
      .order("points", { ascending: false }).limit(1).maybeSingle()
    if (!userData) { setClaiming(null); return }
    await supabase.from("leaderboard").update({ points: userData.points - cost }).eq("user_name", user)
    await supabase.from("user_rewards").insert({ user_name: user, reward_id: rewardId })
    await loadData()
    setClaiming(null)
  }

  async function claimSessionReward(rewardId: string) {
    setClaiming(rewardId)
    await supabase.from("user_rewards").insert({ user_name: user, reward_id: rewardId })
    await loadData()
    setClaiming(null)
  }

  // Special session-based achievements
  const sessionAchievements = [
    {
      id: "irl-verified-founding",
      sessions: 20,
      title: "IRL Verified — Founding Member",
      description: "Complete 20 sessions to earn your permanent IRL Verified badge. Founding users only — this badge will never be available again.",
      isVerified: true,
    },
    {
      id: "irl-committed-10",
      sessions: 10,
      title: "IRL Committed",
      description: "10 sessions completed. You are showing up consistently.",
      isVerified: false,
    },
    {
      id: "irl-elite-50",
      sessions: 50,
      title: "IRL Elite",
      description: "50 sessions. You are in a different league.",
      isVerified: false,
    },
    {
      id: "irl-legend-100",
      sessions: 100,
      title: "IRL Legend",
      description: "100 sessions. Barely anyone gets here.",
      isVerified: false,
    },
  ]

  // Special recognition rewards (not claimable via LP, awarded manually by admin or auto)
  const recognitionRewards = [
    {
      id: "player-of-week",
      title: "Player of the Week 🏆",
      description: "Awarded by your institution to the most active student of the week.",
      icon: "🏆",
      color: "#FFD700",
      border: "rgba(255,215,0,0.4)"
    },
    {
      id: "best-sports-person",
      title: "Best Sport Person 🥇",
      description: "Recognised for outstanding sporting achievement.",
      icon: "🥇",
      color: "#FFD700",
      border: "rgba(255,215,0,0.4)"
    },
    {
      id: "most-improved",
      title: "Most Improved ⬆️",
      description: "Awarded for the biggest improvement in sessions this month.",
      icon: "⬆️",
      color: "#00D4FF",
      border: "rgba(0,212,255,0.4)"
    },
    {
      id: "community-champion",
      title: "Community Champion 🌍",
      description: "Recognised for inspiring others on the Hub.",
      icon: "🌍",
      color: "#B400FF",
      border: "rgba(180,0,255,0.4)"
    },
    {
      id: "consistency-king",
      title: "Consistency King 🔥",
      description: "Completed sessions every week for a full month.",
      icon: "🔥",
      color: "#FF6B35",
      border: "rgba(255,107,53,0.4)"
    },
    {
      id: "early-adopter",
      title: "Early Adopter ⚡",
      description: "One of the first students to join IRL at your institution.",
      icon: "⚡",
      color: "#00D4FF",
      border: "rgba(0,212,255,0.4)"
    },
  ]

  const claimedCount = claimed.length
  const nextReward = rewards.find(r => !claimed.includes(r.id))
  const progressToNext = nextReward ? Math.min((points / nextReward.points_required) * 100, 100) : 100

  return (
    <div className="flex flex-col h-full overflow-hidden bg-black text-white">

      <div className="flex-shrink-0 px-4 pt-4 pb-3">
        <h1 className="text-2xl font-bold text-cyan-400 mb-1">Rewards</h1>
        <p className="text-zinc-500 text-xs mb-3">Earn status. Get recognised. Prove yourself IRL.</p>

        {/* LP CARD */}
        <div className="rounded-2xl bg-gradient-to-br from-purple-900/60 via-zinc-900 to-cyan-900/40 border border-cyan-500/30 p-4 text-center mb-4">
          <p className="text-zinc-400 text-xs uppercase tracking-widest mb-1">Your LinkPoints</p>
          <span className="text-6xl font-black text-white block mb-1" style={{ textShadow: "0 0 30px rgba(0,212,255,0.4)" }}>
            {points}
          </span>
          <span className="text-cyan-400 font-bold text-xl">LP</span>
          <div className="w-16 h-0.5 bg-gradient-to-r from-purple-500 to-cyan-400 mx-auto my-3 rounded-full" />
          <div className="flex justify-center gap-6 mb-3">
            <div className="text-center">
              <p className="text-lg font-bold text-green-400">{claimedCount}</p>
              <p className="text-zinc-500 text-xs">Earned</p>
            </div>
            <div className="w-px bg-zinc-700" />
            <div className="text-center">
              <p className="text-lg font-bold text-cyan-400">{sessionCount}</p>
              <p className="text-zinc-500 text-xs">Sessions</p>
            </div>
            <div className="w-px bg-zinc-700" />
            <div className="text-center">
              <p className="text-lg font-bold text-purple-400">{rewards.length}</p>
              <p className="text-zinc-500 text-xs">LP Rewards</p>
            </div>
          </div>
          {!loading && nextReward && (
            <div>
              <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
                <span>Next LP reward: <span className="text-white font-semibold">{nextReward.title}</span></span>
                <span>{points}/{nextReward.points_required} LP</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2">
                <div className="bg-gradient-to-r from-purple-500 to-cyan-400 h-2 rounded-full transition-all duration-700"
                  style={{ width: `${progressToNext}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-20 space-y-6">

        {/* SESSION ACHIEVEMENTS */}
        <div>
          <p className="text-white font-bold text-sm mb-3">🎖️ Achievements</p>
          <div className="space-y-3">
            {sessionAchievements.map((a) => {
              const isClaimed = claimed.includes(a.id)
              const unlocked = sessionCount >= a.sessions
              const canClaim = unlocked && !isClaimed
              const progress = Math.min((sessionCount / a.sessions) * 100, 100)

              return (
                <div key={a.id} style={{
                  borderRadius: 16,
                  padding: 16,
                  background: isClaimed
                    ? "rgba(0,212,255,0.06)"
                    : unlocked
                    ? "rgba(180,0,255,0.06)"
                    : "rgba(255,255,255,0.02)",
                  border: isClaimed
                    ? "1px solid rgba(0,212,255,0.3)"
                    : unlocked
                    ? "1px solid rgba(180,0,255,0.3)"
                    : "1px solid rgba(255,255,255,0.07)",
                  opacity: isClaimed || unlocked ? 1 : 0.6
                }}>
                  <div className="flex items-start gap-3">

                    {/* Verified tick or lock */}
                    <div style={{
                      width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: isClaimed
                        ? "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(180,0,255,0.2))"
                        : unlocked
                        ? "rgba(180,0,255,0.15)"
                        : "rgba(255,255,255,0.05)",
                      border: isClaimed
                        ? "2px solid rgba(0,212,255,0.5)"
                        : unlocked
                        ? "2px solid rgba(180,0,255,0.4)"
                        : "2px solid rgba(255,255,255,0.08)",
                      boxShadow: isClaimed
                        ? "0 0 20px rgba(0,212,255,0.3), 0 0 40px rgba(180,0,255,0.2)"
                        : "none"
                    }}>
                      {a.isVerified ? (
                        // 3D style verification tick
                        <div style={{ position: "relative", width: 28, height: 28 }}>
                          <svg viewBox="0 0 24 24" width="28" height="28">
                            <defs>
                              <linearGradient id={`tick-${a.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#00D4FF" />
                                <stop offset="50%" stopColor="#B400FF" />
                                <stop offset="100%" stopColor="#00D4FF" />
                              </linearGradient>
                            </defs>
                            {isClaimed || unlocked ? (
                              <>
                                {/* Shadow/3D effect */}
                                <path d="M20 6L9 17l-5-5" stroke="rgba(0,0,0,0.4)" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" transform="translate(1,1)" />
                                {/* Main tick */}
                                <path d="M20 6L9 17l-5-5" stroke={`url(#tick-${a.id})`} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                              </>
                            ) : (
                              <text x="12" y="17" textAnchor="middle" fontSize="16" fill="rgba(255,255,255,0.2)">🔒</text>
                            )}
                          </svg>
                        </div>
                      ) : (
                        <span style={{ fontSize: 22 }}>
                          {isClaimed ? "✅" : unlocked ? "⭐" : "🔒"}
                        </span>
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-center gap-2 mb-1">
                        <p style={{ color: isClaimed ? "#00D4FF" : unlocked ? "white" : "rgba(255,255,255,0.35)", fontWeight: 800, fontSize: 13 }}>
                          {a.title}
                        </p>
                        {isClaimed && a.isVerified && (
                          <span style={{ background: "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(180,0,255,0.2))", border: "1px solid rgba(0,212,255,0.4)", color: "#00D4FF", fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 100, letterSpacing: 1 }}>
                            FOUNDING MEMBER
                          </span>
                        )}
                      </div>
                      <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, lineHeight: 1.4, marginBottom: 8 }}>
                        {a.description}
                      </p>
                      {/* Progress */}
                      <div className="flex items-center gap-2">
                        <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 100, overflow: "hidden" }}>
                          <div style={{
                            width: `${progress}%`, height: "100%",
                            background: isClaimed
                              ? "linear-gradient(to right, #00D4FF, #B400FF)"
                              : "linear-gradient(to right, #B400FF, #00D4FF)",
                            borderRadius: 100, transition: "width 0.6s ease"
                          }} />
                        </div>
                        <span style={{ color: isClaimed ? "#00D4FF" : "rgba(255,255,255,0.25)", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                          {Math.min(sessionCount, a.sessions)}/{a.sessions}
                        </span>
                      </div>
                    </div>

                    {/* Claim button */}
                    <div style={{ flexShrink: 0 }}>
                      {isClaimed ? (
                        <p style={{ color: "#00D4FF", fontSize: 11, fontWeight: 800 }}>EARNED ✓</p>
                      ) : canClaim ? (
                        <button
                          onClick={() => claimSessionReward(a.id)}
                          disabled={claiming === a.id}
                          style={{
                            padding: "8px 14px",
                            background: "linear-gradient(135deg, #00D4FF, #B400FF)",
                            border: "none", borderRadius: 10,
                            color: "white", fontWeight: 800, fontSize: 11,
                            cursor: "pointer",
                            boxShadow: "0 4px 16px rgba(0,212,255,0.3)"
                          }}
                        >
                          {claiming === a.id ? "..." : "CLAIM"}
                        </button>
                      ) : (
                        <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>{a.sessions - sessionCount} more</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* RECOGNITION AWARDS */}
        <div>
          <p className="text-white font-bold text-sm mb-1">🏆 Recognition Awards</p>
          <p className="text-zinc-600 text-xs mb-3">Awarded by your institution — you cannot claim these yourself.</p>
          <div className="space-y-3">
            {recognitionRewards.map((r) => {
              const isClaimed = claimed.includes(r.id)
              return (
                <div key={r.id} style={{
                  borderRadius: 16, padding: 16,
                  background: isClaimed ? `${r.color}08` : "rgba(255,255,255,0.02)",
                  border: `1px solid ${isClaimed ? r.border : "rgba(255,255,255,0.07)"}`,
                  opacity: isClaimed ? 1 : 0.5
                }}>
                  <div className="flex items-center gap-3">
                    <div style={{
                      width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 22,
                      background: isClaimed ? `${r.color}15` : "rgba(255,255,255,0.04)",
                      border: `2px solid ${isClaimed ? r.border : "rgba(255,255,255,0.08)"}`,
                      boxShadow: isClaimed ? `0 0 16px ${r.color}30` : "none"
                    }}>
                      {r.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: isClaimed ? "white" : "rgba(255,255,255,0.3)", fontWeight: 800, fontSize: 13, marginBottom: 3 }}>
                        {r.title}
                      </p>
                      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, lineHeight: 1.4 }}>
                        {r.description}
                      </p>
                    </div>
                    {isClaimed && (
                      <div style={{ flexShrink: 0 }}>
                        <p style={{ color: r.color, fontSize: 11, fontWeight: 800 }}>EARNED ✓</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* LP REWARDS */}
        <div>
          <p className="text-white font-bold text-sm mb-1">⚡ LP Rewards</p>
          <p className="text-zinc-600 text-xs mb-3">Spend your LinkPoints to claim these.</p>
          <div className="space-y-3">
            {rewards.map((reward, index) => {
              const isClaimed = claimed.includes(reward.id)
              const unlocked = points >= reward.points_required
              const isClaiming = claiming === reward.id
              const lpAway = reward.points_required - points

              return (
                <div key={reward.id} style={{
                  borderRadius: 16, padding: 16,
                  background: isClaimed ? "rgba(34,197,94,0.06)" : unlocked ? "rgba(0,212,255,0.04)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${isClaimed ? "rgba(34,197,94,0.3)" : unlocked ? "rgba(0,212,255,0.2)" : "rgba(255,255,255,0.07)"}`,
                  opacity: !unlocked && !isClaimed ? 0.55 : 1
                }}>
                  <div className="flex items-center gap-3">
                    <div style={{
                      width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                      background: isClaimed ? "rgba(34,197,94,0.15)" : unlocked ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${isClaimed ? "rgba(34,197,94,0.3)" : unlocked ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.07)"}`,
                    }}>
                      {isClaimed ? "✅" : !unlocked ? "🔒" : (reward.icon || "🏅")}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: isClaimed ? "#4ade80" : unlocked ? "white" : "rgba(255,255,255,0.4)", fontWeight: 700, fontSize: 13, marginBottom: 2 }}>
                        {reward.title}
                      </p>
                      {reward.description && (
                        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, lineHeight: 1.4, marginBottom: 4 }}>
                          {reward.description}
                        </p>
                      )}
                      <p style={{ color: isClaimed ? "rgba(74,222,128,0.5)" : unlocked ? "rgba(0,212,255,0.6)" : "rgba(255,255,255,0.2)", fontSize: 11, fontWeight: 700 }}>
                        ⚡ {reward.points_required} LP
                      </p>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: "center" }}>
                      {isClaimed ? (
                        <p style={{ color: "#4ade80", fontSize: 11, fontWeight: 800 }}>CLAIMED ✓</p>
                      ) : unlocked ? (
                        <button onClick={() => claimReward(reward.id, reward.points_required)} disabled={!!isClaiming}
                          style={{ padding: "8px 14px", background: "linear-gradient(135deg, #B400FF, #00D4FF)", border: "none", borderRadius: 10, color: "white", fontWeight: 800, fontSize: 11, cursor: "pointer" }}>
                          {isClaiming ? "..." : "CLAIM"}
                        </button>
                      ) : (
                        <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>{lpAway} LP away</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
      <BottomNav />
    </div>
  )
}