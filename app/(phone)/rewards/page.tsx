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
  type?: "badge" | "title" | "trophy"
}

export default function Rewards() {
  const [user, setUser] = useState("")
  const [points, setPoints] = useState(0)
  const [sessions, setSessions] = useState(0)
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
    const { data: leaderboard } = await supabase
      .from("leaderboard")
      .select("points")
      .eq("user_name", user)
      .order("points", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (leaderboard) setPoints(leaderboard.points)

    const { count: sessionCount } = await supabase
      .from("session_attempts")
      .select("*", { count: "exact", head: true })
      .eq("user_name", user)
      .eq("status", "accepted")
    
    if (sessionCount !== null) setSessions(sessionCount)

    const { data: rewardsData } = await supabase
      .from("rewards")
      .select("*")
      .order("points_required", { ascending: true })
      .limit(25)

    if (rewardsData) setRewards(rewardsData)

    const { data: claimedData } = await supabase
      .from("user_rewards")
      .select("reward_id")
      .eq("user_name", user)

    if (claimedData) setClaimed(claimedData.map(r => r.reward_id))

    setLoading(false)
  }

  async function claimReward(rewardId: string, cost: number) {
    setClaiming(rewardId)
    const { data: userData } = await supabase
      .from("leaderboard")
      .select("points")
      .eq("user_name", user)
      .order("points", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!userData) { setClaiming(null); return }

    await supabase
      .from("leaderboard")
      .update({ points: userData.points - cost })
      .eq("user_name", user)

    await supabase
      .from("user_rewards")
      .insert({ user_name: user, reward_id: rewardId })

    await loadData()
    setClaiming(null)
  }

  async function claimVerification() {
    setClaiming("verification")
    
    await supabase
      .from("user_rewards")
      .insert({ user_name: user, reward_id: "irl-verified-30-sessions" })

    await supabase
      .from("users")
      .update({ is_verified: true })
      .eq("user_name", user)

    await loadData()
    setClaiming(null)
  }

  function getRewardStyle(isClaimed: boolean, unlocked: boolean, title: string) {
    const t = title.toLowerCase()
    if (isClaimed) return { bg: "bg-gradient-to-br from-green-900/40 to-emerald-900/20", border: "border-green-500/50", shadow: "shadow-green-500/10" }
    if (!unlocked) return { bg: "bg-zinc-900/60", border: "border-zinc-800", shadow: "" }
    if (t.includes("immortal") || t.includes("chosen")) return { bg: "bg-gradient-to-br from-yellow-900/60 via-amber-900/40 to-orange-900/30", border: "border-yellow-400/60", shadow: "shadow-yellow-500/30" }
    if (t.includes("black diamond")) return { bg: "bg-gradient-to-br from-zinc-900 via-zinc-800/80 to-zinc-900", border: "border-zinc-400/50", shadow: "shadow-zinc-400/20" }
    if (t.includes("red diamond")) return { bg: "bg-gradient-to-br from-red-900/50 via-rose-900/30 to-zinc-900", border: "border-red-500/50", shadow: "shadow-red-500/20" }
    if (t.includes("diamond")) return { bg: "bg-gradient-to-br from-cyan-900/50 via-blue-900/30 to-zinc-900", border: "border-cyan-400/50", shadow: "shadow-cyan-400/20" }
    if (t.includes("gold") || t.includes("king") || t.includes("untouchable") || t.includes("legend")) return { bg: "bg-gradient-to-br from-yellow-900/40 to-amber-900/20", border: "border-yellow-500/50", shadow: "shadow-yellow-500/20" }
    if (t.includes("silver") || t.includes("player") || t.includes("warrior") || t.includes("performer")) return { bg: "bg-gradient-to-br from-zinc-700/40 to-zinc-800/20", border: "border-zinc-400/40", shadow: "shadow-zinc-400/10" }
    if (t.includes("bronze") || t.includes("speed") || t.includes("consistency") || t.includes("street")) return { bg: "bg-gradient-to-br from-amber-900/30 to-orange-900/20", border: "border-amber-600/40", shadow: "shadow-amber-600/10" }
    return { bg: "bg-gradient-to-br from-purple-900/30 to-zinc-900", border: "border-purple-500/30", shadow: "shadow-purple-500/10" }
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
    if (t.includes("badge")) return "🎖️"
    if (t.includes("title")) return "📜"
    if (t.includes("trophy")) return "🏅"
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
  const progressToNext = nextReward ? Math.min((points / nextReward.points_required) * 100, 100) : 100
  const canGetVerified = sessions >= 30 && !claimed.includes("irl-verified-30-sessions")

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 px-4 pt-4 pb-3">
        <h1 className="text-2xl font-bold text-cyan-400 mb-1">Rewards</h1>
        <p className="text-zinc-500 text-xs mb-3">Grind LP. Unlock status. Prove yourself.</p>
        <div className="rounded-2xl bg-gradient-to-br from-purple-900/60 via-zinc-900 to-cyan-900/40 border border-cyan-500/30 p-4 text-center">
          <p className="text-zinc-400 text-xs uppercase tracking-widest mb-1">Your LinkPoints</p>
          <span className="text-6xl font-black text-white block mb-1" style={{ textShadow: "0 0 30px rgba(0,212,255,0.4)" }}>
            {points}
          </span>
          <span className="text-cyan-400 font-bold text-xl">LP</span>
        </div>
      </div>
      <BottomNav />
    </div>
  )
}