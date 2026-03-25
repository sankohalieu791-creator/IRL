"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import BottomNav from "@/components/BottomNav"
import { getUser } from "@/lib/auth"

const USER = getUser() || "Test User"

type Reward = {
  id: string
  title: string
  points_required: number
  description?: string
  icon?: string
}

export default function Rewards() {
  const [points, setPoints] = useState(0)
  const [rewards, setRewards] = useState<Reward[]>([])
  const [claimed, setClaimed] = useState<string[]>([])
  const [claiming, setClaiming] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: leaderboard } = await supabase
      .from("leaderboard")
      .select("points")
      .eq("user_name", USER)
      .order("points", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (leaderboard) setPoints(leaderboard.points)

    const { data: rewardsData } = await supabase
      .from("rewards")
      .select("*")
      .order("points_required", { ascending: true })
      .limit(25)

    if (rewardsData) setRewards(rewardsData)

    const { data: claimedData } = await supabase
      .from("user_rewards")
      .select("reward_id")
      .eq("user_name", USER)

    if (claimedData) setClaimed(claimedData.map(r => r.reward_id))

    setLoading(false)
  }

  async function claimReward(rewardId: string, cost: number) {
    setClaiming(rewardId)
    const { data: userData } = await supabase
      .from("leaderboard")
      .select("points")
      .eq("user_name", USER)
      .order("points", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!userData) { setClaiming(null); return }

    await supabase
      .from("leaderboard")
      .update({ points: userData.points - cost })
      .eq("user_name", USER)

    await supabase
      .from("user_rewards")
      .insert({ user_name: USER, reward_id: rewardId })

    await loadData()
    setClaiming(null)
  }

  function getRewardStyle(isClaimed: boolean, unlocked: boolean, title: string) {
    const t = title.toLowerCase()
    if (isClaimed) return {
      bg: "bg-gradient-to-br from-green-900/40 to-emerald-900/20",
      border: "border-green-500/50",
      shadow: "shadow-green-500/10"
    }
    if (!unlocked) return {
      bg: "bg-zinc-900/60",
      border: "border-zinc-800",
      shadow: ""
    }
    if (t.includes("immortal") || t.includes("chosen")) return {
      bg: "bg-gradient-to-br from-yellow-900/60 via-amber-900/40 to-orange-900/30",
      border: "border-yellow-400/60",
      shadow: "shadow-yellow-500/30"
    }
    if (t.includes("black diamond")) return {
      bg: "bg-gradient-to-br from-zinc-900 via-zinc-800/80 to-zinc-900",
      border: "border-zinc-400/50",
      shadow: "shadow-zinc-400/20"
    }
    if (t.includes("red diamond")) return {
      bg: "bg-gradient-to-br from-red-900/50 via-rose-900/30 to-zinc-900",
      border: "border-red-500/50",
      shadow: "shadow-red-500/20"
    }
    if (t.includes("diamond")) return {
      bg: "bg-gradient-to-br from-cyan-900/50 via-blue-900/30 to-zinc-900",
      border: "border-cyan-400/50",
      shadow: "shadow-cyan-400/20"
    }
    if (t.includes("gold") || t.includes("king") || t.includes("untouchable") || t.includes("legend")) return {
      bg: "bg-gradient-to-br from-yellow-900/40 to-amber-900/20",
      border: "border-yellow-500/50",
      shadow: "shadow-yellow-500/20"
    }
    if (t.includes("silver") || t.includes("player") || t.includes("warrior") || t.includes("performer")) return {
      bg: "bg-gradient-to-br from-zinc-700/40 to-zinc-800/20",
      border: "border-zinc-400/40",
      shadow: "shadow-zinc-400/10"
    }
    if (t.includes("bronze") || t.includes("speed") || t.includes("consistency") || t.includes("street")) return {
      bg: "bg-gradient-to-br from-amber-900/30 to-orange-900/20",
      border: "border-amber-600/40",
      shadow: "shadow-amber-600/10"
    }
    return {
      bg: "bg-gradient-to-br from-purple-900/30 to-zinc-900",
      border: "border-purple-500/30",
      shadow: "shadow-purple-500/10"
    }
  }

  function getRewardIcon(reward: Reward, index: number) {
    if (reward.icon) return reward.icon
    const t = reward.title.toLowerCase()
    if (t.includes("bronze")) return "🥉"
    if (t.includes("silver")) return "🥈"
    if (t.includes("gold")) return "🥇"
    if (t.includes("black diamond")) return "🖤"
    if (t.includes("red diamond")) return "🔴"
    if (t.includes("diamond")) return "💎"
    if (t.includes("player")) return "🏆"
    if (t.includes("king") || t.includes("queen")) return "👑"
    if (t.includes("legend") || t.includes("immortal")) return "🌟"
    if (t.includes("chosen")) return "⭐"
    if (t.includes("speed") || t.includes("demon")) return "⚡"
    if (t.includes("consistency") || t.includes("streak")) return "🔥"
    if (t.includes("first") || t.includes("step")) return "👣"
    if (t.includes("warrior")) return "⚔️"
    if (t.includes("untouchable")) return "🚀"
    if (t.includes("early")) return "🌅"
    if (t.includes("spark")) return "✨"
    if (t.includes("street") || t.includes("credit")) return "💪"
    const defaults = ["🏅", "⚡", "🎯", "💪", "🚀", "🔥", "👑", "💎"]
    return defaults[index % defaults.length]
  }

  function getTierLabel(title: string, points_required: number) {
    const t = title.toLowerCase()
    if (t.includes("immortal") || t.includes("chosen")) return { label: "⭐ MYTHIC", color: "text-yellow-300 bg-yellow-900/40 border border-yellow-500/30" }
    if (t.includes("black diamond")) return { label: "🖤 BLACK DIAMOND", color: "text-zinc-200 bg-zinc-800/80 border border-zinc-500/30" }
    if (t.includes("red diamond")) return { label: "🔴 RED DIAMOND", color: "text-red-300 bg-red-900/40 border border-red-500/30" }
    if (t.includes("diamond")) return { label: "💎 DIAMOND", color: "text-cyan-300 bg-cyan-900/40 border border-cyan-500/30" }
    if (points_required >= 800) return { label: "🥇 GOLD", color: "text-yellow-400 bg-yellow-900/30 border border-yellow-600/30" }
    if (points_required >= 400) return { label: "🥈 SILVER", color: "text-zinc-300 bg-zinc-700/40 border border-zinc-500/30" }
    if (points_required >= 200) return { label: "🥉 BRONZE", color: "text-amber-600 bg-amber-900/30 border border-amber-700/30" }
    return { label: "🌱 STARTER", color: "text-zinc-400 bg-zinc-800 border border-zinc-700" }
  }

  const claimedCount = claimed.length
  const nextReward = rewards.find(r => !claimed.includes(r.id))
  const progressToNext = nextReward
    ? Math.min((points / nextReward.points_required) * 100, 100)
    : 100

  return (
    <div className="flex flex-col h-full overflow-hidden">

      <div className="flex-shrink-0 px-4 pt-4 pb-3">

        <h1 className="text-2xl font-bold text-cyan-400 mb-1">Rewards</h1>
        <p className="text-zinc-500 text-xs mb-3">
          Grind LP. Unlock status. Prove yourself.
        </p>

        <div className="rounded-2xl bg-gradient-to-br from-purple-900/60 via-zinc-900 to-cyan-900/40 border border-cyan-500/30 p-4 text-center">
          <p className="text-zinc-400 text-xs uppercase tracking-widest mb-1">
            Your LinkPoints
          </p>
          <span
            className="text-6xl font-black text-white block mb-1"
            style={{ textShadow: "0 0 30px rgba(0,212,255,0.4)" }}
          >
            {points}
          </span>
          <span className="text-cyan-400 font-bold text-xl">LP</span>

          <div className="w-16 h-0.5 bg-gradient-to-r from-purple-500 to-cyan-400 mx-auto my-3 rounded-full" />

          <div className="flex justify-center gap-6 mb-3">
            <div className="text-center">
              <p className="text-lg font-bold text-green-400">{claimedCount}</p>
              <p className="text-zinc-500 text-xs">Claimed</p>
            </div>
            <div className="w-px bg-zinc-700" />
            <div className="text-center">
              <p className="text-lg font-bold text-zinc-300">
                {rewards.length - claimedCount}
              </p>
              <p className="text-zinc-500 text-xs">Remaining</p>
            </div>
            <div className="w-px bg-zinc-700" />
            <div className="text-center">
              <p className="text-lg font-bold text-cyan-400">{rewards.length}</p>
              <p className="text-zinc-500 text-xs">Total</p>
            </div>
          </div>

          {!loading && nextReward && (
            <div>
              <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
                <span>Next: <span className="text-white font-semibold">{nextReward.title}</span></span>
                <span>{points}/{nextReward.points_required} LP</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-purple-500 to-cyan-400 h-2 rounded-full transition-all duration-700"
                  style={{ width: `${progressToNext}%` }}
                />
              </div>
            </div>
          )}

          {!loading && !nextReward && rewards.length > 0 && (
            <p className="text-yellow-400 font-bold text-sm">
              🏆 All rewards claimed! You are a legend.
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-20">
        {rewards.map((reward, index) => {
          const isClaimed = claimed.includes(reward.id)
          const unlocked = points >= reward.points_required
          const style = getRewardStyle(isClaimed, unlocked, reward.title)
          const icon = getRewardIcon(reward, index)
          const tier = getTierLabel(reward.title, reward.points_required)
          const isClaiming = claiming === reward.id
          const lpAway = reward.points_required - points

          return (
            <div
              key={reward.id}
              className={`relative rounded-2xl border p-4 shadow-lg transition-all ${style.bg} ${style.border} ${style.shadow} ${
                !unlocked && !isClaimed ? "opacity-55" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${
                    isClaimed
                      ? "bg-green-500/20 border border-green-500/30"
                      : unlocked
                      ? "bg-white/10 border border-white/20"
                      : "bg-zinc-800 border border-zinc-700"
                  }`}
                  style={{
                    boxShadow: isClaimed
                      ? "0 4px 15px rgba(34,197,94,0.2)"
                      : unlocked
                      ? "0 4px 20px rgba(0,212,255,0.2)"
                      : "none"
                  }}
                >
                  {isClaimed ? "✅" : !unlocked ? "🔒" : icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${tier.color}`}>
                      {tier.label}
                    </span>
                  </div>
                  <h3 className={`font-black text-sm leading-tight ${
                    isClaimed ? "text-green-300" : unlocked ? "text-white" : "text-zinc-500"
                  }`}>
                    {reward.title}
                  </h3>
                  {reward.description && (
                    <p className={`text-[11px] mt-0.5 leading-tight ${
                      isClaimed ? "text-green-600/80" : "text-zinc-600"
                    }`}>
                      {reward.description}
                    </p>
                  )}
                  <p className={`text-xs mt-1 font-semibold ${
                    isClaimed ? "text-green-500/60" : unlocked ? "text-cyan-500/70" : "text-zinc-600"
                  }`}>
                    ⚡ {reward.points_required} LP
                  </p>
                </div>

                <div className="flex-shrink-0 text-center">
                  {isClaimed ? (
                    <div>
                      <p className="text-green-400 text-xs font-black">CLAIMED</p>
                      <p className="text-green-600/60 text-[10px]">✓ Owned</p>
                    </div>
                  ) : unlocked ? (
                    <button
                      onClick={() => claimReward(reward.id, reward.points_required)}
                      disabled={!!isClaiming}
                      className="px-4 py-2.5 bg-gradient-to-r from-purple-500 to-cyan-400 rounded-xl text-xs font-black shadow-lg disabled:opacity-50 active:scale-95 transition-all"
                      style={{ boxShadow: "0 4px 20px rgba(124,58,237,0.5)" }}
                    >
                      {isClaiming ? "..." : "CLAIM"}
                    </button>
                  ) : (
                    <div>
                      <p className="text-zinc-600 text-xs font-black">LOCKED</p>
                      <p className="text-zinc-700 text-[10px]">{lpAway} LP away</p>
                    </div>
                  )}
                </div>
              </div>

              {isClaimed && (
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-green-500/5 to-transparent pointer-events-none" />
              )}
              {unlocked && !isClaimed && (
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-cyan-500/3 to-transparent pointer-events-none" />
              )}
            </div>
          )
        })}
      </div>

      <BottomNav />
    </div>
  )
}