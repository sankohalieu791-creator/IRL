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
      .maybeSingle()
    if (leaderboard) setPoints(leaderboard.points)

    const { count: sessions } = await supabase
      .from("session_attempts")
      .select("*", { count: "exact", head: true })
      .eq("user_name", user)
      .eq("status", "accepted")
    if (sessions !== null) setSessionCount(sessions)

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
      .maybeSingle()
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
    { sessions: 50, title: "IRL Legend", description: "50 sessions. Most people never get here.", reward: "Purple glow + Legend title + featured on leaderboard", icon: "🌟", color: "#B400FF", tag: "LEGEND" },
    { sessions: 100, title: "IRL Immortal", description: "100 sessions. You are built different.", reward: "Immortal title + rainbow border + permanent Hall of Fame", icon: "🏆", color: "#FFD700", tag: "IMMORTAL" },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 px-4 pt-4 pb-3">
        <h1 className="text-2xl font-bold text-cyan-400 mb-1">Rewards</h1>
        <p className="text-zinc-500 text-xs mb-3">Grind LP. Earn status. Prove yourself IRL.</p>
      </div>
      <BottomNav />
    </div>
  )
}