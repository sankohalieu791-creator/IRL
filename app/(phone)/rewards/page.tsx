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
  const [claiming, setClaiming] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<"all" | "physical" | "digital" | "achievement">("all")

  useEffect(() => {
    const u = getUser() || ""
    setUser(u)
  }, [])

  useEffect(() => {
    if (user) loadData()
  }, [user])

  async function loadData() {
    const { data: lb } = await supabase.from("leaderboard").select("points").eq("user_name", user).order("points", { ascending: false }).limit(1).maybeSingle()
    if (lb) setPoints(lb.points)

    const { count: sc } = await supabase.from("session_attempts").select("*", { count: "exact", head: true }).eq("user_name", user).eq("status", "accepted")
    if (sc !== null) setSessionCount(sc)

    const { data: rewardsData } = await supabase.from("rewards").select("*").eq("active", true).order("points_required", { ascending: true })

    const allRewards: Reward[] = [
      ...sessionAchievements.map(a => ({
        id: a.id, title: a.title, points_required: 0,
        description: a.description, icon: "🏅", reward_type: "achievement", active: true
      })),
      ...(rewardsData || [])
    ]
    setRewards(allRewards)

    const { data: claimedData } = await supabase.from("user_rewards").select("reward_id").eq("user_name", user)
    if (claimedData) setClaimed(claimedData.map(r => r.reward_id))
    setLoading(false)
  }

  async function claimReward(rewardId: string, cost: number = 0) {
    if (claimed.includes(rewardId)) return
    setClaiming(rewardId)
    if (cost > 0) {
      const { data: userData } = await supabase.from("leaderboard").select("points").eq("user_name", user).maybeSingle()
      if (!userData || userData.points < cost) { setClaiming(null); return }
      await supabase.from("leaderboard").update({ points: userData.points - cost }).eq("user_name", user)
    }
    await supabase.from("user_rewards").insert({ user_name: user, reward_id: rewardId })
    await loadData()
    setClaiming(null)
  }

  const sessionAchievements = [
    { id: "irl-verified-founding", sessions: 20, title: "IRL Verified — Founding Member", description: "Complete 20 sessions. Permanent and exclusive to founding users.", color: "#00D4FF" },
    { id: "irl-10-committed", sessions: 10, title: "IRL Committed", description: "10 sessions done. You are building a real habit.", color: "#C0C0C0" },
    { id: "irl-30-grinder", sessions: 30, title: "IRL Grinder", description: "30 sessions. You show up when others don't.", color: "#FFD700" },
    { id: "irl-50-elite", sessions: 50, title: "IRL Elite", description: "50 sessions. Top 1% on the platform.", color: "#B400FF" },
    { id: "irl-100-legend", sessions: 100, title: "IRL Legend", description: "100 sessions. Barely anyone gets here.", color: "#FF6B35" },
  ]

  const filters = [
    { key: "all", label: "All" },
    { key: "physical", label: "Physical" },
    { key: "digital", label: "Digital" },
    { key: "achievement", label: "Badges" },
  ]

  const filteredRewards = rewards.filter(r => {
    if (activeFilter === "all") return true
    return r.reward_type === activeFilter
  })

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#000", color: "white", overflow: "hidden" }}>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ padding: "16px 16px 0" }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "#00D4FF", marginBottom: 4 }}>Rewards</h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 16 }}>Earn LP. Redeem real rewards.</p>

          {/* LP Balance Card */}
          <div style={{ background: "linear-gradient(135deg, #0f0f1a, #1a0a2e)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "20px 16px", marginBottom: 16, textAlign: "center" }}>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 6 }}>Your LP Balance</p>
            <p style={{ fontSize: 52, fontWeight: 900, color: "white", lineHeight: 1, textShadow: "0 0 30px rgba(0,212,255,0.4)" }}>{points.toLocaleString()}</p>
            <p style={{ color: "#00D4FF", fontWeight: 700, fontSize: 16, marginTop: 2 }}>LP</p>
            <div style={{ width: 40, height: 2, background: "linear-gradient(to right, #B400FF, #00D4FF)", margin: "12px auto" }} />
            <div style={{ display: "flex", justifyContent: "center", gap: 24 }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ color: "#4ade80", fontWeight: 700, fontSize: 15 }}>{claimed.length}</p>
                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em" }}>Earned</p>
              </div>
              <div style={{ width: 1, background: "rgba(255,255,255,0.1)" }} />
              <div style={{ textAlign: "center" }}>
                <p style={{ color: "#a78bfa", fontWeight: 700, fontSize: 15 }}>{sessionCount}</p>
                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em" }}>Sessions</p>
              </div>
            </div>
          </div>

          {/* Filter Pills */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
            {filters.map(f => (
              <button key={f.key} onClick={() => setActiveFilter(f.key as any)} style={{
                padding: "8px 16px", borderRadius: 20, border: "none", cursor: "pointer", flexShrink: 0,
                fontWeight: 700, fontSize: 13,
                background: activeFilter === f.key ? "linear-gradient(135deg, #B400FF, #00D4FF)" : "rgba(255,255,255,0.08)",
                color: activeFilter === f.key ? "white" : "rgba(255,255,255,0.5)",
                boxShadow: activeFilter === f.key ? "0 4px 15px rgba(180,0,255,0.3)" : "none"
              }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Reward Cards */}
        <div style={{ padding: "0 12px 100px", display: "flex", flexDirection: "column", gap: 14 }}>
          {loading && (
            <p style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: "40px 0" }}>Loading rewards...</p>
          )}

          {filteredRewards.map(reward => {
            const isClaimed = claimed.includes(reward.id)
            const isClaiming = claiming === reward.id

            let unlocked = false
            let progress = ""

            if (reward.reward_type === "achievement") {
              const achievement = sessionAchievements.find(a => a.id === reward.id)
              if (achievement) {
                unlocked = sessionCount >= achievement.sessions
                const remaining = Math.max(0, achievement.sessions - sessionCount)
                progress = remaining > 0 ? `${remaining} sessions to go` : "Ready to claim"
              }
            } else {
              unlocked = points >= (reward.points_required || 0)
              progress = !unlocked ? `Need ${(reward.points_required - points).toLocaleString()} more LP` : "Ready to claim"
            }

            const canClaim = unlocked && !isClaimed

            // ACHIEVEMENT BADGE CARD
            if (reward.reward_type === "achievement") {
              const achievement = sessionAchievements.find(a => a.id === reward.id)
              return (
                <div key={reward.id} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${isClaimed ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.08)"}`, borderRadius: 18, overflow: "hidden" }}>
                  <div style={{ padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 16, background: isClaimed ? `linear-gradient(135deg, ${achievement?.color || "#00D4FF"}, #00D4FF)` : "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                      {isClaimed ? "🏅" : "🔒"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 4 }}>Achievement</p>
                      <p style={{ color: "white", fontWeight: 800, fontSize: 14, marginBottom: 4 }}>{reward.title}</p>
                      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, lineHeight: 1.4 }}>{reward.description}</p>
                      <p style={{ color: isClaimed ? "#4ade80" : unlocked ? "#00D4FF" : "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: 700, marginTop: 6 }}>
                        {isClaimed ? "✓ Earned" : progress}
                      </p>
                    </div>
                    {canClaim && (
                      <button onClick={() => claimReward(reward.id)} disabled={isClaiming} style={{ background: "linear-gradient(135deg, #B400FF, #00D4FF)", border: "none", borderRadius: 12, padding: "8px 14px", color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                        {isClaiming ? "..." : "Claim"}
                      </button>
                    )}
                  </div>
                </div>
              )
            }

            // MAIN REWARD CARD (matching screenshot)
            return (
              <div key={reward.id} style={{ borderRadius: 18, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "#111" }}>
                {/* Image area */}
                <div style={{ position: "relative", height: 200 }}>
                  {reward.image_url ? (
                    <img src={reward.image_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #1a1a2e, #0f3460)" }} />
                  )}
                  {/* Gradient overlay */}
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.8) 100%)" }} />

                  {/* Business name pill - top left */}
                  <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(10px)", borderRadius: 20, padding: "6px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14 }}>{reward.icon || "🎁"}</span>
                    <span style={{ color: "white", fontSize: 12, fontWeight: 700 }}>{reward.business_name || "IRL Partner"}</span>
                  </div>

                  {/* LP cost pill - top right */}
                  {reward.points_required > 0 && (
                    <div style={{ position: "absolute", top: 12, right: 12, background: "linear-gradient(135deg, #8b5cf6, #B400FF)", borderRadius: 20, padding: "6px 14px" }}>
                      <span style={{ color: "white", fontSize: 13, fontWeight: 800 }}>{reward.points_required.toLocaleString()} LP</span>
                    </div>
                  )}

                  {/* Reward title - bottom of image */}
                  <div style={{ position: "absolute", bottom: 12, left: 14, right: 14 }}>
                    <p style={{ color: "white", fontWeight: 800, fontSize: 17, lineHeight: 1.3, textShadow: "0 2px 8px rgba(0,0,0,0.8)" }}>{reward.title}</p>
                    {reward.description && (
                      <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 3, textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>{reward.description}</p>
                    )}
                  </div>
                </div>

                {/* Bottom action row */}
                <div style={{ padding: "12px 14px", display: "flex", gap: 10, alignItems: "center" }}>
                  {isClaimed ? (
                    <div style={{ flex: 1, background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 30, padding: "13px 0", textAlign: "center" }}>
                      <span style={{ color: "#4ade80", fontWeight: 800, fontSize: 15 }}>✓ Claimed</span>
                    </div>
                  ) : canClaim ? (
                    <button onClick={() => claimReward(reward.id, reward.points_required)} disabled={isClaiming}
                      style={{ flex: 1, background: "linear-gradient(to right, #8b5cf6, #00D4FF)", border: "none", borderRadius: 30, padding: "13px 0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <span style={{ fontSize: 16 }}>☆</span>
                      <span style={{ color: "white", fontWeight: 800, fontSize: 15 }}>{isClaiming ? "Claiming..." : "Claim Now"}</span>
                    </button>
                  ) : (
                    <button disabled style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 30, padding: "13px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <span style={{ fontSize: 16 }}>🔒</span>
                      <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 700, fontSize: 14 }}>{progress}</span>
                    </button>
                  )}
                  {/* Location pin */}
                  <button style={{ width: 46, height: 46, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, fontSize: 18 }}>
                    📍
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
