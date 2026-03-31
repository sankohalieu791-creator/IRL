"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
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

type UserRow = {
  bio: string | null
  school: string | null
}

type LeaderboardRow = {
  points: number
}

export default function PublicProfile() {
  const router = useRouter()
  const params = useParams()

  // ✅ FIX 1 — Safe param normalization
  const usernameParam = params?.username
  const username =
    typeof usernameParam === "string"
      ? usernameParam
      : Array.isArray(usernameParam)
      ? usernameParam[0]
      : ""

  const [points, setPoints] = useState(0)
  const [sessionCount, setSessionCount] = useState(0)
  const [rewardCount, setRewardCount] = useState(0)
  const [totalTried, setTotalTried] = useState(0)
  const [bio, setBio] = useState("")
  const [school, setSchool] = useState("")
  const [hubPosts, setHubPosts] = useState<HubPost[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPost, setSelectedPost] = useState<HubPost | null>(null)
  const [isVerified, setIsVerified] = useState(false)

  useEffect(() => {
    if (!username) return
    loadProfile()
    loadHubPosts()
  }, [username])

  async function loadProfile() {
    const { data: userData } = await supabase
      .from("users")
      .select("bio, school")
      .eq("user_name", username)
      .maybeSingle<UserRow>()

    if (userData) {
      setBio(userData.bio ?? "")
      setSchool(userData.school ?? "")
    }

    const { data: lb } = await supabase
      .from("leaderboard")
      .select("points")
      .eq("user_name", username)
      .maybeSingle<LeaderboardRow>()

    if (lb) setPoints(lb.points)

    const { count: sessions } = await supabase
      .from("session_attempts")
      .select("*", { count: "exact", head: true })
      .eq("user_name", username)
      .eq("status", "accepted")

    if (sessions !== null) {
      setSessionCount(sessions)
      setIsVerified(sessions >= 20)
    }

    const { count: rewards } = await supabase
      .from("user_rewards")
      .select("*", { count: "exact", head: true })
      .eq("user_name", username)

    if (rewards !== null) setRewardCount(rewards)

    const { count: tried } = await supabase
      .from("hub_tries")
      .select("*", { count: "exact", head: true })
      .eq("user_name", username)

    if (tried !== null) setTotalTried(tried)

    setLoading(false)
  }

  async function loadHubPosts() {
    const { data } = await supabase
      .from("hub_posts")
      .select("*")
      .eq("user_name", username)
      .order("created_at", { ascending: false })

    if (data) setHubPosts(data as HubPost[])
  }

  function getTypeColor(type: string) {
    if (type === "Challenge") return "#7c3aed"
    if (type === "Activity") return "#be185d"
    return "#1d4ed8"
  }

  // ✅ FIX 2 — Prevent hydration crash
  if (!username || loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-black">
        <p className="text-zinc-500 text-sm">Loading...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-black text-white overflow-hidden">
      {/* PAGE CONTENT UNCHANGED BELOW */}
      {/* (rest of your JSX stays exactly the same) */}
      <main className="flex-1 overflow-y-auto pb-16">
        <div style={{ padding: "16px 16px 0" }}>
          <button
            onClick={() => router.back()}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.5)",
              fontSize: 13,
              cursor: "pointer"
            }}
          >
            ← Back
          </button>
        </div>

        {/* Avatar + Username */}
        <div className="flex flex-col items-center p-6">
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: "50%",
              background: "linear-gradient(135deg,#B400FF,#00D4FF)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              fontWeight: 900,
              border: isVerified
                ? "3px solid #00D4FF"
                : "3px solid rgba(255,255,255,0.1)"
            }}
          >
            {username.charAt(0).toUpperCase()}
          </div>

          <p className="text-lg font-bold mt-3">{username}</p>
          <p className="text-zinc-500 text-sm">{school}</p>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}