
"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import BottomNav from "@/components/BottomNav"
import { getUser, getSchool } from "@/lib/auth"

type Community = {
  id: string
  name: string
  description?: string
  category?: string
  location?: string
  institution: string
  total_lp: number
  is_private?: boolean
  member_count?: number
  link_count?: number
  post_count?: number
  image?: string
  background_image?: string
  created_by?: string
}

type Member = { user_name: string; status: string; joined_at: string }

type Message = {
  id: string
  community_id: string
  sender: string
  title?: string
  message: string
  media_url: string | null
  media_type: string
  created_at: string
  is_announcement?: boolean
  lp_earned?: number
  is_pinned?: boolean
  likes?: number
  comments?: number
}

export default function Communities() {
  const router = useRouter()
  const [user, setUser] = useState("")
  const [school, setSchool] = useState("")
  const [communities, setCommunities] = useState<Community[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [myMemberships, setMyMemberships] = useState<Record<string, string>>({})
  const [activeCommunity, setActiveCommunity] = useState<Community | null>(null)
  const [activeTab, setActiveTab] = useState<"feed" | "about">("feed")
  const [members, setMembers] = useState<Member[]>([])
  const [communityLeaderboard, setCommunityLeaderboard] = useState<any[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [isCommunityAdmin, setIsCommunityAdmin] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const [postTitle, setPostTitle] = useState("")
  const [postDetails, setPostDetails] = useState("")
  const [userSendingMessage, setUserSendingMessage] = useState(false)
  const [userUploadingMedia, setUserUploadingMedia] = useState(false)
  const [showCompose, setShowCompose] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newCommunity, setNewCommunity] = useState({
    name: "", description: "", category: "", location: "", is_private: false, background_image: ""
  })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const u = getUser() || ""
    const s = getSchool() || ""
    setUser(u)
    setSchool(s)
  }, [])

  useEffect(() => {
    if (user) { loadCommunities(); loadMyMemberships() }
  }, [user])

  useEffect(() => {
    if (!activeCommunity) return
    const channel = supabase
      .channel(`community-messages-${activeCommunity.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_messages", filter: `community_id=eq.${activeCommunity.id}` },
        (payload) => {
          setMessages(prev => {
            const exists = prev.some(m => m.id === (payload.new as Message).id)
            return exists ? prev : [...prev, payload.new as Message]
          })
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeCommunity])

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function loadCommunities() {
    const { data } = await supabase.from("communities").select("*").order("total_lp", { ascending: false })
    if (!data) return
    const withCounts = await Promise.all(data.map(async (c) => {
      const { count: memberCount } = await supabase.from("community_members").select("*", { count: "exact", head: true }).eq("community_id", c.id).eq("status", "accepted")
      const { count: postCount } = await supabase.from("community_messages").select("*", { count: "exact", head: true }).eq("community_id", c.id)
      return { ...c, member_count: memberCount || 0, link_count: memberCount || 0, post_count: postCount || 0 }
    }))
    setCommunities(withCounts)
  }

  async function loadMyMemberships() {
    const { data } = await supabase.from("community_members").select("community_id, status").eq("user_name", user)
    if (!data) return
    const map: Record<string, string> = {}
    data.forEach(m => { map[m.community_id] = m.status })
    setMyMemberships(map)
  }

  async function linkCommunity(communityId: string, isPrivate = false) {
    setLoading(true)
    const status = isPrivate ? "pending" : "accepted"
    const { error } = await supabase.from("community_members").insert({ community_id: communityId, user_name: user, status })
    if (!error) {
      setMyMemberships(prev => ({ ...prev, [communityId]: status }))
      await loadCommunities()
    }
    setLoading(false)
  }

  async function openCommunity(community: Community) {
    setActiveCommunity(community)
    setActiveTab("feed")
    setShowCompose(false)
    loadMembers(community.id)
    loadCommunityLeaderboard(community.id)
    loadMessages(community.id)
    setIsCommunityAdmin(community.created_by === user)
  }

  async function loadMembers(communityId: string) {
    const { data } = await supabase.from("community_members").select("user_name, status, joined_at").eq("community_id", communityId).eq("status", "accepted").order("joined_at", { ascending: true })
    if (data) setMembers(data)
  }

  async function loadCommunityLeaderboard(communityId: string) {
    const { data: memberData } = await supabase.from("community_members").select("user_name").eq("community_id", communityId).eq("status", "accepted")
    if (!memberData) return
    const usernames = memberData.map(m => m.user_name)
    const { data: pointsData } = await supabase.from("leaderboard").select("user_name, points, school").in("user_name", usernames).order("points", { ascending: false })
    if (pointsData) {
      setCommunityLeaderboard(pointsData)
      const totalLP = pointsData.reduce((sum, u) => sum + u.points, 0)
      await supabase.from("communities").update({ total_lp: totalLP }).eq("id", communityId)
    }
  }

  async function loadMessages(communityId: string) {
    const { data } = await supabase.from("community_messages").select("*").eq("community_id", communityId).order("created_at", { ascending: true })
    if (data) setMessages(data)
  }

  async function deleteMessage(msgId: string) {
    await supabase.from("community_messages").delete().eq("id", msgId)
    setMessages(prev => prev.filter(m => m.id !== msgId))
  }

  async function sendUserMessage(communityId: string) {
    const title = postTitle.trim()
    const details = postDetails.trim()
    if (!title && !details) return
    setUserSendingMessage(true)
    const { data, error } = await supabase.from("community_messages").insert({ community_id: communityId, sender: user, title: title || null, message: details, media_type: "text", is_announcement: false, is_pinned: false }).select("*").single()
    if (!error && data) setMessages(prev => [...prev, data as Message])
    setPostTitle(""); setPostDetails(""); setUserSendingMessage(false)
  }

  async function sendUserMedia(communityId: string, file: File) {
    setUserUploadingMedia(true)
    const ext = file.name.split(".").pop()
    const fileName = `community-${communityId}-${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from("proof").upload(fileName, file, { upsert: true })
    if (uploadError) { setUserUploadingMedia(false); return }
    const { data: urlData } = supabase.storage.from("proof").getPublicUrl(fileName)
    const isVideo = file.type.startsWith("video")
    const { data, error } = await supabase.from("community_messages").insert({ community_id: communityId, sender: user, title: postTitle.trim() || null, message: postDetails.trim() || "", media_url: urlData.publicUrl, media_type: isVideo ? "video" : "image", is_announcement: false, is_pinned: false }).select("*").single()
    if (!error && data) setMessages(prev => [...prev, data as Message])
    setPostTitle(""); setPostDetails(""); setUserUploadingMedia(false)
  }

  async function createCommunity() {
    if (!newCommunity.name.trim()) return
    setCreating(true)
    const { error } = await supabase.from("communities").insert({
      name: newCommunity.name,
      description: newCommunity.description,
      category: newCommunity.category,
      location: newCommunity.location,
      background_image: newCommunity.background_image,
      institution: school || "IRL",
      total_lp: 0,
      is_private: newCommunity.is_private,
      created_by: user
    })
    if (!error) {
      await loadCommunities()
      setShowCreateModal(false)
      setNewCommunity({ name: "", description: "", category: "", location: "", is_private: false, background_image: "" })
    }
    setCreating(false)
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(diff / 60000)
    const h = Math.floor(diff / 3600000)
    const d = Math.floor(diff / 86400000)
    if (m < 1) return "just now"
    if (m < 60) return `${m}m ago`
    if (h < 24) return `${h}h ago`
    return `${d}d ago`
  }

  const filteredCommunities = communities.filter((c) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return [c.name, c.description, c.institution, c.location, c.category].filter(Boolean).some(v => v?.toLowerCase().includes(q))
  })

  // INNER COMMUNITY VIEW
  if (activeCommunity) {
    const totalLP = communityLeaderboard.reduce((sum, u) => sum + u.points, 0)
    const initials = activeCommunity.name.split(" ").map(w => w.charAt(0)).join("").slice(0, 2).toUpperCase()

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#000", color: "white", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <button onClick={() => setActiveCommunity(null)} style={{ color: "rgba(255,255,255,0.6)", fontSize: 20, background: "none", border: "none", cursor: "pointer" }}>←</button>
          <span style={{ fontWeight: 800, fontSize: 15, color: "white" }}>{activeCommunity.name.length > 20 ? activeCommunity.name.slice(0, 20) + "..." : activeCommunity.name}</span>
          <button style={{ fontSize: 20, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)" }}>⤢</button>
        </div>

        {/* Banner + Logo */}
        <div style={{ flexShrink: 0, position: "relative" }}>
          <div style={{ width: "100%", height: 140, background: "#111" }}>
            {activeCommunity.background_image ? (
              <img src={activeCommunity.background_image} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #1a1a2e, #16213e)" }} />
            )}
          </div>
          <div style={{ padding: "0 16px", paddingBottom: 12, background: "#000" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginTop: -28 }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: "linear-gradient(135deg, #8b5cf6, #00d9ff)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 20, color: "white", border: "3px solid #000", flexShrink: 0 }}>
                {initials}
              </div>
              <div style={{ flex: 1, paddingTop: 32 }}>
                <p style={{ fontWeight: 800, fontSize: 16, color: "white", lineHeight: 1.2, marginBottom: 2 }}>{activeCommunity.name}</p>
                <p style={{ color: "#00D4FF", fontSize: 12, fontWeight: 700 }}>{activeCommunity.category || "Community"}</p>
                {(activeCommunity.location || activeCommunity.institution) && (
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 2 }}>📍 {activeCommunity.location || activeCommunity.institution}</p>
                )}
              </div>
              <button
                onClick={() => { if (!myMemberships[activeCommunity.id]) linkCommunity(activeCommunity.id, !!activeCommunity.is_private) }}
                disabled={loading || myMemberships[activeCommunity.id] === "accepted"}
                style={{
                  padding: "8px 18px", borderRadius: 20, border: "none",
                  background: myMemberships[activeCommunity.id] === "accepted" ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #8b5cf6, #00d9ff)",
                  color: "white", fontWeight: 800, fontSize: 13, cursor: "pointer"
                }}
              >
                {myMemberships[activeCommunity.id] === "accepted" ? "✓ Linked" : myMemberships[activeCommunity.id] === "pending" ? "Requested" : "Link"}
              </button>
            </div>

            {/* Stats */}
            <div style={{ display: "flex", gap: 0, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, overflow: "hidden", marginTop: 12 }}>
              {[
                { label: "Links", value: activeCommunity.link_count || 0, color: "#00D4FF" },
                { label: "Posts", value: activeCommunity.post_count || 0, color: "white" },
                { label: "Total LP", value: totalLP > 1000 ? `${Math.round(totalLP / 1000)}k` : totalLP, color: "#FBBF24" },
              ].map((stat, i) => (
                <div key={i} style={{ flex: 1, textAlign: "center", padding: "10px 0", borderRight: i < 2 ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
                  <p style={{ color: stat.color, fontWeight: 700, fontSize: 14 }}>{stat.value}</p>
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, marginTop: 2 }}>{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ flexShrink: 0, display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          {(["feed", "about"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, padding: "12px 0", fontSize: 14, fontWeight: 700,
              color: activeTab === tab ? "white" : "rgba(255,255,255,0.4)",
              background: "none", border: "none", cursor: "pointer",
              borderBottom: activeTab === tab ? "2px solid #00D4FF" : "2px solid transparent"
            }}>
              {tab === "feed" ? "Feed" : "About"}
            </button>
          ))}
        </div>

        {/* Feed */}
        {activeTab === "feed" && (
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {myMemberships[activeCommunity.id] === "accepted" && !showCompose && (
              <div style={{ padding: "12px 16px 8px" }}>
                <button onClick={() => setShowCompose(true)} style={{
                  width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 24, padding: "12px 16px", display: "flex", alignItems: "center",
                  justifyContent: "space-between", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: 14
                }}>
                  <span>Share something...</span>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #8b5cf6, #00d9ff)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 16 }}>+</div>
                </button>
              </div>
            )}

            <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px 80px" }}>
              {showCompose && myMemberships[activeCommunity.id] === "accepted" && (
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 16, marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <p style={{ fontWeight: 700, fontSize: 14 }}>Create Post</p>
                    <button onClick={() => setShowCompose(false)} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, padding: "4px 12px", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 12 }}>Close</button>
                  </div>
                  <input value={postTitle} onChange={e => setPostTitle(e.target.value)} placeholder="Post title..." style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", color: "white", fontSize: 13, marginBottom: 8, outline: "none", boxSizing: "border-box" }} />
                  <textarea value={postDetails} onChange={e => setPostDetails(e.target.value)} placeholder="Add details..." rows={3} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", color: "white", fontSize: 13, resize: "none", outline: "none", boxSizing: "border-box" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                    <label style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                      <span>{userUploadingMedia ? "⏳" : "📎"}</span> Attach
                      <input type="file" accept="image/*,video/*" style={{ display: "none" }} disabled={userUploadingMedia}
                        onChange={e => { const f = e.target.files?.[0]; if (f && activeCommunity) sendUserMedia(activeCommunity.id, f) }} />
                    </label>
                    <button onClick={() => activeCommunity && sendUserMessage(activeCommunity.id)} disabled={userSendingMessage || (!postTitle.trim() && !postDetails.trim())}
                      style={{ background: "linear-gradient(135deg, #8b5cf6, #00d9ff)", border: "none", borderRadius: 20, padding: "8px 20px", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                      {userSendingMessage ? "Posting..." : "Post"}
                    </button>
                  </div>
                </div>
              )}

              {messages.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <p style={{ fontSize: 36 }}>💬</p>
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginTop: 8 }}>No posts yet</p>
                </div>
              )}

              {messages.map(msg => (
                <div key={msg.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, marginBottom: 12, overflow: "hidden" }}>
                  {msg.is_announcement && (
                    <div style={{ background: "rgba(0,212,255,0.1)", padding: "6px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#00D4FF" }}>📌 PINNED</span>
                    </div>
                  )}
                  <div style={{ padding: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #B400FF, #00D4FF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: "white", flexShrink: 0 }}>
                        {msg.sender.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ color: "#00D4FF", fontSize: 13, fontWeight: 700 }}>{msg.sender}</p>
                        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>{timeAgo(msg.created_at)}</p>
                      </div>
                      {msg.lp_earned && msg.lp_earned > 0 && (
                        <span style={{ color: "#00D4FF", fontSize: 12, fontWeight: 700 }}>+{msg.lp_earned} LP</span>
                      )}
                      {(isCommunityAdmin || msg.sender === user) && (
                        <button onClick={() => deleteMessage(msg.id)} style={{ background: "none", border: "none", color: "rgba(255,0,0,0.5)", cursor: "pointer", fontSize: 14 }}>✕</button>
                      )}
                    </div>

                    {msg.title && <h4 style={{ color: "white", fontSize: 15, fontWeight: 800, marginBottom: 6, lineHeight: 1.3 }}>{msg.title}</h4>}

                    {msg.media_url && (
                      <div style={{ borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
                        {msg.media_type === "video" ? (
                          <video src={msg.media_url} controls playsInline style={{ width: "100%", maxHeight: 220, objectFit: "cover" }} />
                        ) : (
                          <img src={msg.media_url} style={{ width: "100%", maxHeight: 220, objectFit: "cover" }} />
                        )}
                      </div>
                    )}

                    {msg.message && <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, lineHeight: 1.6, marginBottom: 10 }}>{msg.message}</p>}

                    {/* Actions row */}
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button onClick={() => {}} style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg, #B400FF, #00D4FF)", border: "none", borderRadius: 20, padding: "8px 14px", color: "white", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>
                        ⚡ TRY IRL
                      </button>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.06)", borderRadius: 20, padding: "8px 12px" }}>
                        <span style={{ fontSize: 11, color: "white", fontWeight: 700 }}>0 Tried</span>
                      </div>
                      <button style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", fontSize: 15 }}>💬</button>
                      <button style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", fontSize: 15 }}>⤢</button>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* About Tab */}
        {activeTab === "about" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 80px" }}>
            {activeCommunity.description && (
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ color: "#00D4FF", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>About</h3>
                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, lineHeight: 1.6 }}>{activeCommunity.description}</p>
              </div>
            )}
            <div>
              <h3 style={{ color: "#00D4FF", fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Members ({members.length})</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {members.map((m, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #B400FF, #00D4FF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: "white" }}>
                      {m.user_name.charAt(0).toUpperCase()}
                    </div>
                    <p style={{ color: "white", fontSize: 13, fontWeight: 600 }}>{m.user_name}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <BottomNav />
      </div>
    )
  }

  // LIST VIEW
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#000", color: "white", overflow: "hidden" }}>
      {/* Create Community Modal */}
      {showCreateModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", alignItems: "flex-end" }}>
          <div style={{ width: "100%", background: "#111", borderRadius: "20px 20px 0 0", padding: 20, maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontWeight: 800, fontSize: 18, color: "white" }}>Create Community</h2>
              <button onClick={() => setShowCreateModal(false)} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 10, padding: "6px 14px", color: "white", cursor: "pointer", fontSize: 13 }}>Cancel</button>
            </div>
            {[
              { placeholder: "Community name *", value: newCommunity.name, key: "name" },
              { placeholder: "Category e.g. Youth Club, School, Sports", value: newCommunity.category, key: "category" },
              { placeholder: "Location e.g. London, Manchester", value: newCommunity.location, key: "location" },
              { placeholder: "Background image URL (optional)", value: newCommunity.background_image, key: "background_image" },
            ].map(field => (
              <input key={field.key} placeholder={field.placeholder} value={field.value}
                onChange={e => setNewCommunity(p => ({ ...p, [field.key]: e.target.value }))}
                style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px 14px", color: "white", fontSize: 14, marginBottom: 10, outline: "none", boxSizing: "border-box" }} />
            ))}
            <textarea placeholder="What is this community about?" value={newCommunity.description}
              onChange={e => setNewCommunity(p => ({ ...p, description: e.target.value }))}
              rows={3} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px 14px", color: "white", fontSize: 14, marginBottom: 10, resize: "none", outline: "none", boxSizing: "border-box" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <input type="checkbox" id="private" checked={newCommunity.is_private} onChange={e => setNewCommunity(p => ({ ...p, is_private: e.target.checked }))} />
              <label htmlFor="private" style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>{newCommunity.is_private ? "🔒 Private" : "🌐 Public"}</label>
            </div>
            <button onClick={createCommunity} disabled={creating || !newCommunity.name.trim()}
              style={{ width: "100%", padding: "14px", background: "linear-gradient(135deg, #8b5cf6, #00d9ff)", border: "none", borderRadius: 14, color: "white", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
              {creating ? "Creating..." : "Create Community"}
            </button>
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 80 }}>
        {/* Header */}
        <div style={{ padding: "16px 16px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: "#00D4FF" }}>Community</h1>
            <button onClick={() => setShowCreateModal(true)} style={{ background: "linear-gradient(135deg, #8b5cf6, #00d9ff)", border: "none", borderRadius: 20, padding: "8px 16px", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              + Create
            </button>
          </div>

          {/* Search */}
          <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 50, padding: "11px 16px", display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 14, color: "rgba(255,255,255,0.4)" }}>🔍</span>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search communities..."
              style={{ flex: 1, background: "transparent", border: "none", color: "white", fontSize: 14, outline: "none" }} />
          </div>
        </div>

        {/* Community Cards */}
        <div style={{ padding: "0 12px", display: "flex", flexDirection: "column", gap: 14 }}>
          {communities.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <p style={{ fontSize: 36 }}>👥</p>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 14, marginTop: 8 }}>No communities yet</p>
              <button onClick={() => setShowCreateModal(true)} style={{ marginTop: 16, background: "linear-gradient(135deg, #8b5cf6, #00d9ff)", border: "none", borderRadius: 14, padding: "12px 24px", color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                Create the first one
              </button>
            </div>
          )}

          {filteredCommunities.map((community) => {
            const memberStatus = myMemberships[community.id]
            const isLinked = memberStatus === "accepted"
            const initials = community.name.split(" ").map(w => w.charAt(0)).join("").slice(0, 2).toUpperCase()

            return (
              <div key={community.id} onClick={() => openCommunity(community)} style={{ background: "#111", borderRadius: 18, overflow: "hidden", cursor: "pointer", border: "1px solid rgba(255,255,255,0.07)" }}>
                {/* Background Image */}
                <div style={{ position: "relative", height: 160 }}>
                  {community.background_image ? (
                    <img src={community.background_image} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }} />
                  )}
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.7) 100%)" }} />
                </div>

                <div style={{ padding: "0 14px 14px" }}>
                  {/* Logo + Name row */}
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginTop: -22, marginBottom: 10 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg, #8b5cf6, #00d9ff)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 20, color: "white", border: "3px solid #111", flexShrink: 0 }}>
                      {initials}
                    </div>
                    <div style={{ paddingTop: 24 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 800, color: "white", lineHeight: 1.2, marginBottom: 2 }}>{community.name}</h3>
                      <p style={{ color: "#00D4FF", fontSize: 12, fontWeight: 700 }}>{community.category || community.institution || "Community"}</p>
                    </div>
                  </div>

                  {/* Description */}
                  {community.description && (
                    <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, lineHeight: 1.5, marginBottom: 12, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {community.description}
                    </p>
                  )}

                  {/* Stats row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, marginBottom: 12 }}>
                    <span><span style={{ color: "#00D4FF", fontWeight: 700 }}>{community.link_count || 0}</span><span style={{ color: "rgba(255,255,255,0.4)" }}> links</span></span>
                    <span><span style={{ color: "white", fontWeight: 700 }}>{community.post_count || 0}</span><span style={{ color: "rgba(255,255,255,0.4)" }}> posts</span></span>
                    <span><span style={{ color: "white", fontWeight: 700 }}>{community.total_lp ? `${Math.round(community.total_lp / 1000)}k` : "0"}</span><span style={{ color: "rgba(255,255,255,0.4)" }}> LP</span></span>
                    {(community.location || community.institution) && (
                      <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.4)" }}>📍 {community.location || community.institution}</span>
                    )}
                  </div>

                  {/* Action button */}
                  {!isLinked && !memberStatus && (
                    <button onClick={e => { e.stopPropagation(); linkCommunity(community.id, !!community.is_private) }} disabled={loading}
                      style={{ width: "100%", padding: "11px", background: "linear-gradient(135deg, #8b5cf6, #00d9ff)", border: "none", borderRadius: 12, color: "white", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
                      🔗 Link
                    </button>
                  )}
                  {isLinked && (
                    <button onClick={() => openCommunity(community)}
                      style={{ width: "100%", padding: "11px", background: "linear-gradient(135deg, #8b5cf6, #00d9ff)", border: "none", borderRadius: 12, color: "white", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
                      Open Community
                    </button>
                  )}
                  {memberStatus && memberStatus !== "accepted" && (
                    <button disabled style={{ width: "100%", padding: "11px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "rgba(255,255,255,0.4)", fontSize: 14, fontWeight: 700 }}>
                      ⏳ Pending
                    </button>
                  )}
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