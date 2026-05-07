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
  business_name?: string
  image_url?: string
  voucher_code?: string
  reward_type?: string
  created_by?: string
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

  // Session-based achievements
  const sessionAchievements = [
    {
      id: "irl-verified-founding",
      sessions: 20,
      title: "IRL Verified — Founding Member",
      description: "Complete 20 sessions. This badge is permanent and exclusive to founding users. It will never be available again.",
      isVerified: true,
      color: "#00D4FF",
    },
    {
      id: "irl-10-committed",
      sessions: 10,
      title: "IRL Committed",
      description: "10 sessions done. You are building a real habit.",
      color: "#C0C0C0",
    },
    {
      id: "irl-30-grinder",
      sessions: 30,
      title: "IRL Grinder",
      description: "30 sessions. You show up when others don't.",
      color: "#FFD700",
    },
    {
      id: "irl-50-elite",
      sessions: 50,
      title: "IRL Elite",
      description: "50 sessions. Top 1% of students on the platform.",
      color: "#B400FF",
    },
    {
      id: "irl-100-legend",
      sessions: 100,
      title: "IRL Legend",
      description: "100 sessions. Barely anyone gets here. You are built different.",
      color: "#FF6B35",
    },
  ]

  // Recognition awards — admin awards these
  const recognitionAwards = [
    {
      id: "player-of-week",
      title: "Player of the Week",
      description: "Awarded by your institution to the standout student of the week.",
      icon: "🏆",
      color: "#FFD700",
      glow: "rgba(255,215,0,0.3)",
    },
    {
      id: "best-sport-person",
      title: "Best Sport Person",
      description: "Recognised for outstanding sporting achievement at your institution.",
      icon: "🥇",
      color: "#FFD700",
      glow: "rgba(255,215,0,0.3)",
    },
    {
      id: "most-improved",
      title: "Most Improved",
      description: "Biggest improvement in activity and sessions over the past month.",
      icon: "📈",
      color: "#00D4FF",
      glow: "rgba(0,212,255,0.3)",
    },
    {
      id: "community-champion",
      title: "Community Champion",
      description: "Recognised for inspiring and lifting others in the IRL community.",
      icon: "🌍",
      color: "#B400FF",
      glow: "rgba(180,0,255,0.3)",
    },
    {
      id: "consistency-king",
      title: "Consistency King",
      description: "Completed sessions every single week for a full month without missing.",
      icon: "🔥",
      color: "#FF6B35",
      glow: "rgba(255,107,53,0.3)",
    },
    {
      id: "early-adopter",
      title: "Early Adopter",
      description: "One of the very first students to join IRL at your institution.",
      icon: "⚡",
      color: "#00D4FF",
      glow: "rgba(0,212,255,0.3)",
    },
    {
      id: "leader-of-the-month",
      title: "Leader of the Month",
      description: "Finished #1 on your institution's leaderboard for a full month.",
      icon: "👑",
      color: "#FFD700",
      glow: "rgba(255,215,0,0.3)",
    },
    {
      id: "team-player",
      title: "Team Player",
      description: "Recognised for outstanding teamwork and group participation.",
      icon: "🤝",
      color: "#4ade80",
      glow: "rgba(74,222,128,0.3)",
    },
  ]

  const claimedCount = claimed.length
  const nextReward = rewards.find(r => !claimed.includes(r.id))
  const progressToNext = nextReward
    ? Math.min((points / nextReward.points_required) * 100, 100)
    : 100

  // 3D Verified Badge SVG component
  function VerifiedBadge({ size = 52, earned = false }: { size?: number; earned?: boolean }) {
    return (
      <svg width={size} height={size} viewBox="0 0 52 52" fill="none">
        <defs>
          <linearGradient id="badge-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={earned ? "#0ea5e9" : "#27272a"} />
            <stop offset="50%" stopColor={earned ? "#B400FF" : "#3f3f46"} />
            <stop offset="100%" stopColor={earned ? "#67e8f9" : "#27272a"} />
          </linearGradient>
          <linearGradient id="badge-shine" x1="0%" y1="0%" x2="60%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id="tick-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e0f7ff" />
          </linearGradient>
          <filter id="badge-glow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="tick-shadow">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="rgba(0,0,0,0.4)" />
          </filter>
        </defs>

        {/* Outer glow ring */}
        {earned && (
          <circle cx="26" cy="26" r="25" fill="none"
            stroke="rgba(0,212,255,0.25)" strokeWidth="1.5" />
        )}

        {/* Shield/badge shape */}
        <path
          d="M26 3 L44 11 L44 28 C44 38 36 46 26 49 C16 46 8 38 8 28 L8 11 Z"
          fill="url(#badge-bg)"
          filter={earned ? "url(#badge-glow)" : "none"}
        />

        {/* 3D top highlight */}
        <path
          d="M26 5 L42 12.5 L42 14 L26 7 L10 14 L10 12.5 Z"
          fill="url(#badge-shine)"
          opacity="0.8"
        />

        {/* Inner shine */}
        <path
          d="M26 7 L40 14 L40 27 C40 35 34 42 26 45 C18 42 12 35 12 27 L12 14 Z"
          fill="rgba(255,255,255,0.06)"
        />

        {/* Tick mark */}
        {earned ? (
          <path
            d="M17 26 L23 32 L35 20"
            stroke="url(#tick-grad)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#tick-shadow)"
          />
        ) : (
          <path
            d="M20 26 L26 32 L32 20"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Bottom edge shadow for 3D depth */}
        <path
          d="M26 49 C16 46 8 38 8 28 L8 30 C8 40 16 47.5 26 50.5 C36 47.5 44 40 44 30 L44 28 C44 38 36 46 26 49 Z"
          fill="rgba(0,0,0,0.25)"
        />
      </svg>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-black text-white">

      <div className="flex-shrink-0 px-4 pt-4 pb-3">
        <h1 className="text-2xl font-bold text-cyan-400 mb-1">Rewards</h1>
        <p className="text-zinc-500 text-xs mb-3">Earn status. Get recognised. Prove yourself IRL.</p>

        {/* LP CARD */}
        <div className="rounded-[28px] bg-gradient-to-br from-purple-950/90 via-zinc-950 to-cyan-950/80 border border-cyan-500/20 p-3 text-center shadow-[0_30px_70px_rgba(0,0,0,0.35)]">
          <p className="text-zinc-400 text-[10px] uppercase tracking-[0.4em] mb-2">Your LinkPoints</p>
          <span className="text-5xl font-black text-white block mb-1"
            style={{ textShadow: "0 0 24px rgba(0,212,255,0.35)" }}>
            {points}
          </span>
          <span className="text-cyan-400 font-bold text-lg">LP</span>
          <div className="w-14 h-[3px] bg-gradient-to-r from-purple-500 to-cyan-400 mx-auto my-3 rounded-full" />
          <div className="grid grid-cols-3 gap-3 text-center mb-3">
            <div>
              <p className="text-base font-bold text-green-400">{claimedCount}</p>
              <p className="text-zinc-500 text-[11px] uppercase tracking-[0.18em]">Earned</p>
            </div>
            <div className="h-8 border-l border-r border-zinc-800" />
            <div>
              <p className="text-base font-bold text-cyan-400">{sessionCount}</p>
              <p className="text-zinc-500 text-[11px] uppercase tracking-[0.18em]">Sessions</p>
            </div>
            <div className="h-8 border-l border-zinc-800" />
            <div>
              <p className="text-base font-bold text-purple-400">{rewards.length}</p>
              <p className="text-zinc-500 text-[11px] uppercase tracking-[0.18em]">Rewards</p>
            </div>
          </div>
          {!loading && nextReward && (
            <div>
              <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
                <span>Next: <span className="text-white font-semibold">{nextReward.title}</span></span>
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

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-8">

        {/* ── SECTION 1: SESSION ACHIEVEMENTS ── */}
        <div>
          <div className="flex items-center gap-2 mb-4 mt-2">
            <div className="h-px flex-1 bg-zinc-800" />
            <p className="text-zinc-400 text-xs uppercase tracking-widest font-bold px-2">Achievements</p>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>

          <div className="space-y-3">
            {sessionAchievements.map((a) => {
              const isClaimed = claimed.includes(a.id)
              const unlocked = sessionCount >= a.sessions
              const canClaim = unlocked && !isClaimed
              const progress = Math.min((sessionCount / a.sessions) * 100, 100)

              return (
                <div key={a.id} style={{
                  borderRadius: 18,
                  padding: "14px 14px",
                  background: isClaimed
                    ? a.isVerified
                      ? "linear-gradient(135deg, rgba(0,212,255,0.08), rgba(180,0,255,0.08))"
                      : `${a.color}0A`
                    : unlocked
                    ? "rgba(255,255,255,0.03)"
                    : "rgba(255,255,255,0.015)",
                  border: isClaimed
                    ? a.isVerified
                      ? "1px solid rgba(0,212,255,0.35)"
                      : `1px solid ${a.color}40`
                    : unlocked
                    ? `1px solid ${a.color}30`
                    : "1px solid rgba(255,255,255,0.06)",
                  boxShadow: isClaimed && a.isVerified
                    ? "0 0 30px rgba(0,212,255,0.12), 0 0 60px rgba(180,0,255,0.08)"
                    : "none",
                  opacity: !unlocked && !isClaimed ? 0.55 : 1,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>

                    {/* Badge icon */}
                    <div style={{ flexShrink: 0 }}>
                      {a.isVerified ? (
                        <VerifiedBadge size={52} earned={isClaimed || unlocked} />
                      ) : (
                        <div style={{
                          width: 52, height: 52, borderRadius: "50%",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 24,
                          background: isClaimed ? `${a.color}18` : "rgba(255,255,255,0.04)",
                          border: `2px solid ${isClaimed ? a.color + "60" : "rgba(255,255,255,0.08)"}`,
                          boxShadow: isClaimed ? `0 0 18px ${a.color}30` : "none",
                        }}>
                          {isClaimed ? (
                            a.sessions === 10 ? "🔥" :
                            a.sessions === 30 ? "💪" :
                            a.sessions === 50 ? "👑" :
                            "🌟"
                          ) : "🔒"}
                        </div>
                      )}
                    </div>

                    {/* Text */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <p style={{
                          color: isClaimed ? (a.isVerified ? "#00D4FF" : "white") : unlocked ? "white" : "rgba(255,255,255,0.3)",
                          fontWeight: 800, fontSize: 13, lineHeight: 1.2
                        }}>
                          {a.title}
                        </p>
                        {isClaimed && a.isVerified && (
                          <span style={{
                            background: "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(180,0,255,0.2))",
                            border: "1px solid rgba(0,212,255,0.4)",
                            color: "#00D4FF", fontSize: 8, fontWeight: 800,
                            padding: "2px 7px", borderRadius: 100, letterSpacing: 1,
                            flexShrink: 0
                          }}>FOUNDING</span>
                        )}
                      </div>
                      <p style={{
                        color: "rgba(255,255,255,0.3)", fontSize: 11,
                        lineHeight: 1.4, marginBottom: 8
                      }}>
                        {a.description}
                      </p>
                      {/* Progress bar */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{
                          flex: 1, height: 3,
                          background: "rgba(255,255,255,0.07)",
                          borderRadius: 100, overflow: "hidden"
                        }}>
                          <div style={{
                            width: `${progress}%`, height: "100%",
                            background: isClaimed
                              ? a.isVerified
                                ? "linear-gradient(to right, #00D4FF, #B400FF)"
                                : `linear-gradient(to right, ${a.color}, ${a.color}aa)`
                              : "linear-gradient(to right, #B400FF, #00D4FF)",
                            borderRadius: 100,
                            transition: "width 0.7s ease"
                          }} />
                        </div>
                        <span style={{
                          color: isClaimed ? a.color : "rgba(255,255,255,0.2)",
                          fontSize: 10, fontWeight: 700, flexShrink: 0
                        }}>
                          {Math.min(sessionCount, a.sessions)}/{a.sessions}
                        </span>
                      </div>
                    </div>

                    {/* Action */}
                    <div style={{ flexShrink: 0, minWidth: 52, textAlign: "center" }}>
                      {isClaimed ? (
                        <p style={{
                          color: a.isVerified ? "#00D4FF" : a.color,
                          fontSize: 10, fontWeight: 800
                        }}>EARNED<br />✓</p>
                      ) : canClaim ? (
                        <button
                          onClick={() => claimSessionReward(a.id)}
                          disabled={claiming === a.id}
                          style={{
                            padding: "8px 12px",
                            background: a.isVerified
                              ? "linear-gradient(135deg, #00D4FF, #B400FF)"
                              : `linear-gradient(135deg, ${a.color}, ${a.color}cc)`,
                            border: "none", borderRadius: 10,
                            color: "white", fontWeight: 800,
                            fontSize: 11, cursor: "pointer",
                            boxShadow: a.isVerified
                              ? "0 4px 16px rgba(0,212,255,0.35)"
                              : `0 4px 16px ${a.color}30`
                          }}
                        >
                          {claiming === a.id ? "..." : "CLAIM"}
                        </button>
                      ) : (
                        <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 10, lineHeight: 1.4 }}>
                          {a.sessions - sessionCount} more<br />sessions
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── SECTION 2: RECOGNITION AWARDS ── */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-px flex-1 bg-zinc-800" />
            <p className="text-zinc-400 text-xs uppercase tracking-widest font-bold px-2">Recognition</p>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>
          <p className="text-zinc-700 text-xs text-center mb-4">Awarded by your institution — you cannot claim these yourself</p>

          <div className="space-y-3">
            {recognitionAwards.map((r) => {
              const isClaimed = claimed.includes(r.id)
              return (
                <div key={r.id} style={{
                  borderRadius: 16, padding: "14px 14px",
                  background: isClaimed ? `${r.color}08` : "rgba(255,255,255,0.015)",
                  border: `1px solid ${isClaimed ? r.glow : "rgba(255,255,255,0.06)"}`,
                  opacity: isClaimed ? 1 : 0.45,
                  boxShadow: isClaimed ? `0 0 24px ${r.glow}` : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 26, flexShrink: 0,
                      background: isClaimed ? `${r.color}15` : "rgba(255,255,255,0.04)",
                      border: `2px solid ${isClaimed ? r.glow : "rgba(255,255,255,0.06)"}`,
                      boxShadow: isClaimed ? `0 0 20px ${r.glow}` : "none"
                    }}>
                      {r.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        color: isClaimed ? "white" : "rgba(255,255,255,0.25)",
                        fontWeight: 800, fontSize: 13, marginBottom: 3
                      }}>{r.title}</p>
                      <p style={{
                        color: "rgba(255,255,255,0.25)", fontSize: 11, lineHeight: 1.4
                      }}>{r.description}</p>
                    </div>
                    {isClaimed && (
                      <p style={{
                        color: r.color, fontSize: 10,
                        fontWeight: 800, flexShrink: 0
                      }}>EARNED<br />✓</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── SECTION 3: LP REWARDS ── */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-px flex-1 bg-zinc-800" />
            <p className="text-zinc-400 text-xs uppercase tracking-widest font-bold px-2">LP Rewards</p>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>
          <p className="text-zinc-700 text-xs text-center mb-4">Spend your LinkPoints to claim these</p>

          <div className="space-y-4">
            {rewards.length === 0 && !loading ? (
              <div className="text-center py-16">
                <p className="text-zinc-400 text-sm">No LP rewards added yet.</p>
                <p className="text-zinc-600 text-xs mt-2">Your admin will add these soon.</p>
              </div>
            ) : (
              rewards.map((reward) => {
                const isClaimed = claimed.includes(reward.id)
                const unlocked = points >= reward.points_required
                const isClaiming = claiming === reward.id
                const lpAway = Math.max(reward.points_required - points, 0)

                return (
                  <div key={reward.id} className="overflow-hidden rounded-[32px] border border-zinc-800 shadow-[0_28px_120px_rgba(0,0,0,0.35)] bg-zinc-950">
                    <div className="relative h-56">
                      {reward.image_url ? (
                        <img src={reward.image_url} alt={reward.title}
                          className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-purple-900 via-zinc-900 to-cyan-900" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/95 via-zinc-950/40 to-transparent" />
                      <div className="absolute top-4 left-4 rounded-full bg-black/50 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm">
                        {reward.business_name || "Local Reward"}
                      </div>
                      <div className="absolute top-4 right-4 rounded-full bg-white/10 border border-white/10 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm">
                        {reward.points_required} LP
                      </div>
                      {reward.reward_type === "voucher" && reward.voucher_code && (
                        <div className="absolute left-4 bottom-20 rounded-2xl bg-white/10 border border-white/10 px-3 py-2 text-[11px] font-semibold text-cyan-200 backdrop-blur-sm">
                          Voucher code: {reward.voucher_code}
                        </div>
                      )}
                    </div>
                    <div className="p-5 pb-5">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <p className="text-zinc-400 text-xs uppercase tracking-[0.24em] font-semibold">
                          {reward.reward_type ? reward.reward_type.toUpperCase() : "REWARD"}
                        </p>
                        {isClaimed ? (
                          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-300 border border-emerald-500/20">
                            CLAIMED
                          </span>
                        ) : unlocked ? (
                          <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-[11px] font-bold text-cyan-300 border border-cyan-400/20">
                            READY
                          </span>
                        ) : (
                          <span className="rounded-full bg-zinc-800/80 px-3 py-1 text-[11px] font-bold text-zinc-300 border border-zinc-700/60">
                            {lpAway} LP AWAY
                          </span>
                        )}
                      </div>
                      <h2 className="text-xl font-bold text-white leading-tight mb-2">
                        {reward.title}
                      </h2>
                      {reward.description && (
                        <p className="text-zinc-300 text-sm leading-6 mb-4">
                          {reward.description}
                        </p>
                      )}
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <button
                          onClick={() => claimReward(reward.id, reward.points_required)}
                          disabled={!unlocked || isClaiming || isClaimed}
                          className={`w-full sm:w-auto rounded-full px-6 py-3 text-sm font-bold transition ${
                            isClaimed
                              ? "bg-zinc-800 text-zinc-400 cursor-default"
                              : unlocked
                                ? "bg-gradient-to-r from-purple-500 to-cyan-400 text-zinc-950 shadow-[0_16px_40px_rgba(180,0,255,0.3)] hover:opacity-95"
                                : "bg-white/5 text-zinc-400 cursor-not-allowed"
                          }`}
                        >
                          {isClaiming ? "Claiming..." : isClaimed ? "Already claimed" : "Claim Now"}
                        </button>
                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                          <span className="rounded-full bg-white/5 px-2 py-1">{reward.business_name || "IRL Shop"}</span>
                          <span className="text-zinc-500">•</span>
                          <span>{reward.created_by ? `Posted by ${reward.created_by}` : "Posted by admin"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}