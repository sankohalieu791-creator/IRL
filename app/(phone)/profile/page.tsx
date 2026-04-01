"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getUser, getSchool, logout } from "@/lib/auth"
import BottomNav from "@/components/BottomNav"

type HubPost = {
  id: string
  session_title: string
  session_type: string
  media_url: string
  media_type: string
  tried_count: number
  created_at: string
}

export default function Profile() {
  const router = useRouter()
  const [user, setUser] = useState("")
  const [school, setSchool] = useState("")
  const [points, setPoints] = useState(0)
  const [sessionCount, setSessionCount] = useState(0)
  const [rewardCount, setRewardCount] = useState(0)
  const [totalTried, setTotalTried] = useState(0)
  const [hubPosts, setHubPosts] = useState<HubPost[]>([])
  const [bio, setBio] = useState("")
  const [editingBio, setEditingBio] = useState(false)
  const [bioInput, setBioInput] = useState("")
  const [selectedPost, setSelectedPost] = useState<HubPost | null>(null)
  const [isVerified, setIsVerified] = useState(false)
  const [userTitle, setUserTitle] = useState("")

  useEffect(() => {
    const u = getUser() || ""
    const s = getSchool() || ""
    setUser(u)
    setSchool(s)
  }, [])

  useEffect(() => {
    if (user) {
      loadProfile()
      loadHubPosts()
    }
  }, [user])

  async function loadProfile() {
    const { data: lb } = await supabase
      .from("leaderboard")
      .select("points")
      .eq("user_name", user)
      .maybeSingle()
    if (lb) setPoints(lb.points)

    const { count: sessions } = await supabase
      .from("session_attempts")
      .select("*", { count: "exact", head: true })
      .eq("user_name", user)
      .eq("status", "accepted")
    if (sessions !== null) {
      setSessionCount(sessions)
      setIsVerified(sessions >= 20)
    }

    const { count: rewards } = await supabase
      .from("user_rewards")
      .select("*", { count: "exact", head: true })
      .eq("user_name", user)
    if (rewards !== null) setRewardCount(rewards)

    const { count: tried } = await supabase
      .from("hub_tries")
      .select("*", { count: "exact", head: true })
      .eq("user_name", user)
    if (tried !== null) setTotalTried(tried)

    const { data: userData } = await supabase
      .from("users")
      .select("bio")
      .eq("user_name", user)
      .maybeSingle()
    if (userData?.bio) {
      setBio(userData.bio)
      setBioInput(userData.bio)
    }

    const { data: claimedRewards } = await supabase
      .from("user_rewards")
      .select("reward_id")
      .eq("user_name", user)

    if (claimedRewards && claimedRewards.length > 0) {
      const rewardIds = claimedRewards.map(r => r.reward_id)
      const { data: topReward } = await supabase
        .from("rewards")
        .select("title")
        .in("id", rewardIds)
        .order("points_required", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (topReward) setUserTitle(topReward.title)
    }
  }

  async function loadHubPosts() {
    const { data } = await supabase
      .from("hub_posts")
      .select("*")
      .eq("user_name", user)
      .order("created_at", { ascending: false })
    if (data) setHubPosts(data)
  }

  async function saveBio() {
    await supabase
      .from("users")
      .update({ bio: bioInput })
      .eq("user_name", user)
    setBio(bioInput)
    setEditingBio(false)
  }

  function getTypeColor(type: string) {
    if (type === "Challenge") return "#7c3aed"
    if (type === "Activity") return "#be185d"
    return "#1d4ed8"
  }

  function getAvatarBorder() {
    if (isVerified) return "3px solid #00D4FF"
    if (rewardCount >= 15) return "3px solid #FFD700"
    if (rewardCount >= 10) return "3px solid #C0C0C0"
    if (rewardCount >= 5) return "3px solid #CD7F32"
    return "3px solid rgba(255,255,255,0.1)"
  }

  function getAvatarGlow() {
    if (isVerified) return "0 0 20px rgba(0,212,255,0.5)"
    if (rewardCount >= 15) return "0 0 20px rgba(255,215,0,0.4)"
    if (rewardCount >= 10) return "0 0 16px rgba(192,192,192,0.3)"
    return "none"
  }

  return (
    <div className="flex flex-col h-full bg-black text-white overflow-hidden">
      <main className="flex-1 overflow-y-auto pb-16">

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 24px 20px" }}>
          <div style={{
            width: 88, height: 88, borderRadius: "50%",
            background: "linear-gradient(135deg, #B400FF, #00D4FF)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 36, fontWeight: 900, color: "white",
            marginBottom: 12, border: getAvatarBorder(), boxShadow: getAvatarGlow()
          }}>
            {user ? user.charAt(0).toUpperCase() : "?"}
          </div>

          <p style={{ color: "white", fontWeight: 800, fontSize: 18 }}>{user}</p>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 12 }}>{school}</p>

          <div style={{
            background: "rgba(0,212,255,0.1)",
            border: "1px solid rgba(0,212,255,0.3)",
            borderRadius: 100, padding: "4px 16px", marginBottom: 16
          }}>
            <span style={{ color: "#00D4FF", fontWeight: 700, fontSize: 13 }}>
              ⚡ {points} LP
            </span>
          </div>

          <button
            onClick={() => { logout(); router.push("/login") }}
            style={{
              padding: "10px 24px",
              background: "rgba(255,0,0,0.1)",
              border: "1px solid rgba(255,0,0,0.3)",
              borderRadius: 8, color: "#ff6b6b",
              fontWeight: 700, fontSize: 13,
              cursor: "pointer", marginBottom: 8
            }}
          >
            Log Out
          </button>
        </div>

      </main>
      <BottomNav />
    </div>
  )
}