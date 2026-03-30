"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getUser, getSchool, logout } from "@/lib/auth"
import BottomNav from "@/components/BottomNav"

const USER = getUser() || ""
const SCHOOL = getSchool() || ""

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
  const [points, setPoints] = useState(0)
  const [sessionCount, setSessionCount] = useState(0)
  const [rewardCount, setRewardCount] = useState(0)
  const [totalTried, setTotalTried] = useState(0)
  const [hubPosts, setHubPosts] = useState<HubPost[]>([])
  const [loading, setLoading] = useState(true)
  const [bio, setBio] = useState("")
  const [editingBio, setEditingBio] = useState(false)
  const [bioInput, setBioInput] = useState("")
  const [selectedPost, setSelectedPost] = useState<HubPost | null>(null)

  useEffect(() => {
    loadProfile()
    loadHubPosts()
  }, [])

  async function loadProfile() {
    const { data: lb } = await supabase
      .from("leaderboard")
      .select("points")
      .eq("user_name", USER)
      .maybeSingle()
    if (lb) setPoints(lb.points)

    const { count: sessions } = await supabase
      .from("session_attempts")
      .select("*", { count: "exact", head: true })
      .eq("user_name", USER)
      .eq("status", "accepted")
    if (sessions !== null) setSessionCount(sessions)

    const { count: rewards } = await supabase
      .from("user_rewards")
      .select("*", { count: "exact", head: true })
      .eq("user_name", USER)
    if (rewards !== null) setRewardCount(rewards)

    const { count: tried } = await supabase
      .from("hub_tries")
      .select("*", { count: "exact", head: true })
      .eq("user_name", USER)
    if (tried !== null) setTotalTried(tried)

    const { data: userData } = await supabase
      .from("users")
      .select("bio")
      .eq("user_name", USER)
      .maybeSingle()
    if (userData?.bio) {
      setBio(userData.bio)
      setBioInput(userData.bio)
    }

    setLoading(false)
  }

  async function loadHubPosts() {
    const { data } = await supabase
      .from("hub_posts")
      .select("*")
      .eq("user_name", USER)
      .order("created_at", { ascending: false })
    if (data) setHubPosts(data)
  }

  async function saveBio() {
    await supabase
      .from("users")
      .update({ bio: bioInput })
      .eq("user_name", USER)
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
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "#000",
          display: "flex", flexDirection: "column"
        }}>
          {/* Close button */}
          <button
            onClick={() => setSelectedPost(null)}
            style={{
              position: "absolute", top: 16, left: 16, zIndex: 110,
              background: "rgba(0,0,0,0.6)", border: "none",
              borderRadius: "50%", width: 36, height: 36,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "white", fontSize: 18
            }}
          >
            ✕
          </button>

          {/* Media */}
          {selectedPost.media_type === "video" ? (
            <video
              src={selectedPost.media_url}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              autoPlay
              loop
              playsInline
              controls
            />
          ) : (
            <img
              src={selectedPost.media_url}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          )}

          {/* Post info overlay */}
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
            }}>
              {selectedPost.session_type}
            </span>
            <p style={{ color: "white", fontWeight: 800, fontSize: 16, marginTop: 6 }}>
              {selectedPost.session_title}
            </p>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 4 }}>
              👥 {selectedPost.tried_count} tried this
            </p>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto pb-16">

        {/* PROFILE HEADER */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "32px 24px 20px"
        }}>
          {/* Avatar */}
          <div style={{
            width: 88,
            height: 88,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #B400FF, #00D4FF)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 36,
            fontWeight: 900,
            color: "white",
            marginBottom: 12,
            border: "3px solid rgba(255,255,255,0.1)"
          }}>
            {USER.charAt(0).toUpperCase()}
          </div>

          {/* Username */}
          <p style={{ color: "white", fontWeight: 800, fontSize: 18, marginBottom: 4 }}>
            {USER}
          </p>

          {/* School */}
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 12 }}>
            {SCHOOL}
          </p>

          {/* LP badge */}
          <div style={{
            background: "rgba(0,212,255,0.1)",
            border: "1px solid rgba(0,212,255,0.3)",
            borderRadius: 100,
            padding: "4px 16px",
            marginBottom: 16
          }}>
            <span style={{ color: "#00D4FF", fontWeight: 700, fontSize: 13 }}>
              ⚡ {points} LP
            </span>
          </div>

          {/* Bio */}
          {editingBio ? (
            <div style={{ width: "100%", marginBottom: 16 }}>
              <textarea
                value={bioInput}
                onChange={e => setBioInput(e.target.value)}
                placeholder="Write something about yourself..."
                maxLength={100}
                rows={2}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 12,
                  padding: "10px 14px",
                  color: "white",
                  fontSize: 13,
                  outline: "none",
                  resize: "none",
                  boxSizing: "border-box" as any
                }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  onClick={saveBio}
                  style={{
                    flex: 1, padding: "8px 0",
                    background: "linear-gradient(135deg,#B400FF,#00D4FF)",
                    border: "none", borderRadius: 10,
                    color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer"
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingBio(false)}
                  style={{
                    flex: 1, padding: "8px 0",
                    background: "rgba(255,255,255,0.08)",
                    border: "none", borderRadius: 10,
                    color: "white", fontSize: 13, cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p
              onClick={() => setEditingBio(true)}
              style={{
                color: bio ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)",
                fontSize: 13,
                textAlign: "center",
                marginBottom: 16,
                cursor: "pointer",
                lineHeight: 1.5
              }}
            >
              {bio || "Tap to add a bio..."}
            </p>
          )}

          {/* STATS ROW */}
          <div style={{
            display: "flex",
            width: "100%",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            marginBottom: 4
          }}>
            {[
              { val: sessionCount, label: "Sessions" },
              { val: rewardCount, label: "Rewards" },
              { val: totalTried, label: "Tried" },
            ].map((s, i) => (
              <div key={i} style={{
                flex: 1,
                padding: "14px 0",
                textAlign: "center",
                borderRight: i < 2 ? "1px solid rgba(255,255,255,0.08)" : "none"
              }}>
                <p style={{ color: "white", fontWeight: 800, fontSize: 20 }}>{s.val}</p>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 2 }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Logout button */}
          <button
            onClick={() => { logout(); router.push("/login") }}
            style={{
              width: "100%",
              padding: "10px 0",
              marginTop: 12,
              background: "transparent",
              border: "1px solid rgba(255,0,0,0.3)",
              borderRadius: 12,
              color: "#f87171",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Log Out
          </button>
        </div>

        {/* POSTS GRID */}
        <div style={{
          borderTop: "1px solid rgba(255,255,255,0.08)",
          padding: "16px 0 0"
        }}>
          {hubPosts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 24px" }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>🌍</p>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
                No posts yet
              </p>
              <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, marginTop: 4 }}>
                Complete a session and share to the Hub
              </p>
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 2
            }}>
              {hubPosts.map(post => (
                <div
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                  style={{
                    aspectRatio: "9/16",
                    position: "relative",
                    background: "#111",
                    cursor: "pointer",
                    overflow: "hidden"
                  }}
                >
                  {/* Thumbnail */}
                  {post.media_type === "video" ? (
                    <video
                      src={post.media_url}
                      style={{
                        width: "100%", height: "100%",
                        objectFit: "cover"
                      }}
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      src={post.media_url}
                      style={{
                        width: "100%", height: "100%",
                        objectFit: "cover"
                      }}
                    />
                  )}

                  {/* Type color bar at top */}
                  <div style={{
                    position: "absolute", top: 0, left: 0, right: 0,
                    height: 3,
                    background: `linear-gradient(135deg, ${getTypeColor(post.session_type)}, #B400FF)`
                  }} />

                  {/* Tried count overlay */}
                  <div style={{
                    position: "absolute", bottom: 4, left: 4,
                    display: "flex", alignItems: "center", gap: 3
                  }}>
                    <span style={{
                      color: "white", fontSize: 10, fontWeight: 700,
                      textShadow: "0 1px 4px rgba(0,0,0,0.8)"
                    }}>
                      👥 {post.tried_count}
                    </span>
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