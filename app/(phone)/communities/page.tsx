"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import BottomNav from "@/components/BottomNav"
import { getUser, getSchool } from "@/lib/auth"

type Community = {
  id: string
  name: string
  description: string
  institution: string
  total_lp: number
  member_count?: number
  link_count?: number
  post_count?: number
  image?: string
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
  message: string
  media_url: string | null
  media_type: string
  created_at: string
  is_announcement?: boolean
}

export default function Communities() {
  const router = useRouter()
  const [user, setUser] = useState("")
  const [school, setSchool] = useState("")
  const [role, setRole] = useState("")
  const [communities, setCommunities] = useState<Community[]>([])
  const [myMemberships, setMyMemberships] = useState<Record<string, string>>({})
  const [activeCommunity, setActiveCommunity] = useState<Community | null>(null)
  const [activeTab, setActiveTab] = useState<"feed" | "leaderboard" | "members">("feed")
  const [members, setMembers] = useState<Member[]>([])
  const [communityLeaderboard, setCommunityLeaderboard] = useState<any[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const [userMessageText, setUserMessageText] = useState("")
  const [userSendingMessage, setUserSendingMessage] = useState(false)
  const [userUploadingMedia, setUserUploadingMedia] = useState(false)
  const [announcementText, setAnnouncementText] = useState("")
  const [postingAnnouncement, setPostingAnnouncement] = useState(false)

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
      checkIfAdmin()
    }
  }, [user])

  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" })
    }, 100)
  }, [messages])

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
        setMessages(prev => [...prev, payload.new as Message])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeCommunity])

  async function checkIfAdmin() {
    const { data } = await supabase
      .from("users")
      .select("role")
      .eq("user_name", user)
      .maybeSingle()
    if (data?.role === "admin") setRole("admin")
  }

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
          .neq("media_type", "text")
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

  async function linkCommunity(communityId: string) {
    setLoading(true)
    const { error } = await supabase
      .from("community_members")
      .insert({ community_id: communityId, user_name: user, status: "accepted" })
    if (error) {
      alert(`Error: ${error.message}`)
    } else {
      setMyMemberships(prev => ({ ...prev, [communityId]: "accepted" }))
      await loadCommunities()
    }
    setLoading(false)
  }

  async function openCommunity(community: Community) {
    setActiveCommunity(community)
    setActiveTab("feed")
    loadMembers(community.id)
    loadCommunityLeaderboard(community.id)
    loadMessages(community.id)
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
    if (!userMessageText.trim()) return
    setUserSendingMessage(true)
    await supabase.from("community_messages").insert({
      community_id: communityId,
      sender: user,
      message: userMessageText.trim(),
      media_type: "text",
      is_announcement: false
    })
    setUserMessageText("")
    await loadMessages(communityId)
    setUserSendingMessage(false)
  }

  async function postAnnouncement(communityId: string) {
    if (!announcementText.trim()) return
    setPostingAnnouncement(true)
    await supabase.from("community_messages").insert({
      community_id: communityId,
      sender: user,
      message: announcementText.trim(),
      media_type: "text",
      is_announcement: true
    })
    setAnnouncementText("")
    await loadMessages(communityId)
    setPostingAnnouncement(false)
  }

  async function sendUserMedia(communityId: string, file: File) {
    setUserUploadingMedia(true)
    const ext = file.name.split(".").pop()
    const fileName = `community-${communityId}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from("proof").upload(fileName, file, { upsert: true })
    if (error) { alert(`Upload error: ${error.message}`); setUserUploadingMedia(false); return }
    const { data: urlData } = supabase.storage.from("proof").getPublicUrl(fileName)
    const isVideo = file.type.startsWith("video")
    await supabase.from("community_messages").insert({
      community_id: communityId,
      sender: user,
      message: userMessageText.trim() || "",
      media_url: urlData.publicUrl,
      media_type: isVideo ? "video" : "image",
      is_announcement: false
    })
    setUserMessageText("")
    await loadMessages(communityId)
    setUserUploadingMedia(false)
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

  const medals = ["🥇", "🥈", "🥉"]
  const isAdmin = role === "admin"

  if (activeCommunity) {
    const totalLP = communityLeaderboard.reduce((sum, u) => sum + u.points, 0)

    return (
      <div className="flex flex-col h-full bg-black text-white overflow-hidden">

        <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-zinc-800">
          <button
            onClick={() => setActiveCommunity(null)}
            className="text-zinc-500 text-sm mb-2 flex items-center gap-1"
          >
            ← Back
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-white">{activeCommunity.name}</h1>
              <p className="text-zinc-500 text-xs">
                {activeCommunity.link_count} Links · {activeCommunity.post_count} Posts · {totalLP} LP Total
              </p>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 flex border-b border-zinc-800">
          {(["feed", "leaderboard", "members"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-xs font-bold capitalize transition-colors ${
                activeTab === tab ? "text-cyan-400 border-b-2 border-cyan-400" : "text-zinc-500"
              }`}>
              {tab === "feed" ? "💬 Feed" : tab === "leaderboard" ? "🏆 Board" : "👥 Members"}
            </button>
          ))}
        </div>

        {activeTab === "feed" && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Admin Announcement Input */}
            {isAdmin && (
              <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-800">
                <div style={{
                  background: "rgba(180,0,255,0.1)",
                  border: "1px solid rgba(180,0,255,0.3)",
                  borderRadius: 16, padding: "8px 12px",
                  display: "flex", alignItems: "center", gap: 8
                }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>📢</span>
                  <input
                    value={announcementText}
                    onChange={e => setAnnouncementText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && activeCommunity) postAnnouncement(activeCommunity.id) }}
                    placeholder="Post an announcement..."
                    style={{
                      flex: 1, background: "transparent", border: "none",
                      color: "white", fontSize: 13, outline: "none"
                    }}
                  />
                  <button onClick={() => activeCommunity && postAnnouncement(activeCommunity.id)}
                    disabled={postingAnnouncement || !announcementText.trim()}
                    style={{
                      flexShrink: 0, padding: "6px 14px",
                      background: announcementText.trim() ? "linear-gradient(135deg, #B400FF, #00D4FF)" : "rgba(255,255,255,0.08)",
                      border: "none", borderRadius: 10,
                      color: announcementText.trim() ? "white" : "rgba(255,255,255,0.3)",
                      fontWeight: 700, fontSize: 12, cursor: announcementText.trim() ? "pointer" : "default"
                    }}>
                    {postingAnnouncement ? "..." : "Send"}
                  </button>
                </div>
              </div>
            )}

            {/* User Message Input */}
            <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-800">
              <div style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 16, padding: "8px 12px",
                display: "flex", alignItems: "center", gap: 8
              }}>
                <label style={{ flexShrink: 0, cursor: "pointer" }}>
                  <span style={{ fontSize: 20 }}>{userUploadingMedia ? "⏳" : "📎"}</span>
                  <input type="file" accept="image/*,video/*"
                    className="hidden" disabled={userUploadingMedia}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file && activeCommunity) sendUserMedia(activeCommunity.id, file)
                    }} />
                </label>
                <input
                  value={userMessageText}
                  onChange={e => setUserMessageText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && activeCommunity) sendUserMessage(activeCommunity.id) }}
                  placeholder="Send a message..."
                  style={{
                    flex: 1, background: "transparent", border: "none",
                    color: "white", fontSize: 13, outline: "none"
                  }}
                />
                <button onClick={() => activeCommunity && sendUserMessage(activeCommunity.id)}
                  disabled={userSendingMessage || !userMessageText.trim()}
                  style={{
                    flexShrink: 0, padding: "6px 14px",
                    background: userMessageText.trim() ? "linear-gradient(135deg, #B400FF, #00D4FF)" : "rgba(255,255,255,0.08)",
                    border: "none", borderRadius: 10,
                    color: userMessageText.trim() ? "white" : "rgba(255,255,255,0.3)",
                    fontWeight: 700, fontSize: 12, cursor: userMessageText.trim() ? "pointer" : "default"
                  }}>
                  {userSendingMessage ? "..." : "Send"}
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <p style={{ fontSize: 32, marginBottom: 8 }}>💬</p>
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No posts yet</p>
                  <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, marginTop: 4 }}>
                    Be the first to post in this community
                  </p>
                </div>
              )}

              {messages.map(msg => (
                <div key={msg.id} style={{ maxWidth: "85%" }}>
                  {msg.is_announcement && (
                    <div style={{
                      background: "rgba(180,0,255,0.15)",
                      border: "1px solid rgba(180,0,255,0.4)",
                      borderRadius: 12, padding: "8px 12px",
                      marginBottom: 8, display: "flex", alignItems: "center", gap: 6
                    }}>
                      <span style={{ fontSize: 16 }}>📢</span>
                      <span style={{ color: "#B400FF", fontSize: 11, fontWeight: 700 }}>ANNOUNCEMENT</span>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: "50%",
                      background: "linear-gradient(135deg, #B400FF, #00D4FF)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 900, color: "white", flexShrink: 0
                    }}>
                      {msg.sender.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ color: "#00D4FF", fontSize: 11, fontWeight: 700 }}>
                      {msg.sender}
                    </span>
                    {isAdmin && msg.sender !== user && (
                      <span style={{
                        background: "rgba(180,0,255,0.2)",
                        border: "1px solid rgba(180,0,255,0.4)",
                        color: "#B400FF", fontSize: 8, fontWeight: 800,
                        padding: "1px 6px", borderRadius: 100, letterSpacing: 1
                      }}>MOD</span>
                    )}
                    <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>
                      {timeAgo(msg.created_at)}
                    </span>
                    {(isAdmin || msg.sender === user) && (
                      <button
                        onClick={() => deleteMessage(msg.id)}
                        style={{
                          marginLeft: "auto", background: "rgba(255,0,0,0.15)",
                          border: "1px solid rgba(255,0,0,0.3)", borderRadius: "50%",
                          width: 20, height: 20, display: "flex", alignItems: "center",
                          justifyContent: "center", cursor: "pointer",
                          fontSize: 9, color: "#f87171", flexShrink: 0
                        }}
                      >✕</button>
                    )}
                  </div>

                  <div style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "4px 16px 16px 16px",
                    padding: msg.media_url ? 0 : "10px 14px",
                    overflow: "hidden"
                  }}>
                    {msg.media_type === "video" && msg.media_url && (
                      <video src={msg.media_url}
                        style={{ width: "100%", maxHeight: 240, objectFit: "cover", display: "block" }}
                        controls playsInline />
                    )}
                    {msg.media_type === "image" && msg.media_url && (
                      <img src={msg.media_url}
                        style={{ width: "100%", maxHeight: 240, objectFit: "cover", display: "block" }} />
                    )}
                    {msg.message && (
                      <p style={{
                        color: "rgba(255,255,255,0.85)", fontSize: 13, lineHeight: 1.5,
                        padding: msg.media_url ? "10px 14px" : 0
                      }}>
                        {msg.message}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {activeTab === "leaderboard" && (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
            {communityLeaderboard.map((u, i) => (
              <div key={`${u.user_name}-${i}`}
                className={`rounded-xl p-3 flex justify-between items-center border ${
                  i === 0 ? "bg-yellow-500/10 border-yellow-500/40" :
                  i === 1 ? "bg-zinc-400/10 border-zinc-400/40" :
                  i === 2 ? "bg-orange-500/10 border-orange-500/40" :
                  "bg-zinc-900 border-zinc-800"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-base w-6">{i < 3 ? medals[i] : `${i + 1}.`}</span>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "linear-gradient(135deg, #B400FF, #00D4FF)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 900, color: "white"
                  }}>
                    {u.user_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-white">{u.user_name}</p>
                    {u.school && <p className="text-zinc-500 text-xs">{u.school}</p>}
                  </div>
                </div>
                <span className="text-cyan-400 font-bold text-sm">{u.points} LP</span>
              </div>
            ))}
            {communityLeaderboard.length === 0 && (
              <p className="text-zinc-500 text-sm text-center py-8">No members yet</p>
            )}
          </div>
        )}

        {activeTab === "members" && (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
            {members.map((m, i) => (
              <div key={`${m.user_name}-${i}`}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center gap-3"
              >
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: "linear-gradient(135deg, #B400FF, #00D4FF)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 900, color: "white"
                }}>
                  {m.user_name.charAt(0).toUpperCase()}
                </div>
                <p className="font-semibold text-sm text-white">{m.user_name}</p>
                {m.user_name === user && (
                  <span className="ml-auto text-cyan-400 text-xs font-bold">You</span>
                )}
              </div>
            ))}
            {members.length === 0 && (
              <p className="text-zinc-500 text-sm text-center py-8">No members yet</p>
            )}
          </div>
        )}

        <BottomNav />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-black text-white overflow-hidden">
      <main className="flex flex-col flex-1 overflow-y-auto pb-4">
        <div className="p-4 pb-2">
          <button onClick={() => router.push("/sessions")}
            className="text-zinc-500 text-sm mb-3 flex items-center gap-1">
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-cyan-400">Communities</h1>
          <p className="text-zinc-500 text-xs mt-0.5">Link with your team and earn LP together</p>
        </div>

        <div className="p-4 space-y-4">
          {communities.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>👥</p>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No communities yet</p>
              <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, marginTop: 4 }}>
                Ask your institution to create one
              </p>
            </div>
          )}

          {communities.map((community) => {
            const memberStatus = myMemberships[community.id]
            const isLinked = memberStatus === "accepted"

            return (
              <div key={community.id} style={{
                background: "#18181b",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 20, padding: 16
              }}>
                {community.image && (
                  <img src={community.image} alt={community.name}
                    style={{
                      width: "100%", height: 120, objectFit: "cover",
                      borderRadius: 12, marginBottom: 12
                    }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                )}

                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-white text-base">{community.name}</h3>
                    {community.institution && (
                      <p className="text-zinc-500 text-xs mt-0.5">{community.institution}</p>
                    )}
                  </div>
                </div>

                {community.description && (
                  <p className="text-zinc-400 text-xs mb-3 line-clamp-2">{community.description}</p>
                )}

                <div className="grid grid-cols-3 gap-2 mb-3 text-center text-xs">
                  <div style={{
                    background: "rgba(0,212,255,0.1)",
                    border: "1px solid rgba(0,212,255,0.2)",
                    borderRadius: 10, padding: 8
                  }}>
                    <p style={{ color: "#00D4FF", fontWeight: 800 }}>{community.link_count}</p>
                    <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, marginTop: 2 }}>Links</p>
                  </div>
                  <div style={{
                    background: "rgba(180,0,255,0.1)",
                    border: "1px solid rgba(180,0,255,0.2)",
                    borderRadius: 10, padding: 8
                  }}>
                    <p style={{ color: "#B400FF", fontWeight: 800 }}>{community.post_count}</p>
                    <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, marginTop: 2 }}>Posts</p>
                  </div>
                  <div style={{
                    background: "rgba(255,165,0,0.1)",
                    border: "1px solid rgba(255,165,0,0.2)",
                    borderRadius: 10, padding: 8
                  }}>
                    <p style={{ color: "#FFA500", fontWeight: 800 }}>{community.total_lp}</p>
                    <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, marginTop: 2 }}>Total LP</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  {isLinked && (
                    <button onClick={() => openCommunity(community)}
                      className="flex-1 py-2.5 bg-gradient-to-r from-purple-500 to-cyan-400 rounded-xl text-sm font-bold">
                      Open Community
                    </button>
                  )}
                  {!memberStatus && (
                    <button onClick={() => linkCommunity(community.id)} disabled={loading}
                      className="flex-1 py-2.5 bg-cyan-400 rounded-xl text-sm font-bold text-black">
                      🔗 Link
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
