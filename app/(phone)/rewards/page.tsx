"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import BottomNav from "@/components/BottomNav"
import { getUser } from "@/lib/auth"

export default function Rewards() {
  const [user, setUser] = useState("")
  const [points, setPoints] = useState(0)
  const [sessionCount, setSessionCount] = useState(0)
  const [rewards, setRewards] = useState<any[]>([])
  const [claimed, setClaimed] = useState<string[]>([])
  const [claiming, setClaiming] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"achievements" | "lp">("achievements")
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const u = getUser() || ""
    setUser(u)
    setReady(true)
  }, [])

  useEffect(() => {
    if (ready && user) loadData()
  }, [ready, user])

  async function loadData() {
    const { data: leaderboard } = await supabase
      .from("leaderboard").select("points").eq("user_name", user).maybeSingle()
    if (leaderboard) setPoints(leaderboard.points)

    const { count: sessions } = await supabase
      .from("session_attempts").select("*", { count: "exact", head: true })
      .eq("user_name", user).eq("status", "accepted")
    if (sessions !== null) setSessionCount(sessions)

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
      .from("leaderboard").select("points").eq("user_name", user).maybeSingle()
    if (!userData) { setClaiming(null); return }
    await supabase.from("leaderboard").update({ points: userData.points - cost }).eq("user_name", user)
    await supabase.from("user_rewards").insert({ user_name: user, reward_id: rewardId })
    await loadData()
    setClaiming(null)
  }

  const achievements = [
    { sessions: 1, title: "First Step", description: "You showed up. That's everything.", reward: "Unlocks your profile on the leaderboard", icon: "👣", color: "#CD7F32", tag: "STARTER" },
    { sessions: 5, title: "IRL Active", description: "5 sessions completed in real life.", reward: "Bronze border on your avatar", icon: "⚡", color: "#CD7F32", tag: "BRONZE" },
    { sessions: 10, title: "IRL Committed", description: "10 sessions. You are not just talking.", reward: "Silver border on your avatar", icon: "🔥", color: "#C0C0C0", tag: "SILVER" },
    { sessions: 20, title: "IRL Verified ✓", description: "20 sessions completed. You are officially verified.", reward: "Verified badge on your profile visible to everyone", icon: "✓", color: "#00D4FF", tag: "VERIFIED", isVerified: true },
    { sessions: 35, title: "IRL Elite", description: "35 sessions. You are in the top tier.", reward: "Gold border + Elite title shown on your profile", icon: "👑", color: "#FFD700", tag: "ELITE" },
    { sessions: 50, title: "IRL Legend", description: "50 sessions. Most people never get here.", reward: "Purple glow + Legend title on your profile", icon: "🌟", color: "#B400FF", tag: "LEGEND" },
    { sessions: 100, title: "IRL Immortal", description: "100 sessions. You are built different.", reward: "Immortal title + permanent Hall of Fame", icon: "🏆", color: "#FFD700", tag: "IMMORTAL" },
  ]

  function getRewardStyle(isClaimed: boolean, unlocked: boolean, title: string) {
    const t = title.toLowerCase()
    if (isClaimed) return { bg: "bg-gradient-to-br from-green-900/40 to-emerald-900/20", border: "border-green-500/50", shadow: "shadow-green-500/10" }
    if (!unlocked) return { bg: "bg-zinc-900/60", border: "border-zinc-800", shadow: "" }
    if (t.includes("immortal") || t.includes("chosen")) return { bg: "bg-gradient-to-br from-yellow-900/60 via-amber-900/40 to-orange-900/30", border: "border-yellow-400/60", shadow: "shadow-yellow-500/30" }
    if (t.includes("black diamond")) return { bg: "bg-gradient-to-br from-zinc-900 via-zinc-800/80 to-zinc-900", border: "border-zinc-400/50", shadow: "shadow-zinc-400/20" }
    if (t.includes("red diamond")) return { bg: "bg-gradient-to-br from-red-900/50 via-rose-900/30 to-zinc-900", border: "border-red-500/50", shadow: "shadow-red-500/20" }
    if (t.includes("diamond")) return { bg: "bg-gradient-to-br from-cyan-900/50 via-blue-900/30 to-zinc-900", border: "border-cyan-400/50", shadow: "shadow-cyan-400/20" }
    if (t.includes("gold") || t.includes("legend")) return { bg: "bg-gradient-to-br from-yellow-900/40 to-amber-900/20", border: "border-yellow-500/50", shadow: "shadow-yellow-500/20" }
    if (t.includes("silver") || t.includes("warrior")) return { bg: "bg-gradient-to-br from-zinc-700/40 to-zinc-800/20", border: "border-zinc-400/40", shadow: "shadow-zinc-400/10" }
    if (t.includes("bronze")) return { bg: "bg-gradient-to-br from-amber-900/30 to-orange-900/20", border: "border-amber-600/40", shadow: "shadow-amber-600/10" }
    return { bg: "bg-gradient-to-br from-purple-900/30 to-zinc-900", border: "border-purple-500/30", shadow: "shadow-purple-500/10" }
  }

  function getRewardIcon(reward: any, index: number) {
    if (reward.icon) return reward.icon
    const t = reward.title.toLowerCase()
    if (t.includes("bronze")) return "🥉"
    if (t.includes("silver")) return "🥈"
    if (t.includes("gold")) return "🥇"
    if (t.includes("diamond")) return "💎"
    if (t.includes("king") || t.includes("queen")) return "👑"
    if (t.includes("legend") || t.includes("immortal")) return "🌟"
    if (t.includes("warrior")) return "⚔️"
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

  if (!ready) return (
    <div style={{ height: "100%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#52525b", fontSize: 13 }}>Loading...</p>
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden bg-black text-white">
      ...
    </div>
  )
}