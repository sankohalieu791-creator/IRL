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
      {selectedPost && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#000", display: "flex", flexDirection: "column" }}>
          <button onClick={() => setSelectedPost(null)} style={{ position: "absolute", top: 16, left: 16, zIndex: 110, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "white", fontSize: 18 }}>✕</button>
          {selectedPost.media_type === "video"
            ? <video src={selectedPost.media_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} autoPlay loop playsInline controls />
            : <img src={selectedPost.media_url} style={{ width: "100%", height: "100%", objectFit: "contain" }} />}
        </div>
      )}
      <main className="flex-1 overflow-y-auto pb-16"></main>
      <BottomNav />
    </div>
  )
}