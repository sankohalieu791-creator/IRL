"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import BottomNav from "@/components/BottomNav"
import { getUser, getSchool } from "@/lib/auth"

type Group = {
  id: string
  name: string
  description: string
  institution: string
  total_lp: number
  member_count?: number
}

type Member = {
  user_name: string
  status: string
  joined_at: string
}

type Message = {
  id: string
  group_id: string
  sender: string
  message: string
  media_url: string | null
  media_type: string
  created_at: string
}

export default function Groups() {
  const router = useRouter()
  const [user, setUser] = useState("")
  const [school, setSchool] = useState("")
  const [role, setRole] = useState("")
  const [groups, setGroups] = useState<Group[]>([])
  const [myMemberships, setMyMemberships] = useState<Record<string, string>>({})
  const [activeGroup, setActiveGroup] = useState<Group | null>(null)
  const [activeTab, setActiveTab] = useState<"chat" | "leaderboard" | "members">("chat")
  const [members, setMembers] = useState<Member[]>([])
  const [groupLeaderboard, setGroupLeaderboard] = useState<any[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  // State for user messages (non-admin)
  const [userMessageText, setUserMessageText] = useState("")
  const [userSendingMessage, setUserSendingMessage] = useState(false)
  const [userUploadingMedia, setUserUploadingMedia] = useState(false)

  // State for deleting groups
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null)

  useEffect(() => {
    const u = getUser() || ""
    const s = getSchool() || ""
    setUser(u)
    setSchool(s)
  }, [])

  useEffect(() => {
    if (user) {
      loadGroups()
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
    if (!activeGroup) return
    const channel = supabase
      .channel(`group-messages-${activeGroup.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "group_messages",
        filter: `group_id=eq.${activeGroup.id}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeGroup])

  async function checkIfAdmin() {
    const { data } = await supabase
      .from("users")
      .select("role")
      .eq("user_name", user)
      .maybeSingle()
    if (data?.role === "admin") setRole("admin")
  }

  async function loadGroups() {
    const { data } = await supabase
      .from("groups")
      .select("*")
      .order("total_lp", { ascending: false })
    if (!data) return
    const groupsWithCounts = await Promise.all(
      data.map(async (g) => {
        const { count } = await supabase
          .from("group_members")
          .select("*", { count: "exact", head: true })
          .eq("group_id", g.id)
          .eq("status", "accepted")
        return { ...g, member_count: count || 0 }
      })
    )
    setGroups(groupsWithCounts)
  }

  async function loadMyMemberships() {
    const { data } = await supabase
      .from("group_members")
      .select("group_id, status")
      .eq("user_name", user)
    if (!data) return
    const map: Record<string, string> = {}
    data.forEach(m => { map[m.group_id] = m.status })
    setMyMemberships(map)
  }

  async function requestJoin(groupId: string) {
    setLoading(true)
    const { error } = await supabase
      .from("group_members")
      .insert({ group_id: groupId, user_name: user, status: "pending" })
    if (error) {
      alert(`Error: ${error.message}`)
    } else {
      setMyMemberships(prev => ({ ...prev, [groupId]: "pending" }))
    }
    setLoading(false)
  }

  async function openGroup(group: Group) {
    setActiveGroup(group)
    setActiveTab("chat")
    loadMembers(group.id)
    loadGroupLeaderboard(group.id)
    loadMessages(group.id)
  }

  async function loadMembers(groupId: string) {
    const { data } = await supabase
      .from("group_members")
      .select("user_name, status, joined_at")
      .eq("group_id", groupId)
      .eq("status", "accepted")
      .order("joined_at", { ascending: true })
    if (data) setMembers(data)
  }

  async function loadGroupLeaderboard(groupId: string) {
    const { data: memberData } = await supabase
      .from("group_members")
      .select("user_name")
      .eq("group_id", groupId)
      .eq("status", "accepted")
    if (!memberData) return
    const usernames = memberData.map(m => m.user_name)
    const { data: pointsData } = await supabase
      .from("leaderboard")
      .select("user_name, points, school")
      .in("user_name", usernames)
      .order("points", { ascending: false })
    if (pointsData) {
      setGroupLeaderboard(pointsData)
      const totalLP = pointsData.reduce((sum, u) => sum + u.points, 0)
      await supabase.from("groups").update({ total_lp: totalLP }).eq("id", groupId)
    }
  }

  async function loadMessages(groupId: string) {
    const { data } = await supabase
      .from("group_messages")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true })
    if (data) setMessages(data)
  }

  async function deleteMessage(msgId: string) {
    await supabase.from("group_messages").delete().eq("id", msgId)
    setMessages(prev => prev.filter(m => m.id !== msgId))
  }

  // Function for users to send messages
  async function sendUserMessage(groupId: string) {
    if (!userMessageText.trim()) return
    setUserSendingMessage(true)
    await supabase.from("group_messages").insert({
      group_id: groupId, sender: user,
      message: userMessageText.trim(), media_type: "text"
    })
    setUserMessageText("")
    await loadMessages(groupId)
    setUserSendingMessage(false)
  }

  // Function for users to send media
  async function sendUserMedia(groupId: string, file: File) {
    setUserUploadingMedia(true)
    const ext = file.name.split(".").pop()
    const fileName = `group-${groupId}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from("proof").upload(fileName, file, { upsert: true })
    if (error) { alert(`Upload error: ${error.message}`); setUserUploadingMedia(false); return }
    const { data: urlData } = supabase.storage.from("proof").getPublicUrl(fileName)
    const isVideo = file.type.startsWith("video")
    await supabase.from("group_messages").insert({
      group_id: groupId, sender: user,
      message: userMessageText.trim() || "",
      media_url: urlData.publicUrl,
      media_type: isVideo ? "video" : "image"
    })
    setUserMessageText("")
    await loadMessages(groupId)
    setUserUploadingMedia(false)
  }

  // Function to delete a group (admin only)
  async function deleteGroup(groupId: string) {
    if (!confirm("Are you sure you want to delete this group? This cannot be undone.")) return
    
    try {
      setDeletingGroupId(groupId)
      
      // Delete all group members first
      const { error: membersError } = await supabase
        .from("group_members")
        .delete()
        .eq("group_id", groupId)
      
      if (membersError) throw membersError
      
      // Delete all group messages
      const { error: messagesError } = await supabase
        .from("group_messages")
        .delete()
        .eq("group_id", groupId)
      
      if (messagesError) throw messagesError
      
      // Finally delete the group
      const { error: groupError } = await supabase
        .from("groups")
        .delete()
        .eq("id", groupId)
      
      if (groupError) throw groupError
      
      // Remove from state
      setGroups(prev => prev.filter(g => g.id !== groupId))
      alert("Group deleted successfully")
    } catch (error) {
      console.error("Error deleting group:", error)
      alert("Failed to delete group")
    } finally {
      setDeletingGroupId(null)
    }
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

  if (activeGroup) {
    const totalLP = groupLeaderboard.reduce((sum, u) => sum + u.points, 0)

    return (
      <div className="flex flex-col h-full bg-black text-white overflow-hidden">

        <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-zinc-800">
          <button
            onClick={() => setActiveGroup(null)}
            className="text-zinc-500 text-sm mb-2 flex items-center gap-1"
          >
            ← Back
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-white">{activeGroup.name}</h1>
              <p className="text-zinc-500 text-xs">{members.length} members · {totalLP} LP total</p>
            </div>
            <div style={{
              background: "rgba(0,212,255,0.1)",
              border: "1px solid rgba(0,212,255,0.3)",
              borderRadius: 12, padding: "6px 12px", textAlign: "center"
            }}>
              <p style={{ color: "#00D4FF", fontWeight: 800, fontSize: 16 }}>{totalLP}</p>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 9 }}>GROUP LP</p>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 flex border-b border-zinc-800">
          {(["chat", "leaderboard", "members"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-xs font-bold capitalize transition-colors ${
                activeTab === tab ? "text-cyan-400 border-b-2 border-cyan-400" : "text-zinc-500"
              }`}>
              {tab === "chat" ? "💬 Chat" : tab === "leaderboard" ? "🏆 Board" : "👥 Members"}
            </button>
          ))}
        </div>

        {activeTab === "chat" && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Input at top */}
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
                      if (file && activeGroup) sendUserMedia(activeGroup.id, file)
                    }} />
                </label>
                <input
                  value={userMessageText}
                  onChange={e => setUserMessageText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && activeGroup) sendUserMessage(activeGroup.id) }}
                  placeholder="Send a message..."
                  style={{
                    flex: 1, background: "transparent", border: "none",
                    color: "white", fontSize: 13, outline: "none"
                  }}
                />
                <button onClick={() => activeGroup && sendUserMessage(activeGroup.id)} 
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

            {/* Messages below */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <p style={{ fontSize: 32, marginBottom: 8 }}>💬</p>
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No messages yet</p>
                  <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, marginTop: 4 }}>
                    Your admin will post updates here
                  </p>
                </div>
              )}

              {messages.map(msg => (
                <div key={msg.id} style={{ maxWidth: "85%" }}>
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
                    {isAdmin && (
                      <span style={{
                        background: "rgba(180,0,255,0.2)",
                        border: "1px solid rgba(180,0,255,0.4)",
                        color: "#B400FF", fontSize: 8, fontWeight: 800,
                        padding: "1px 6px", borderRadius: 100, letterSpacing: 1
                      }}>ADMIN</span>
                    )}
                    <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>
                      {timeAgo(msg.created_at)}
                    </span>
                    {isAdmin && (
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
            {groupLeaderboard.map((u, i) => (
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
            {groupLeaderboard.length === 0 && (
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
          <h1 className="text-2xl font-bold text-cyan-400">Groups</h1>
          <p className="text-zinc-500 text-xs mt-0.5">Compete together and earn LP as a team</p>
        </div>

        <div className="p-4 space-y-4">
          {groups.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>👥</p>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No groups yet</p>
              <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, marginTop: 4 }}>
                Ask your institution to create one
              </p>
            </div>
          )}

          {groups.map((group) => {
            const memberStatus = myMemberships[group.id]
            const isMember = memberStatus === "accepted"
            const isPending = memberStatus === "pending"

            return (
              <div key={group.id} style={{
                background: "#18181b",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 20, padding: 16
              }}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-white text-base">{group.name}</h3>
                    {group.institution && (
                      <p className="text-zinc-500 text-xs mt-0.5">{group.institution}</p>
                    )}
                  </div>
                  <div style={{
                    background: "rgba(0,212,255,0.1)",
                    border: "1px solid rgba(0,212,255,0.3)",
                    borderRadius: 10, padding: "4px 10px", textAlign: "center"
                  }}>
                    <p style={{ color: "#00D4FF", fontWeight: 800, fontSize: 14 }}>{group.total_lp}</p>
                    <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 9 }}>LP</p>
                  </div>
                </div>

                {group.description && (
                  <p className="text-zinc-400 text-xs mb-3">{group.description}</p>
                )}

                <p className="text-zinc-500 text-xs mb-3">👥 {group.member_count} members</p>

                <div className="flex gap-2">
                  {isMember && (
                    <button onClick={() => openGroup(group)}
                      className="flex-1 py-2.5 bg-gradient-to-r from-purple-500 to-cyan-400 rounded-xl text-sm font-bold">
                      Open Group
                    </button>
                  )}
                  {isPending && (
                    <div className="flex-1 py-2.5 bg-yellow-500/20 border border-yellow-500/40 rounded-xl text-sm font-semibold text-yellow-400 text-center">
                      ⏳ Pending
                    </div>
                  )}
                  {!memberStatus && (
                    <button onClick={() => requestJoin(group.id)} disabled={loading}
                      className="flex-1 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm font-semibold text-zinc-300">
                      Request to Join
                    </button>
                  )}
                  
                  {isAdmin && (
                    <button 
                      onClick={() => deleteGroup(group.id)}
                      disabled={deletingGroupId === group.id}
                      style={{
                        padding: "10px 14px",
                        background: "rgba(255,0,0,0.15)",
                        border: "1px solid rgba(255,0,0,0.3)",
                        borderRadius: 10,
                        color: "#f87171",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: deletingGroupId === group.id ? "not-allowed" : "pointer",
                        opacity: deletingGroupId === group.id ? 0.6 : 1
                      }}
                    >
                      {deletingGroupId === group.id ? "🗑️ Deleting..." : "🗑️ Delete"}
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