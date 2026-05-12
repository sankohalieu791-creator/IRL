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

type Member = {
  user_name: string
  status: string
  joined_at: string
}

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
}

export default function Communities() {
  const router = useRouter()
  const [user, setUser] = useState("")
  const [school, setSchool] = useState("")
  const [role, setRole] = useState("")
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

  useEffect(() => {
    const u = getUser() || ""
    const s = getSchool() || ""
    setUser(u)
    setSchool(s)
  }, [])

  useEffect(() => {
    if (user) {
      loadCommunities()
      loadMyMemberships()
    }
  }, [user])

  useEffect(() => {
    if (!activeCommunity) return
    const channel = supabase
      .channel(`community-messages-${activeCommunity.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "community_messages",
        filter: `community_id=eq.${activeCommunity.id}`
      }, (payload) => {
        setMessages(prev => {
          const exists = prev.some(m => m.id === (payload.new as Message).id)
          return exists ? prev : [...prev, payload.new as Message]
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeCommunity])

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  async function loadCommunities() {
    const { data } = await supabase
      .from("communities")
      .select("*")
      .order("total_lp", { ascending: false })
    if (!data) return
    const communitiesWithCounts = await Promise.all(
      data.map(async (c) => {
        const { count: memberCount } = await supabase
          .from("community_members")
          .select("*", { count: "exact", head: true })
          .eq("community_id", c.id)
          .eq("status", "accepted")
        const { count: postCount } = await supabase
          .from("community_messages")
          .select("*", { count: "exact", head: true })
          .eq("community_id", c.id)
        return {
          ...c,
          member_count: memberCount || 0,
          link_count: memberCount || 0,
          post_count: postCount || 0
        }
      })
    )
    setCommunities(communitiesWithCounts)
  }

  async function loadMyMemberships() {
    const { data } = await supabase
      .from("community_members")
      .select("community_id, status")
      .eq("user_name", user)
    if (!data) return
    const map: Record<string, string> = {}
    data.forEach(m => { map[m.community_id] = m.status })
    setMyMemberships(map)
  }

  async function linkCommunity(communityId: string, isPrivate = false) {
    setLoading(true)
    const status = isPrivate ? "pending" : "accepted"
    const { error } = await supabase
      .from("community_members")
      .insert({ community_id: communityId, user_name: user, status })
    if (error) {
      alert(`Error: ${error.message}`)
    } else {
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
    const { data } = await supabase
      .from("community_members")
      .select("user_name, status, joined_at")
      .eq("community_id", communityId)
      .eq("status", "accepted")
      .order("joined_at", { ascending: true })
    if (data) setMembers(data)
  }

  async function loadCommunityLeaderboard(communityId: string) {
    const { data: memberData } = await supabase
      .from("community_members")
      .select("user_name")
      .eq("community_id", communityId)
      .eq("status", "accepted")
    if (!memberData) return
    const usernames = memberData.map(m => m.user_name)
    const { data: pointsData } = await supabase
      .from("leaderboard")
      .select("user_name, points, school")
      .in("user_name", usernames)
      .order("points", { ascending: false })
    if (pointsData) {
      setCommunityLeaderboard(pointsData)
      const totalLP = pointsData.reduce((sum, u) => sum + u.points, 0)
      await supabase.from("communities").update({ total_lp: totalLP }).eq("id", communityId)
    }
  }

  async function loadMessages(communityId: string) {
    const { data } = await supabase
      .from("community_messages")
      .select("*")
      .eq("community_id", communityId)
      .order("created_at", { ascending: true })
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
    const { data, error } = await supabase.from("community_messages")
      .insert({
        community_id: communityId,
        sender: user,
        title: title || null,
        message: details,
        media_type: "text",
        is_announcement: false,
        is_pinned: false
      })
      .select("*")
      .single()

    if (error) {
      alert(`Error: ${error.message}`)
      setUserSendingMessage(false)
      return
    }

    if (data) {
      setMessages(prev => [...prev, data as Message])
    }
    setPostTitle("")
    setPostDetails("")
    setUserSendingMessage(false)
  }

  async function sendUserMedia(communityId: string, file: File) {
    setUserUploadingMedia(true)
    const ext = file.name.split(".").pop()
    const fileName = `community-${communityId}-${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from("proof").upload(fileName, file, { upsert: true })
    if (uploadError) { alert(`Upload error: ${uploadError.message}`); setUserUploadingMedia(false); return }
    const { data: urlData } = supabase.storage.from("proof").getPublicUrl(fileName)
    const isVideo = file.type.startsWith("video")
    const { data, error } = await supabase.from("community_messages")
      .insert({
        community_id: communityId,
        sender: user,
        title: postTitle.trim() || null,
        message: postDetails.trim() || "",
        media_url: urlData.publicUrl,
        media_type: isVideo ? "video" : "image",
        is_announcement: false,
        is_pinned: false
      })
      .select("*")
      .single()

    if (error) {
      alert(`Error: ${error.message}`)
      setUserUploadingMedia(false)
      return
    }

    if (data) {
      setMessages(prev => [...prev, data as Message])
    }
    setPostTitle("")
    setPostDetails("")
    setUserUploadingMedia(false)
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(diff / 60000)
    const h = Math.floor(diff / 3600000)
    const d = Math.floor(diff / 86400000)
    if (m < 1) return "just now"
    if (m < 60) return `${m}m`
    if (h < 24) return `${h}h`
    return `${d}d`
  }

  const filteredCommunities = communities.filter((community) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.trim().toLowerCase()
    return [community.name, community.description, community.institution, community.location]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(query))
  })

  if (activeCommunity) {
    const totalLP = communityLeaderboard.reduce((sum, u) => sum + u.points, 0)

    return (
      <div className="flex flex-col h-full bg-black text-white overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-zinc-800">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <button onClick={() => setActiveCommunity(null)}
              className="text-zinc-500 text-sm flex items-center gap-1">
              ← Back
            </button>
            <button style={{ fontSize: 18, cursor: "pointer", color: "rgba(255,255,255,0.5)" }}>
              ⋯
            </button>
          </div>
          
          <h1 className="text-lg font-bold text-white mb-2">{activeCommunity.name}</h1>
          <div style={{
            display: "flex", alignItems: "center", gap: 12, fontSize: 12,
            color: "rgba(255,255,255,0.5)", marginBottom: 12
          }}>
            <span>📍 {activeCommunity.location || activeCommunity.institution}</span>
          </div>

          {/* Stats */}
          <div style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12, padding: "10px 12px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            fontSize: 13, fontWeight: 600, marginBottom: 10
          }}>
            <div style={{ textAlign: "center", flex: 1 }}>
              <p style={{ color: "#00D4FF" }}>{activeCommunity.link_count}</p>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, marginTop: 2 }}>Links</p>
            </div>
            <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)" }} />
            <div style={{ textAlign: "center", flex: 1 }}>
              <p style={{ color: "white" }}>{activeCommunity.post_count}</p>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, marginTop: 2 }}>Posts</p>
            </div>
            <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)" }} />
            <div style={{ textAlign: "center", flex: 1 }}>
              <p style={{ color: "#FFA500" }}>{Math.round(totalLP / 1000)}k</p>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, marginTop: 2 }}>Total LP</p>
            </div>
          </div>

          {/* Link Button */}
          <button onClick={() => {
            if (!myMemberships[activeCommunity.id]) {
              linkCommunity(activeCommunity.id, !!activeCommunity.is_private)
            }
          }}
            disabled={loading || myMemberships[activeCommunity.id] === "accepted"}
            className="w-full py-2 bg-gradient-to-r from-purple-500 to-cyan-400 rounded-lg font-bold text-sm mb-3"
          >
            {myMemberships[activeCommunity.id] === "accepted"
              ? "✓ Linked"
              : myMemberships[activeCommunity.id] === "pending"
              ? "Requested"
              : activeCommunity.is_private ? "🔒 Request" : "Link"}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 flex border-b border-zinc-800">
          {(["feed", "about"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-bold transition-colors ${
                activeTab === tab ? "text-white border-b-2 border-cyan-400" : "text-zinc-500"
              }`}>
              {tab === "feed" ? "Feed" : "About"}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === "feed" && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {myMemberships[activeCommunity.id] === "accepted" && !showCompose && (
              <div className="px-4 pt-3 pb-2">
                <button
                  onClick={() => setShowCompose(true)}
                  className="w-full rounded-3xl bg-zinc-900/90 border border-zinc-800 px-4 py-3 flex items-center justify-between gap-3 text-left"
                >
                  <span className="text-zinc-400 text-sm">Share something...</span>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-cyan-400 text-white text-sm font-bold">+</span>
                </button>
              </div>
            )}

            {myMemberships[activeCommunity.id] === "pending" && (
              <div className="px-4 pt-3 pb-2">
                <button disabled className="w-full rounded-3xl bg-zinc-900/90 border border-zinc-800 px-4 py-3 text-left text-zinc-400">
                  ⏳ Requested access
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 pb-6">
              {showCompose && myMemberships[activeCommunity.id] === "accepted" && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">Create Post</p>
                      <p className="text-xs text-zinc-500">Write a title and some details for your community post</p>
                    </div>
                    <button
                      onClick={() => setShowCompose(false)}
                      className="text-zinc-400 text-sm font-bold rounded-full bg-zinc-800 px-3 py-2"
                    >
                      Close
                    </button>
                  </div>
                  <input
                    value={postTitle}
                    onChange={e => setPostTitle(e.target.value)}
                    placeholder="Post title..."
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-3xl px-4 py-3 text-white placeholder:text-zinc-500 text-sm outline-none"
                  />
                  <textarea
                    value={postDetails}
                    onChange={e => setPostDetails(e.target.value)}
                    placeholder="Add some details..."
                    rows={4}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-3xl px-4 py-3 text-white placeholder:text-zinc-500 text-sm outline-none resize-none"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                      <span className="text-lg">{userUploadingMedia ? "⏳" : "📎"}</span>
                      <input type="file" accept="image/*,video/*" className="hidden" disabled={userUploadingMedia}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file && activeCommunity) sendUserMedia(activeCommunity.id, file)
                        }} />
                      Attach media
                    </label>
                    <button
                      onClick={() => activeCommunity && sendUserMessage(activeCommunity.id)}
                      disabled={userSendingMessage || (!postTitle.trim() && !postDetails.trim())}
                      className="rounded-full px-5 py-3 text-sm font-bold text-white"
                      style={{ background: "linear-gradient(135deg, #8b5cf6, #00d9ff)" }}
                    >
                      {userSendingMessage ? "Posting..." : "Post"}
                    </button>
                  </div>
                </div>
              )}

              {messages.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <p style={{ fontSize: 32, marginBottom: 8 }}>💬</p>
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No posts yet</p>
                </div>
              )}

              {messages.map(msg => (
                <div key={msg.id} style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(0,212,255,0.15)",
                  borderRadius: 12, padding: 12
                }}>
                  {/* Pinned Badge */}
                  {msg.is_announcement && (
                    <div style={{
                      background: "rgba(0,212,255,0.15)",
                      border: "1px solid rgba(0,212,255,0.3)",
                      borderRadius: 6, padding: "2px 8px",
                      display: "inline-flex", alignItems: "center", gap: 4,
                      fontSize: 10, fontWeight: 700, color: "#00D4FF", marginBottom: 8
                    }}>
                      📌 PINNED
                    </div>
                  )}

                  {msg.lp_earned && msg.lp_earned > 0 && (
                    <div style={{
                      float: "right", color: "#00D4FF", fontSize: 11, fontWeight: 700,
                      marginBottom: 8
                    }}>
                      +{msg.lp_earned} LP
                    </div>
                  )}

                  {/* User Header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, clear: "both" }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: "linear-gradient(135deg, #B400FF, #00D4FF)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 900, color: "white", flexShrink: 0
                    }}>
                      {msg.sender.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: "#00D4FF", fontSize: 12, fontWeight: 700 }}>
                        {msg.sender}
                      </p>
                      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, marginTop: 2 }}>
                        {timeAgo(msg.created_at)}
                      </p>
                    </div>
                    {(isCommunityAdmin || msg.sender === user) && (
                      <button onClick={() => deleteMessage(msg.id)}
                        style={{
                          background: "rgba(255,0,0,0.15)",
                          border: "1px solid rgba(255,0,0,0.3)", borderRadius: "50%",
                          width: 24, height: 24, display: "flex", alignItems: "center",
                          justifyContent: "center", cursor: "pointer",
                          fontSize: 11, color: "#f87171"
                        }}>✕</button>
                    )}
                  </div>

                  {/* Title */}
                  {(msg.title || (msg.message && msg.media_type !== "text")) && (
                    <h4 style={{
                      color: "white", fontSize: 16, fontWeight: 800,
                      marginBottom: 10, lineHeight: 1.3
                    }}>
                      {msg.title || msg.message.split('\n')[0]}
                    </h4>
                  )}

                  {/* Media */}
                  {msg.media_url && (
                    <div style={{
                      width: "100%", maxHeight: 200, borderRadius: 8, overflow: "hidden",
                      marginBottom: 12
                    }}>
                      {msg.media_type === "video" ? (
                        <video src={msg.media_url}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          controls playsInline />
                      ) : (
                        <img src={msg.media_url}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      )}
                    </div>
                  )}

                  {/* Message */}
                  {msg.message && (
                    <p style={{
                      color: "rgba(255,255,255,0.75)", fontSize: 14, lineHeight: 1.6,
                      marginBottom: 10
                    }}>
                      {msg.message}
                    </p>
                  )}

                  {/* Engagement */}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

          </div>
        )}

        {/* About Tab */}
        {activeTab === "about" && (
          <div className="flex-1 overflow-y-auto px-4 py-4 pb-20">
            {activeCommunity.description && (
              <div className="mb-6">
                <h3 className="text-sm font-bold text-cyan-400 mb-2">About</h3>
                <p className="text-zinc-300 text-sm">{activeCommunity.description}</p>
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-sm font-bold text-cyan-400 mb-3">Members ({members.length})</h3>
              <div className="space-y-2">
                {members.map((m, i) => (
                  <div key={`${m.user_name}-${i}`} className="flex items-center gap-3 bg-zinc-900/30 px-3 py-2.5 rounded-lg">
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: "linear-gradient(135deg, #B400FF, #00D4FF)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 900, color: "white"
                    }}>
                      {m.user_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-white">{m.user_name}</p>
                    </div>
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
    <div className="flex flex-col h-full bg-black text-white overflow-hidden">
      <main className="flex flex-col flex-1 overflow-y-auto pb-4">
        <div className="p-4 pb-2">
          <button onClick={() => router.push("/sessions")}
            className="text-zinc-500 text-sm mb-3 flex items-center gap-1">
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-cyan-400">Community</h1>
        </div>

        <div className="px-4 pb-4">
          <div style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 16, padding: "10px 14px",
            display: "flex", alignItems: "center", gap: 8,
            marginBottom: 16
          }}>
            <span style={{ fontSize: 14 }}>🔍</span>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search communities..."
              style={{
                flex: 1, background: "transparent", border: "none",
                color: "white", fontSize: 13, outline: "none"
              }}
            />
          </div>
        </div>

        <div className="p-4 space-y-4">
          {communities.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>👥</p>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No communities yet</p>
            </div>
          )}

          {communities.length > 0 && filteredCommunities.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>🔎</p>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No communities match your search</p>
            </div>
          )}

          {filteredCommunities.map((community) => {
            const memberStatus = myMemberships[community.id]
            const isLinked = memberStatus === "accepted"
            const initials = community.name.split(" ").map(word => word.charAt(0)).join("").slice(0, 2).toUpperCase()

            return (
              <div key={community.id} onClick={() => openCommunity(community)} style={{
                background: "#111827",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16, overflow: "hidden",
                boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
                cursor: "pointer"
              }}>
                <div style={{ position: "relative", width: "100%", height: 160, background: "#0f172a" }}>
                  {community.background_image ? (
                    <img src={community.background_image} alt="Community image"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #111827, #0f172a)" }} />
                  )}
                  <div style={{
                    position: "absolute", top: 12, left: 12,
                    width: 48, height: 48, borderRadius: 14,
                    background: "linear-gradient(135deg, #8b5cf6, #00d9ff)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "white", fontWeight: 800, fontSize: 18,
                    boxShadow: "0 8px 20px rgba(0,0,0,0.25)"
                  }}>
                    {initials}
                  </div>
                </div>

                <div style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ fontSize: 17, fontWeight: 800, color: "white", marginBottom: 4, lineHeight: 1.2 }}>
                        {community.name}
                      </h3>
                      <p style={{ color: "#00D9FF", fontSize: 12, marginTop: 2, fontWeight: 700 }}>
                        {community.category || community.institution || "Community"}
                      </p>
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>
                      {community.location || community.institution || "Unknown"}
                    </div>
                  </div>

                  {community.description && (
                    <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 1.5, marginBottom: 12, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {community.description}
                    </p>
                  )}

                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 10,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 14,
                    padding: 12,
                    marginBottom: 14
                  }}>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ color: "#00D9FF", fontWeight: 700, fontSize: 12 }}>{community.link_count || 0}</p>
                      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, marginTop: 2 }}>Links</p>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ color: "white", fontWeight: 700, fontSize: 12 }}>{community.post_count || 0}</p>
                      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, marginTop: 2 }}>Posts</p>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ color: "#FBBF24", fontWeight: 700, fontSize: 12 }}>{community.total_lp ? Math.round(community.total_lp / 1000) : 0}k</p>
                      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, marginTop: 2 }}>LP</p>
                    </div>
                  </div>

                  {!isLinked && !memberStatus && (
                    <button onClick={() => linkCommunity(community.id)} disabled={loading}
                      style={{
                        width: "100%", padding: "12px 14px",
                        background: "linear-gradient(135deg, #8b5cf6, #00d9ff)",
                        border: "none", borderRadius: 14,
                        color: "white", fontSize: 14, fontWeight: 800, cursor: "pointer"
                      }}>
                      🔗 Link
                    </button>
                  )}
                  {isLinked && (
                    <button onClick={() => openCommunity(community)}
                      style={{
                        width: "100%", padding: "12px 14px",
                        background: "linear-gradient(135deg, #8b5cf6, #00d9ff)",
                        border: "none", borderRadius: 14,
                        color: "white", fontSize: 14, fontWeight: 800, cursor: "pointer"
                      }}>
                      Open Community
                    </button>
                  )}
                  {memberStatus && memberStatus !== "accepted" && (
                    <button disabled style={{
                      width: "100%", padding: "12px 14px",
                      background: "rgba(255,255,255,0.08)",
                      border: "none", borderRadius: 14,
                      color: "rgba(255,255,255,0.45)",
                      fontSize: 14, fontWeight: 700
                    }}>
                      {memberStatus === "pending" ? "⏳ Pending" : "✓ Linked"}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
