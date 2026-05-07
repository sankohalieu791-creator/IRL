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
        <div className="rounded-2xl bg-gradient-to-br from-purple-900/70 via-zinc-900/80 to-cyan-900/60 border border-cyan-500/25 p-2.5 text-center shadow-[0_20px_50px_rgba(0,0,0,0.25)] max-w-sm mx-auto">
          <p className="text-zinc-400 text-[9px] uppercase tracking-[0.3em] mb-1.5">Your LinkPoints</p>
          <span className="text-4xl font-black text-white block mb-0.5"
            style={{ textShadow: "0 0 20px rgba(0,212,255,0.3)" }}>
            {points}
          </span>
          <span className="text-cyan-400 font-bold text-base">LP</span>
          <div className="w-12 h-[2px] bg-gradient-to-r from-purple-500 to-cyan-400 mx-auto my-2.5 rounded-full" />
          <div className="grid grid-cols-3 gap-2 text-center mb-2.5">
            <div>
              <p className="text-sm font-bold text-green-400">{claimedCount}</p>
              <p className="text-zinc-500 text-[10px] uppercase tracking-[0.15em]">Earned</p>
            </div>
            <div className="h-6 border-l border-r border-zinc-700" />
            <div>
              <p className="text-sm font-bold text-cyan-400">{sessionCount}</p>
              <p className="text-zinc-500 text-[10px] uppercase tracking-[0.15em]">Sessions</p>
            </div>
            <div className="h-6 border-l border-zinc-700" />
            <div>
              <p className="text-sm font-bold text-purple-400">{rewards.length}</p>
              <p className="text-zinc-500 text-[10px] uppercase tracking-[0.15em]">Rewards</p>
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

          <div className="space-y-4">
            {sessionAchievements.map((a) => {
              const isClaimed = claimed.includes(a.id)
              const unlocked = sessionCount >= a.sessions
              const canClaim = unlocked && !isClaimed
              const progress = Math.min((sessionCount / a.sessions) * 100, 100)

              return (
                <div key={a.id} className="overflow-hidden rounded-[28px] border border-zinc-700/50 shadow-[0_20px_80px_rgba(0,0,0,0.25)] bg-gradient-to-br from-zinc-900/80 via-zinc-800/60 to-zinc-900/80">
                  <div className="relative h-40">
                    <div className="h-full w-full bg-gradient-to-br from-purple-900/40 via-zinc-900/50 to-cyan-900/40" />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/90 via-zinc-900/50 to-transparent" />
                    <div className="absolute top-4 left-4 rounded-full bg-black/40 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                      Achievement
                    </div>
                    <div className="absolute top-4 right-4 rounded-full bg-white/10 border border-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                      {a.sessions} Sessions
                    </div>
                    {isClaimed && a.isVerified && (
                      <div className="absolute left-4 bottom-16 rounded-2xl bg-cyan-500/20 border border-cyan-400/30 px-3 py-1.5 text-[10px] font-semibold text-cyan-200 backdrop-blur-sm">
                        FOUNDING MEMBER
                      </div>
                    )}
                  </div>
                  <div className="p-4 pb-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <p className="text-zinc-400 text-xs uppercase tracking-[0.2em] font-semibold">
                        SESSION MILESTONE
                      </p>
                      {isClaimed ? (
                        <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-300 border border-emerald-500/30">
                          EARNED
                        </span>
                      ) : unlocked ? (
                        <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-[11px] font-bold text-cyan-300 border border-cyan-400/30">
                          READY
                        </span>
                      ) : (
                        <span className="rounded-full bg-zinc-700/60 px-3 py-1 text-[11px] font-bold text-zinc-300 border border-zinc-600/50">
                          {a.sessions - sessionCount} MORE
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-bold text-white leading-tight mb-2">
                      {a.title}
                    </h2>
                    <p className="text-zinc-300 text-sm leading-5 mb-3">
                      {a.description}
                    </p>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1 bg-zinc-700/50 rounded-full h-2">
                        <div className={`h-2 rounded-full transition-all duration-700 ${
                          isClaimed ? 'bg-gradient-to-r from-emerald-500 to-cyan-400' :
                          unlocked ? 'bg-gradient-to-r from-purple-500 to-cyan-400' :
                          'bg-gradient-to-r from-zinc-600 to-zinc-500'
                        }`} style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-zinc-400">
                        {Math.min(sessionCount, a.sessions)}/{a.sessions}
                      </span>
                    </div>
                    <div className="flex justify-center">
                      {isClaimed ? (
                        <div className="flex items-center gap-2 text-emerald-400">
                          <VerifiedBadge size={32} earned={true} />
                          <span className="text-sm font-bold">Earned ✓</span>
                        </div>
                      ) : canClaim ? (
                        <button
                          onClick={() => claimSessionReward(a.id)}
                          disabled={claiming === a.id}
                          className="bg-gradient-to-r from-purple-500 to-cyan-400 text-zinc-950 px-6 py-2.5 rounded-full text-sm font-bold shadow-[0_8px_25px_rgba(180,0,255,0.3)] hover:opacity-95 transition-opacity"
                        >
                          {claiming === a.id ? "Claiming..." : "Claim Now"}
                        </button>
                      ) : (
                        <p className="text-zinc-500 text-sm">
                          Complete {a.sessions - sessionCount} more sessions
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

          <div className="space-y-4">
            {recognitionAwards.map((r) => {
              const isClaimed = claimed.includes(r.id)
              return (
                <div key={r.id} className="overflow-hidden rounded-[28px] border border-zinc-700/50 shadow-[0_20px_80px_rgba(0,0,0,0.25)] bg-gradient-to-br from-zinc-900/80 via-zinc-800/60 to-zinc-900/80">
                  <div className="relative h-40">
                    <div className={`h-full w-full bg-gradient-to-br ${
                      isClaimed ? 'from-purple-900/50 via-zinc-900/60 to-cyan-900/50' : 'from-zinc-800/60 via-zinc-700/40 to-zinc-800/60'
                    }`} />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/90 via-zinc-900/50 to-transparent" />
                    <div className="absolute top-4 left-4 rounded-full bg-black/40 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                      Recognition
                    </div>
                    <div className="absolute top-4 right-4 rounded-full bg-white/10 border border-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                      {r.icon}
                    </div>
                  </div>
                  <div className="p-4 pb-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <p className="text-zinc-400 text-xs uppercase tracking-[0.2em] font-semibold">
                        INSTITUTION AWARD
                      </p>
                      {isClaimed ? (
                        <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-300 border border-emerald-500/30">
                          EARNED
                        </span>
                      ) : (
                        <span className="rounded-full bg-zinc-700/60 px-3 py-1 text-[11px] font-bold text-zinc-400 border border-zinc-600/50">
                          LOCKED
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-bold text-white leading-tight mb-2">
                      {r.title}
                    </h2>
                    <p className="text-zinc-300 text-sm leading-5 mb-3">
                      {r.description}
                    </p>
                    <div className="flex justify-center">
                      {isClaimed ? (
                        <div className="flex items-center gap-2 text-emerald-400">
                          <span className="text-2xl">{r.icon}</span>
                          <span className="text-sm font-bold">Awarded ✓</span>
                        </div>
                      ) : (
                        <p className="text-zinc-500 text-sm">
                          Awarded by your institution
                        </p>
                      )}
                    </div>
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
                  <div key={reward.id} className="overflow-hidden rounded-[28px] border border-zinc-700/50 shadow-[0_20px_80px_rgba(0,0,0,0.25)] bg-gradient-to-br from-zinc-900/80 via-zinc-800/60 to-zinc-900/80">
                    <div className="relative h-48">
                      {reward.image_url ? (
                        <img src={reward.image_url} alt={reward.title}
                          className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-purple-900/50 via-zinc-900/60 to-cyan-900/50" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/85 via-zinc-900/50 to-transparent" />
                      <div className="absolute top-4 left-4 rounded-full bg-black/40 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                        {reward.business_name || "Local Reward"}
                      </div>
                      <div className="absolute top-4 right-4 rounded-full bg-white/10 border border-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                        {reward.points_required} LP
                      </div>
                      {reward.reward_type === "voucher" && reward.voucher_code && (
                        <div className="absolute left-4 bottom-16 rounded-2xl bg-white/10 border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-200 backdrop-blur-sm">
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