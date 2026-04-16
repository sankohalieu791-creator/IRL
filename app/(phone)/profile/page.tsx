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
    const { data: lb } = await supabase
      .from("leaderboard").select("points").eq("user_name", USER).maybeSingle()
    if (lb) setPoints(lb.points)

    const { count: sessions } = await supabase
      .from("session_attempts").select("*", { count: "exact", head: true })
      .eq("user_name", USER).eq("status", "accepted")
    if (sessions !== null) { setSessionCount(sessions); setIsVerified(sessions >= 20) }

    const { count: rewards } = await supabase
      .from("user_rewards").select("*", { count: "exact", head: true }).eq("user_name", USER)
    if (rewards !== null) setRewardCount(rewards)

    const { count: tried } = await supabase
      .from("hub_tries").select("*", { count: "exact", head: true }).eq("user_name", USER)
    if (tried !== null) setTotalTried(tried)

    const { data: userData } = await supabase
      .from("users").select("bio").eq("user_name", USER).maybeSingle()
    if (userData?.bio) { setBio(userData.bio); setBioInput(userData.bio) }

    setLoading(false)
  }

  async function loadHubPosts() {
    const { data } = await supabase
      .from("hub_posts").select("*").eq("user_name", USER)
      .order("created_at", { ascending: false })
    if (data) setHubPosts(data)
  }

  async function loadTriedPosts() {
    // Get hub_tries for this user
    const { data: tries } = await supabase
      .from("hub_tries")
      .select("hub_post_id")
      .eq("user_name", USER)
      .order("created_at", { ascending: false })

    if (!tries || tries.length === 0) return

    const ids = tries.map(t => t.hub_post_id)
    const { data: posts } = await supabase
      .from("hub_posts").select("*").in("id", ids)
    if (posts) setTriedPosts(posts)
  }

  async function deleteHubPost(postId: string) {
    if (!confirm("Delete this post?")) return
    await supabase.from("hub_posts").delete().eq("id", postId).eq("user_name", USER)
    setHubPosts(prev => prev.filter(p => p.id !== postId))
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
            <p style={{ color: "white", fontWeight: 800, fontSize: 16, marginTop: 6 }}>
              {selectedPost.session_title}
            </p>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 4 }}>
              👥 {selectedPost.tried_count} tried this
            </p>
            {/* If it's a tried post — show Upload Proof button */}
            {!selectedIsOwn && (selectedPost as TriedPost).session_id && (
              <button
                onClick={() => {
                  setSelectedPost(null)
                  router.push(`/sessions?session=${(selectedPost as TriedPost).session_id}`)
                }}
                style={{
                  marginTop: 12, padding: "10px 20px",
                  background: "linear-gradient(135deg, #B400FF, #00D4FF)",
                  border: "none", borderRadius: 10,
                  color: "white", fontWeight: 800, fontSize: 12, cursor: "pointer"
                }}
              >
                ⚡ Go Upload Proof
              </button>
            )}
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto pb-16">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 24px 20px" }}>

          {/* AVATAR */}
          <div style={{
            width: 88, height: 88, borderRadius: "50%",
            background: "linear-gradient(135deg, #B400FF, #00D4FF)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 36, fontWeight: 900, color: "white", marginBottom: 12,
            border: isVerified ? "3px solid #00D4FF" : "3px solid rgba(255,255,255,0.1)",
            boxShadow: isVerified ? "0 0 20px rgba(0,212,255,0.5)" : "none"
          }}>
            {USER.charAt(0).toUpperCase()}
          </div>

          {/* USERNAME + VERIFIED */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <p style={{ color: "white", fontWeight: 800, fontSize: 18 }}>{USER}</p>
            {isVerified && (
              <div style={{
                background: "linear-gradient(135deg, #B400FF, #00D4FF)",
                borderRadius: "50%", width: 20, height: 20,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, color: "white", fontWeight: 800
              }}>✓</div>
            )}
          </div>

          {/* SCHOOL */}
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 8 }}>{SCHOOL}</p>

          {/* LP BADGE */}
          <div style={{
            background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.3)",
            borderRadius: 100, padding: "4px 16px", marginBottom: 16
          }}>
            <span style={{ color: "#00D4FF", fontWeight: 700, fontSize: 13 }}>⚡ {points} LP</span>
          </div>

          {/* BIO */}
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
            <div style={{ width: "100%", maxWidth: 400, marginBottom: 20, textAlign: "center" }}>
              <p onClick={() => setEditingBio(true)} style={{
                color: bio ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)",
                fontSize: 13, lineHeight: 1.5, cursor: "pointer", minHeight: 20
              }}>
                {bio || "Tap to add a bio..."}
              </p>
            </div>
          )}

          {/* STATS — TikTok style */}
          <div style={{
            display: "flex", width: "100%",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            marginBottom: 16
          }}>
            {[
              { val: sessionCount, label: "Sessions" },
              { val: rewardCount, label: "Rewards" },
              { val: totalTried, label: "Tried" },
            ].map((s, i) => (
              <div key={i} style={{
                flex: 1, padding: "14px 0", textAlign: "center",
                borderRight: i < 2 ? "1px solid rgba(255,255,255,0.08)" : "none"
              }}>
                <p style={{ color: "white", fontWeight: 800, fontSize: 20, lineHeight: 1 }}>{s.val}</p>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 4 }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* LOGOUT */}
          <button onClick={() => { logout(); router.push("/login") }} style={{
            padding: "10px 24px",
            background: "rgba(255,0,0,0.1)",
            border: "1px solid rgba(255,0,0,0.3)",
            borderRadius: 8, color: "#ff6b6b",
            fontWeight: 700, fontSize: 13, cursor: "pointer",
            marginBottom: 8, width: "100%"
          }}>Log Out</button>
        </div>

        {/* TABS */}
        <div style={{
          display: "flex", margin: "0 16px 16px",
          background: "rgba(255,255,255,0.05)",
          borderRadius: 12, padding: 4
        }}>
          <button
            onClick={() => setActiveTab("posts")}
            style={{
              flex: 1, padding: "8px 0", borderRadius: 9, fontSize: 12, fontWeight: 700,
              border: "none", cursor: "pointer",
              background: activeTab === "posts" ? "rgba(255,255,255,0.1)" : "transparent",
              color: activeTab === "posts" ? "white" : "rgba(255,255,255,0.4)"
            }}
          >
            My Posts {hubPosts.length > 0 && `(${hubPosts.length})`}
          </button>
          <button
            onClick={() => setActiveTab("tried")}
            style={{
              flex: 1, padding: "8px 0", borderRadius: 9, fontSize: 12, fontWeight: 700,
              border: "none", cursor: "pointer",
              background: activeTab === "tried" ? "rgba(255,255,255,0.1)" : "transparent",
              color: activeTab === "tried" ? "white" : "rgba(255,255,255,0.4)"
            }}
          >
            Tried IRL {totalTried > 0 && `(${totalTried})`}
          </button>
        </div>

        {/* MY POSTS */}
        {activeTab === "posts" && (
          <div style={{ padding: "0 16px 32px" }}>
            {hubPosts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <p style={{ fontSize: 32, marginBottom: 8 }}>🌍</p>
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No posts yet</p>
                <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, marginTop: 4 }}>Complete a session and share to the Hub</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                {hubPosts.map(post => (
                  <div key={post.id}
                    style={{
                      aspectRatio: "9/16", position: "relative",
                      background: "#111", cursor: "pointer", overflow: "hidden"
                    }}
                  >
                    {/* tap to view */}
                    <div onClick={() => { setSelectedPost(post); setSelectedIsOwn(true) }} style={{ position: "absolute", inset: 0, zIndex: 1 }}>
                      {post.media_type === "video" ? (
                        <video src={post.media_url}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline />
                      ) : (
                        <img src={post.media_url}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
                        <p style={{ color: "white", fontSize: 10, fontWeight: 700, lineHeight: 1.3 }}>{post.session_title}</p>
                        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 9, marginTop: 2 }}>👥 {post.tried_count}</p>
                      </div>
                    </div>
                    {/* delete button */}
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
            )}
          </div>
        )}

        {/* TRIED IRL */}
        {activeTab === "tried" && (
          <div style={{ padding: "0 16px 32px" }}>
            {triedPosts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <p style={{ fontSize: 32, marginBottom: 8 }}>⚡</p>
                <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Nothing tried yet</p>
                <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, marginTop: 4 }}>
                  Press Try IRL on posts in the Hub
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                {triedPosts.map(post => (
                  <div key={post.id}
                    onClick={() => { setSelectedPost(post); setSelectedIsOwn(false) }}
                    style={{
                      aspectRatio: "9/16", position: "relative",
                      background: "#111", cursor: "pointer", overflow: "hidden"
                    }}
                  >
                    {post.media_type === "video" ? (
                      <video src={post.media_url}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline />
                    ) : (
                      <img src={post.media_url}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    )}
                    <div style={{
                      position: "absolute", inset: 0,
                      background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)"
                    }} />
                    {/* TRIED badge */}
                    <div style={{ position: "absolute", top: 6, right: 6 }}>
                      <span style={{
                        background: "linear-gradient(135deg, #B400FF, #00D4FF)",
                        color: "white", fontSize: 8, fontWeight: 800,
                        padding: "3px 7px", borderRadius: 100
                      }}>TRIED ⚡</span>
                    </div>
                    <div style={{ position: "absolute", bottom: 6, left: 6, right: 6 }}>
                      <p style={{ color: "white", fontSize: 10, fontWeight: 700, lineHeight: 1.3 }}>
                        {post.session_title}
                      </p>
                      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 9, marginTop: 2 }}>
                        by {post.user_name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}