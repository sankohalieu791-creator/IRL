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
  session_id?: string
}

type TriedPost = {
  id: string
  session_title: string
  session_type: string
  media_url: string
  media_type: string
  tried_count: number
  user_name: string
  school: string
  session_id: string
}

export default function Profile() {
  const router = useRouter()
  const [USER, setUSER] = useState("")
  const [SCHOOL, setSCHOOL] = useState("")
  const [points, setPoints] = useState(0)
  const [sessionCount, setSessionCount] = useState(0)
  const [rewardCount, setRewardCount] = useState(0)
  const [totalTried, setTotalTried] = useState(0)
  const [hubPosts, setHubPosts] = useState<HubPost[]>([])
  const [triedPosts, setTriedPosts] = useState<TriedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [bio, setBio] = useState("")
  const [editingBio, setEditingBio] = useState(false)
  const [bioInput, setBioInput] = useState("")
  const [selectedPost, setSelectedPost] = useState<HubPost | TriedPost | null>(null)
  const [selectedIsOwn, setSelectedIsOwn] = useState(true)
  const [isVerified, setIsVerified] = useState(false)
  const [activeTab, setActiveTab] = useState<"posts" | "tried">("posts")

  useEffect(() => {
    const u = getUser() || ""
    const s = getSchool() || ""
    setUSER(u)
    setSCHOOL(s)
  }, [])

  useEffect(() => {
    if (USER) {
      loadProfile()
      loadHubPosts()
      loadTriedPosts()
    }
  }, [USER])

  async function loadProfile() {
    const { data: lb } = await supabase.from("leaderboard").select("points").eq("user_name", USER).maybeSingle()
    if (lb) setPoints(lb.points)

    const { count: sessions } = await supabase.from("session_attempts")
      .select("*", { count: "exact", head: true })
      .eq("user_name", USER).eq("status", "accepted")
    if (sessions !== null) { setSessionCount(sessions); setIsVerified(sessions >= 20) }

    const { count: rewards } = await supabase.from("user_rewards")
      .select("*", { count: "exact", head: true }).eq("user_name", USER)
    if (rewards !== null) setRewardCount(rewards)

    const { count: tried } = await supabase.from("hub_tries")
      .select("*", { count: "exact", head: true }).eq("user_name", USER)
    if (tried !== null) setTotalTried(tried)

    const { data: userData } = await supabase.from("users").select("bio").eq("user_name", USER).maybeSingle()
    if (userData?.bio) { setBio(userData.bio); setBioInput(userData.bio) }

    setLoading(false)
  }

  async function loadHubPosts() {
    const { data } = await supabase.from("hub_posts").select("*")
      .eq("user_name", USER).order("created_at", { ascending: false })
    if (data) setHubPosts(data)
  }

  async function loadTriedPosts() {
    const { data: tries } = await supabase.from("hub_tries")
      .select("hub_post_id").eq("user_name", USER)
      .order("created_at", { ascending: false })

    if (!tries || tries.length === 0) return
    const ids = tries.map(t => t.hub_post_id)

    const { data: posts } = await supabase.from("hub_posts").select("*").in("id", ids)
    if (posts) setTriedPosts(posts)
  }

  async function saveBio() {
    await supabase.from("users").update({ bio: bioInput }).eq("user_name", USER)
    setBio(bioInput)
    setEditingBio(false)
  }

  function getTypeColor(type: string) {
    if (type === "Challenge") return "#7c3aed"
    if (type === "Activity") return "#be185d"
    return "#1d4ed8"
  }

  // 🔥 DELETE POST FUNCTION ADDED
  async function deleteHubPost(postId: string) {
    if (!confirm("Delete this post?")) return
    await supabase.from("hub_posts").delete().eq("id", postId).eq("user_name", USER)
    setHubPosts(prev => prev.filter(p => p.id !== postId))
  }

  return (
    <div className="flex flex-col h-full bg-black text-white overflow-hidden">
      <main className="flex-1 overflow-y-auto pb-16">

        {/* MY POSTS */}
        {activeTab === "posts" && (
          <div style={{ padding: "0 16px 32px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              {hubPosts.map(post => (
                <div key={post.id}
                  style={{
                    aspectRatio: "9/16", position: "relative",
                    background: "#111", cursor: "pointer", overflow: "hidden"
                  }}
                >

                  <div onClick={() => { setSelectedPost(post); setSelectedIsOwn(true) }}
                    style={{ position: "absolute", inset: 0, zIndex: 1 }}>

                    {post.media_type === "video" ? (
                      <video src={post.media_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline />
                    ) : (
                      <img src={post.media_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    )}

                    <div style={{
                      position: "absolute", top: 0, left: 0, right: 0, height: 3,
                      background: `linear-gradient(135deg, ${getTypeColor(post.session_type)}, #B400FF)`
                    }} />

                    <div style={{
                      position: "absolute", inset: 0,
                      background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)"
                    }} />

                    <div style={{ position: "absolute", bottom: 6, left: 6, right: 6 }}>
                      <p style={{ color: "white", fontSize: 10, fontWeight: 700 }}>{post.session_title}</p>
                      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 9 }}>👥 {post.tried_count}</p>
                    </div>
                  </div>

                  {/* 🔥 DELETE BUTTON ADDED */}
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteHubPost(post.id) }}
                    style={{
                      position: "absolute", top: 6, right: 6, zIndex: 2,
                      background: "rgba(255,0,0,0.7)", border: "none",
                      borderRadius: "50%", width: 24, height: 24,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", fontSize: 11, color: "white", fontWeight: 700
                    }}
                  >✕</button>

                </div>
              ))}
            </div>
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}