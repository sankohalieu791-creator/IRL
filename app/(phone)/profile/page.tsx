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
  const [hubPosts, setHubPosts] = useState<HubPost[]>([])
  const [bio, setBio] = useState("")
  const [editingBio, setEditingBio] = useState(false)
  const [bioInput, setBioInput] = useState("")
  const [selectedPost, setSelectedPost] = useState<HubPost | null>(null)
  const [isVerified, setIsVerified] = useState(false)
  const [userTitle, setUserTitle] = useState("")
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const u = getUser() || ""
    const s = getSchool() || ""
    setUser(u)
    setSchool(s)
    setReady(true)
  }, [])

  useEffect(() => {
    if (ready && user) {
      loadProfile()
      loadHubPosts()
    }
  }, [ready, user])

  async function loadProfile() {
    const { data: lb } = await supabase
      .from("leaderboard").select("points").eq("user_name", user).maybeSingle()
    if (lb) setPoints(lb.points)

    const { count: sessions } = await supabase
      .from("session_attempts").select("*", { count: "exact", head: true })
      .eq("user_name", user).eq("status", "accepted")
    if (sessions !== null) {
      setSessionCount(sessions)
      setIsVerified(sessions >= 20)
    }

    const { count: rewards } = await supabase
      .from("user_rewards").select("*", { count: "exact", head: true }).eq("user_name", user)
    if (rewards !== null) setRewardCount(rewards)

    const { data: userData } = await supabase
      .from("users").select("bio").eq("user_name", user).maybeSingle()
    if (userData?.bio) { setBio(userData.bio); setBioInput(userData.bio) }

    const { data: claimedRewards } = await supabase
      .from("user_rewards").select("reward_id").eq("user_name", user)
    if (claimedRewards && claimedRewards.length > 0) {
      const ids = claimedRewards.map(r => r.reward_id)
      const { data: topReward } = await supabase
        .from("rewards").select("title").in("id", ids)
        .order("points_required", { ascending: false }).limit(1).maybeSingle()
      if (topReward) setUserTitle(topReward.title)
    }
  }

  async function loadHubPosts() {
    const { data } = await supabase
      .from("hub_posts").select("*").eq("user_name", user)
      .order("created_at", { ascending: false })
    if (data) setHubPosts(data)
  }

  async function saveBio() {
    await supabase.from("users").update({ bio: bioInput }).eq("user_name", user)
    setBio(bioInput)
    setEditingBio(false)
  }

  function getTypeColor(type: string) {
    if (type === "Challenge") return "#7c3aed"
    if (type === "Activity") return "#be185d"
    return "#1d4ed8"
  }

  if (!ready) return (
    <div style={{ height: "100%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#52525b", fontSize: 13 }}>Loading...</p>
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-black text-white overflow-hidden">

      {selectedPost && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#000", display: "flex", flexDirection: "column" }}>
          <button onClick={() => setSelectedPost(null)} style={{
            position: "absolute", top: 16, left: 16, zIndex: 110,
            background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%",
            width: 36, height: 36, display: "flex", alignItems: "center",
            justifyContent: "center", cursor: "pointer", color: "white", fontSize: 18
          }}>✕</button>
          {selectedPost.media_type === "video" ? (
            <video src={selectedPost.media_url}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              autoPlay loop playsInline controls />
          ) : (
            <img src={selectedPost.media_url}
              style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          )}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            padding: "24px 16px",
            background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)",
            zIndex: 110
          }}>
            <span style={{
              background: `linear-gradient(135deg, ${getTypeColor(selectedPost.session_type)}, #B400FF)`,
              color: "white", fontSize: 10, fontWeight: 800,
              padding: "4px 12px", borderRadius: 100,
              textTransform: "uppercase" as any, letterSpacing: 1,
              marginBottom: 8, display: "inline-block"
            }}>{selectedPost.session_type}</span>
            <p style={{ color: "white", fontWeight: 800, fontSize: 16, marginTop: 6 }}>{selectedPost.session_title}</p>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 4 }}>👥 {selectedPost.tried_count} tried this</p>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto pb-16">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 24px 20px" }}>

          <div style={{
            width: 88, height: 88, borderRadius: "50%",
            background: "linear-gradient(135deg, #B400FF, #00D4FF)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 36, fontWeight: 900, color: "white", marginBottom: 12,
            border: isVerified ? "3px solid #00D4FF" : "3px solid rgba(255,255,255,0.1)",
            boxShadow: isVerified ? "0 0 20px rgba(0,212,255,0.5)" : "none"
          }}>
            {user.charAt(0).toUpperCase()}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <p style={{ color: "white", fontWeight: 800, fontSize: 18 }}>{user}</p>
            {isVerified && (
              <div style={{
                background: "linear-gradient(135deg, #B400FF, #00D4FF)",
                borderRadius: "50%", width: 20, height: 20,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, color: "white", fontWeight: 800
              }}>✓</div>
            )}
          </div>

          {userTitle && (
            <p style={{ color: "#FFD700", fontSize: 11, fontWeight: 700, marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" as any }}>
              {userTitle}
            </p>
          )}

          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 12 }}>{school}</p>

          <div style={{
            background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.3)",
            borderRadius: 100, padding: "4px 16px", marginBottom: 16
          }}>
            <span style={{ color: "#00D4FF", fontWeight: 700, fontSize: 13 }}>⚡ {points} LP</span>
          </div>

          {editingBio ? (
            <div style={{ width: "100%", maxWidth: 400, marginBottom: 20 }}>
              <textarea value={bioInput} onChange={e => setBioInput(e.target.value)}
                placeholder="Write something about yourself..." maxLength={100}
                style={{
                  width: "100%", padding: "12px 16px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(0,212,255,0.3)",
                  borderRadius: 12, color: "white", fontSize: 13,
                  fontFamily: "inherit", minHeight: 80, marginBottom: 8,
                  boxSizing: "border-box" as any, resize: "none" as any
                }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={saveBio} style={{
                  flex: 1, padding: "10px 16px",
                  background: "linear-gradient(135deg, #B400FF, #00D4FF)",
                  border: "none", borderRadius: 8, color: "white",
                  fontWeight: 700, fontSize: 12, cursor: "pointer"
                }}>Save</button>
                <button onClick={() => setEditingBio(false)} style={{
                  flex: 1, padding: "10px 16px",
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 8, color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer"
                }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ width: "100%", maxWidth: 400, marginBottom: 20 }}>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, lineHeight: 1.5, marginBottom: 12, minHeight: 40, textAlign: "center" }}>
                {bio || "No bio yet"}
              </p>
              <button onClick={() => setEditingBio(true)} style={{
                width: "100%", padding: "10px 16px",
                background: "rgba(0,212,255,0.1)",
                border: "1px solid rgba(0,212,255,0.3)",
                borderRadius: 8, color: "#00D4FF",
                fontWeight: 700, fontSize: 12, cursor: "pointer"
              }}>{bio ? "Edit Bio" : "Add Bio"}</button>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, width: "100%", maxWidth: 400, marginBottom: 24 }}>
            <div style={{ background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 12, padding: "16px 12px", textAlign: "center" }}>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginBottom: 4 }}>Sessions</p>
              <p style={{ color: "#00D4FF", fontWeight: 800, fontSize: 18 }}>{sessionCount}</p>
            </div>
            <div style={{ background: "rgba(180,0,255,0.05)", border: "1px solid rgba(180,0,255,0.2)", borderRadius: 12, padding: "16px 12px", textAlign: "center" }}>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginBottom: 4 }}>Rewards</p>
              <p style={{ color: "#B400FF", fontWeight: 800, fontSize: 18 }}>{rewardCount}</p>
            </div>
          </div>

          <button onClick={() => { logout(); router.push("/login") }} style={{
            padding: "12px 24px", background: "rgba(255,0,0,0.1)",
            border: "1px solid rgba(255,0,0,0.3)", borderRadius: 8,
            color: "#ff6b6b", fontWeight: 700, fontSize: 13,
            cursor: "pointer", marginBottom: 24
          }}>Log Out</button>
        </div>

        <div style={{ padding: "0 16px 32px" }}>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 12, textTransform: "uppercase" as any, letterSpacing: 1, fontWeight: 700 }}>
            Your Hub Posts
          </p>
          {hubPosts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>🌍</p>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No posts yet — complete a session and share to the Hub</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {hubPosts.map(post => (
                <div key={post.id} onClick={() => setSelectedPost(post)} style={{
                  background: "#18181b", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 16, overflow: "hidden", cursor: "pointer"
                }}>
                  <div style={{ position: "relative", height: 180 }}>
                    {post.media_type === "video" ? (
                      <video src={post.media_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline />
                    ) : (
                      <img src={post.media_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    )}
                    <div style={{ position: "absolute", top: 10, left: 10 }}>
                      <span style={{
                        background: `linear-gradient(135deg, ${getTypeColor(post.session_type)}, #B400FF)`,
                        color: "white", fontSize: 10, fontWeight: 800,
                        padding: "3px 10px", borderRadius: 100,
                        textTransform: "uppercase" as any, letterSpacing: 1
                      }}>{post.session_type}</span>
                    </div>
                  </div>
                  <div style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <p style={{ color: "white", fontWeight: 700, fontSize: 13 }}>{post.session_title}</p>
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>👥 {post.tried_count}</p>
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