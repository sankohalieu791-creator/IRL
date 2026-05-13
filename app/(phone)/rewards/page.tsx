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
  active?: boolean
}

export default function Rewards() {
  const [user, setUser] = useState("")
  const [points, setPoints] = useState(0)
  const [sessionCount, setSessionCount] = useState(0)
  const [rewards, setRewards] = useState<Reward[]>([])
  const [claimed, setClaimed] = useState<string[]>([])
  const [claimedRewardData, setClaimedRewardData] = useState<Reward[]>([])
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
      .from("rewards").select("*").order("points_required", { ascending: true }).limit(50)
    
    // Combine session achievements with LP rewards
    const allRewards: Reward[] = [
      ...sessionAchievements.map(a => ({
        id: a.id,
        title: a.title,
        points_required: 0,
        description: a.description,
        icon: "🏅",
        reward_type: "achievement",
        active: true
      })),
      ...(rewardsData || [])
    ]
    setRewards(allRewards)

    const { data: claimedData } = await supabase
      .from("user_rewards").select("reward_id").eq("user_name", user)
    if (claimedData) {
      const claimedIds = claimedData.map(r => r.reward_id)
      setClaimed(claimedIds)
      const claimedRewards = allRewards.filter(r => claimedIds.includes(r.id)).slice(0, 3)
      setClaimedRewardData(claimedRewards)
    }

    setLoading(false)
  }

  async function claimReward(rewardId: string, cost: number = 0) {
    setClaiming(rewardId)
    const alreadyClaimed = claimed.includes(rewardId)
    if (alreadyClaimed) { setClaiming(null); return }

    if (cost > 0) {
      const { data: userData } = await supabase
        .from("leaderboard").select("points").eq("user_name", user)
        .order("points", { ascending: false }).limit(1).maybeSingle()
      if (!userData) { setClaiming(null); return }
      if (userData.points < cost) {
        setClaiming(null)
        return
      }
      await supabase.from("leaderboard").update({ points: userData.points - cost }).eq("user_name", user)
    }

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


  const claimedCount = claimed.length

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
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-4 pb-24 space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-cyan-400 mb-1">Rewards</h1>
            <p className="text-zinc-500 text-xs mb-3">Earn status. Get recognised. Prove yourself IRL.</p>

            {/* LP CARD WITH CLAIMED REWARDS */}
            <div className="rounded-[32px] bg-gradient-to-br from-slate-900 via-zinc-950 to-slate-900 border border-white/10 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.25)]">
              <p className="text-zinc-400 text-[9px] uppercase tracking-[0.3em] mb-1.5 text-center">Your LinkPoints</p>
              <span className="text-5xl font-black text-white block mb-0.5 text-center"
                style={{ textShadow: "0 0 20px rgba(0,212,255,0.3)" }}>
                {points}
              </span>
              <span className="text-cyan-400 font-bold text-base block text-center">LP</span>
              <div className="w-12 h-[2px] bg-gradient-to-r from-purple-500 to-cyan-400 mx-auto my-2.5 rounded-full" />
              
              {/* Claimed Rewards Display (up to 3) */}
              {claimedRewardData.length > 0 && (
                <div className="flex items-center justify-center gap-3 mb-3">
                  {claimedRewardData.map((reward, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-1">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 flex items-center justify-center text-lg">
                        {reward.icon || "🏅"}
                      </div>
                      <p className="text-[9px] text-zinc-400 text-center w-14 truncate">{reward.title.split(" ")[0]}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-center mb-2.5">
                <div>
                  <p className="text-sm font-bold text-green-400">{claimedCount}</p>
                  <p className="text-zinc-500 text-[10px] uppercase tracking-[0.15em]">Earned</p>
                </div>
                <div className="h-6 border-l border-zinc-700" />
                <div>
                  <p className="text-sm font-bold text-purple-400">{rewards.length}</p>
                  <p className="text-zinc-500 text-[10px] uppercase tracking-[0.15em]">Total</p>
                </div>
              </div>
            </div>
          </div>

          {/* ALL REWARDS SECTION */}
          <div>
          <div className="flex items-center gap-2 mb-4 mt-2">
            <div className="h-px flex-1 bg-zinc-800" />
            <p className="text-zinc-400 text-xs uppercase tracking-widest font-bold px-2">All Rewards</p>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>

          <div className="space-y-4">
            {rewards.map((reward) => {
              const isClaimed = claimed.includes(reward.id)
              
              // Check unlock condition
              let unlocked = false
              let unlockReason = ""
              
              if (reward.reward_type === "achievement") {
                // Session-based achievement
                const achievement = sessionAchievements.find(a => a.id === reward.id)
                if (achievement) {
                  unlocked = sessionCount >= achievement.sessions
                  unlockReason = `${Math.max(0, achievement.sessions - sessionCount)} more sessions`
                }
              } else {
                // LP-based reward
                unlocked = points >= reward.points_required
                unlockReason = "Not enough LP"
              }

              const canClaim = unlocked && !isClaimed
              const isClaiming = claiming === reward.id

              return (
                <div key={reward.id} className="overflow-hidden rounded-[28px] border border-zinc-700/50 shadow-[0_20px_80px_rgba(0,0,0,0.25)] bg-gradient-to-br from-zinc-900/80 via-zinc-800/60 to-zinc-900/80">
                  <div className="relative h-40">
                    <div className="h-full w-full bg-gradient-to-br from-purple-900/40 via-zinc-900/50 to-cyan-900/40" />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/90 via-zinc-900/50 to-transparent" />
                    <div className="absolute top-4 left-4 rounded-full bg-black/40 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                      {reward.reward_type === "achievement" ? "Achievement" : "Reward"}
                    </div>
                    {reward.points_required > 0 && (
                      <div className="absolute top-4 right-4 rounded-full bg-white/10 border border-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                        {reward.points_required} LP
                      </div>
                    )}
                    {isClaimed && (
                      <div className="absolute left-4 bottom-16 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 px-3 py-1.5 text-[10px] font-semibold text-emerald-200 backdrop-blur-sm">
                        ✓ EARNED
                      </div>
                    )}
                  </div>
                  <div className="p-4 pb-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <p className="text-zinc-400 text-xs uppercase tracking-[0.2em] font-semibold">
                        {reward.reward_type === "achievement" ? "ACHIEVEMENT" : "REWARD"}
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
                          {unlockReason}
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-bold text-white leading-tight mb-2">
                      {reward.title}
                    </h2>
                    <p className="text-zinc-300 text-sm leading-5 mb-3">
                      {reward.description}
                    </p>
                    <div className="flex justify-center">
                      {isClaimed ? (
                        <div className="flex items-center gap-2 text-emerald-400">
                          <VerifiedBadge size={32} earned={true} />
                          <span className="text-sm font-bold">Earned ✓</span>
                        </div>
                      ) : unlocked ? (
                        <button
                          onClick={() => claimReward(reward.id, reward.points_required)}
                          disabled={isClaiming}
                          className="bg-gradient-to-r from-purple-500 to-cyan-400 text-zinc-950 px-6 py-2.5 rounded-full text-sm font-bold shadow-[0_8px_25px_rgba(180,0,255,0.3)] hover:opacity-95 transition-opacity"
                        >
                          {isClaiming ? "Claiming..." : "Claim"}
                        </button>
                      ) : (
                        <button
                          disabled
                          className="bg-zinc-800/50 text-zinc-500 px-6 py-2.5 rounded-full text-sm font-bold cursor-not-allowed"
                        >
                          {unlockReason}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}