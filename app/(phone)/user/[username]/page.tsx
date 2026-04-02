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

export default function PublicProfile() {
  const router = useRouter()
  const params = useParams()
  const username = decodeURIComponent(params.username as string)

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
    if (username) {
      loadProfile()
      loadHubPosts()
    }
  }, [username])

  async function loadProfile() {
    const { data: userData } = await supabase
      .from("users").select("bio, school").eq("user_name", username).maybeSingle()
    if (userData) { setBio(userData.bio || ""); setSchool(userData.school || "") }

    const { data: lb } = await supabase
      .from("leaderboard").select("points").eq("user_name", username).maybeSingle()
    if (lb) setPoints(lb.points)

    const { count: sessions } = await supabase
      .from("session_attempts").select("*", { count: "exact", head: true })
      .eq("user_name", username).eq("status", "accepted")
    if (sessions !== null) { setSessionCount(sessions); setIsVerified(sessions >= 20) }

    const { count: rewards } = await supabase
      .from("user_rewards").select("*", { count: "exact", head: true }).eq("user_name", username)
    if (rewards !== null) setRewardCount(rewards)

    const { count: tried } = await supabase
      .from("hub_tries").select("*", { count: "exact", head: true }).eq("user_name", username)
    if (tried !== null) setTotalTried(tried)

    setLoading(false)
  }

  async function loadHubPosts() {
    const { data } = await supabase
      .from("hub_posts").select("*").eq("user_name", username)
      .order("created_at", { ascending: false })
    if (data) setHubPosts(data)
  }

  function getTypeColor(type: string) {
    if (type === "Challenge") return "#7c3aed"
    if (type === "Activity") return "#be185d"
    return "#1d4ed8"
  }

  if (loading) return (
    <div style={{ height: "100%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#52525b", fontSize: 13 }}>Loading...</p>
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-black text-white overflow-hidden">

      {/* FULLSCREEN POST VIEWER */}
      {selectedPost && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#000", display: "flex", flexDirection: "column" }}>
          <button onClick={() => setSelectedPost(null)} style={{
            position: "absolute", top: 16, left: 16, zIndex: 110,
            background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%",
            width: 36, height: 36, display: "flex", alignItems: "center",
            justifyContent: "center", cursor: "pointer", color: "white", fontSize: 18
          }}>✕</button>
          {selectedPost.media_type === "video" ? (
            <video src={selectedPost.media_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} autoPlay loop playsInline controls />
          ) : (
            <img src={selectedPost.media_url} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          )}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "24px 16px", background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)", zIndex: 110 }}>
            <span style={{ background: `linear-gradient(135deg, ${getTypeColor(selectedPost.session_type)}, #B400FF)`, color: "white", fontSize: 10, fontWeight: 800, padding: "4px 12px", borderRadius: 100, textTransform: "uppercase" as any, letterSpacing: 1, marginBottom: 8, display: "inline-block" }}>
              {selectedPost.session_type}
            </span>
            <p style={{ color: "white", fontWeight: 800, fontSize: 16, marginTop: 6 }}>{selectedPost.session_title}</p>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 4 }}>👥 {selectedPost.tried_count} tried this</p>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto pb-16">

        {/* BACK */}
        <div style={{ padding: "16px 16px 0" }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer" }}>
            ← Back
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 24px" }}>

          {/* Avatar */}
          <div style={{ width: 88, height: 88, borderRadius: "50%", background: "linear-gradient(135deg, #B400FF, #00D4FF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, fontWeight: 900, color: "white", marginBottom: 12, border: isVerified ? "3px solid #00D4FF" : "3px solid rgba(255,255,255,0.1)", boxShadow: isVerified ? "0 0 20px rgba(0,212,255,0.4)" : "none" }}>
            {username.charAt(0).toUpperCase()}
          </div>

          {/* Username + verified */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <p style={{ color: "white", fontWeight: 800, fontSize: 18 }}>{username}</p>
            {isVerified && (
              <div style={{ background: "linear-gradient(135deg, #B400FF, #00D4FF)", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "white", fontWeight: 800 }}>✓</div>
            )}
          </div>

          {/* School */}
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 8 }}>{school}</p>

          {/* LP */}
          <div style={{ background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.3)", borderRadius: 100, padding: "4px 16px", marginBottom: 12 }}>
            <span style={{ color: "#00D4FF", fontWeight: 700, fontSize: 13 }}>⚡ {points} LP</span>
          </div>

          {/* Bio */}
          {bio ? (
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, textAlign: "center", marginBottom: 16, lineHeight: 1.5 }}>{bio}</p>
          ) : (
            <div style={{ marginBottom: 16 }} />
          )}

          {/* STATS — TikTok style */}
          <div style={{ display: "flex", gap: 32, borderTop: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingTop: 16, paddingBottom: 16, width: "100%", marginBottom: 8 }}>
            {[
              { val: sessionCount, label: "Sessions" },
              { val: rewardCount, label: "Rewards" },
              { val: totalTried, label: "Tried" },
            ].map((s, i) => (
              <div key={i} style={{ flex: 1, textAlign: "center" }}>
                <p style={{ color: "white", fontWeight: 800, fontSize: 20, lineHeight: 1 }}>{s.val}</p>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 4 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* HUB POSTS */}
        <div style={{ padding: "0 16px 32px" }}>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 12, textTransform: "uppercase" as any, letterSpacing: 1, fontWeight: 700 }}>
            Hub Posts
          </p>
          {hubPosts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>🌍</p>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No posts yet</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {hubPosts.map(post => (
                <div key={post.id} onClick={() => setSelectedPost(post)} style={{ position: "relative", overflow: "hidden", borderRadius: 12, aspectRatio: "1 / 1", cursor: "pointer", background: "#27272a" }}>
                  {post.media_type === "video" ? (
                    <video src={post.media_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline />
                  ) : (
                    <img src={post.media_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  )}
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "flex-end", padding: 8 }}>
                    <p style={{ color: "white", fontWeight: 700, fontSize: 11, lineHeight: 1.3 }}>{post.session_title}</p>
                  </div>
                  <div style={{ position: "absolute", bottom: 8, right: 8 }}>
                    <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 10 }}>👥 {post.tried_count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}