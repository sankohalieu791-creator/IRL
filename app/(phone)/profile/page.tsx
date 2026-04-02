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
      .from("user_rewards").select("*", { count: "exact", head: true })
      .eq("user_name", user)
    if (rewards !== null) setRewardCount(rewards)

    const { data: userData } = await supabase
      .from("users").select("bio").eq("user_name", user).maybeSingle()
    if (userData?.bio) { setBio(userData.bio); setBioInput(userData.bio) }
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
            <p style={{ color: "white", fontWeight: 800, fontSize: 16, marginTop: 6 }}>{selectedPost.session_title}</p>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 4 }}>👥 {selectedPost.tried_count} tried this</p>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto pb-16 text-white">
        <div className="flex flex-col items-center p-6 pb-4">

          {/* Avatar */}
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: "linear-gradient(135deg, #B400FF, #00D4FF)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, fontWeight: 900, color: "white", marginBottom: 12,
            border: isVerified ? "3px solid #00D4FF" : "3px solid rgba(255,255,255,0.1)",
            boxShadow: isVerified ? "0 0 20px rgba(0,212,255,0.5)" : "none"
          }}>
            {user.charAt(0).toUpperCase()}
          </div>

          {/* Username + verified */}
          <div className="flex items-center gap-2 mb-1">
            <p className="text-white font-bold text-lg">{user}</p>
            {isVerified && (
              <div style={{
                background: "linear-gradient(135deg, #B400FF, #00D4FF)",
                borderRadius: "50%", width: 18, height: 18,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, color: "white", fontWeight: 800
              }}>✓</div>
            )}
          </div>

          <p className="text-zinc-500 text-sm mb-3">{school}</p>

          {/* LP */}
          <div className="bg-cyan-400/10 border border-cyan-400/30 rounded-full px-4 py-1 mb-4">
            <span className="text-cyan-400 font-bold text-sm">⚡ {points} LP</span>
          </div>

          {/* Bio */}
          {editingBio ? (
            <div className="w-full mb-4">
              <textarea value={bioInput} onChange={e => setBioInput(e.target.value)}
                placeholder="Write something about yourself..." maxLength={100}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-white text-sm resize-none focus:outline-none focus:border-cyan-400"
                rows={2} />
              <div className="flex gap-2 mt-2">
                <button onClick={saveBio} className="flex-1 py-2 bg-gradient-to-r from-purple-500 to-cyan-400 rounded-xl text-sm font-bold text-white">Save</button>
                <button onClick={() => setEditingBio(false)} className="flex-1 py-2 bg-zinc-800 rounded-xl text-sm text-zinc-400">Cancel</button>
              </div>
            </div>
          ) : (
            <p onClick={() => setEditingBio(true)}
              className="text-zinc-400 text-sm text-center mb-4 cursor-pointer min-h-[20px]">
              {bio || "Tap to add a bio..."}
            </p>
          )}

          {/* STATS */}
          <div className="grid grid-cols-2 gap-3 w-full mb-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
              <p className="text-cyan-400 font-black text-2xl">{sessionCount}</p>
              <p className="text-zinc-500 text-xs mt-1">Sessions</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
              <p className="text-purple-400 font-black text-2xl">{rewardCount}</p>
              <p className="text-zinc-500 text-xs mt-1">Rewards</p>
            </div>
          </div>

          {/* Logout */}
          <button onClick={() => { logout(); router.push("/login") }}
            className="w-full py-2.5 border border-red-400/30 text-red-400 rounded-xl text-sm font-semibold mb-2">
            Log Out
          </button>
        </div>

        {/* HUB POSTS */}
        <div className="px-4 pb-6">
          <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold mb-3">Your Hub Posts</p>
          {hubPosts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">🌍</p>
              <p className="text-zinc-600 text-sm">No posts yet</p>
              <p className="text-zinc-700 text-xs mt-1">Complete a session and share it to the Hub</p>
            </div>
          ) : (
            <div className="space-y-3">
              {hubPosts.map(post => (
                <div key={post.id} onClick={() => setSelectedPost(post)}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden cursor-pointer">
                  <div className="relative h-40">
                    {post.media_type === "video" ? (
                      <video src={post.media_url} className="w-full h-full object-cover" muted playsInline />
                    ) : (
                      <img src={post.media_url} className="w-full h-full object-cover" />
                    )}
                    <div className="absolute top-2 left-2">
                      <span style={{
                        background: `linear-gradient(135deg, ${getTypeColor(post.session_type)}, #B400FF)`,
                        color: "white", fontSize: 10, fontWeight: 800,
                        padding: "3px 10px", borderRadius: 100,
                        textTransform: "uppercase" as any, letterSpacing: 1
                      }}>{post.session_type}</span>
                    </div>
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <p className="text-white text-sm font-bold">{post.session_title}</p>
                    <p className="text-zinc-500 text-xs">👥 {post.tried_count} tried</p>
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