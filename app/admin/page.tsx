"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getUser, getSchool, logout } from "@/lib/auth"
import InstitutionsTab from "@/components/InstitutionsTab"

type Tab = "proofs" | "sessions" | "members" | "codes" | "communities" | "institutions" | "rewards"

export default function AdminDashboard() {
  const router = useRouter()
  const [ADMIN, setADMIN] = useState("Admin")
  const [SCHOOL, setSCHOOL] = useState("IRL")
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [tab, setTab] = useState<Tab>("proofs")
  const [sessions, setSessions] = useState<any[]>([])
  const [newSession, setNewSession] = useState({
    title: "", type: "Quest", skill_type: "Open Skill",
    points: 50, category: "", creator: "", image: ""
  })
  const [codes, setCodes] = useState<any[]>([])
  const [newCode, setNewCode] = useState({ user_name: "", role: "admin" })
  const [generatedCode, setGeneratedCode] = useState("")
  const [proofs, setProofs] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [communities, setCommunities] = useState<any[]>([])
  const [pendingMembers, setPendingMembers] = useState<any[]>([])
  const [newCommunity, setNewCommunity] = useState({ name: "", description: "" })
  const [activeCommunityChat, setActiveCommunityChat] = useState<any | null>(null)
  const [communityMessages, setCommunityMessages] = useState<any[]>([])
  const [messageText, setMessageText] = useState("")
  const [sendingMessage, setSendingMessage] = useState(false)
  const [uploadingMedia, setUploadingMedia] = useState(false)

  const [rewards, setRewards] = useState<any[]>([])
  const [newReward, setNewReward] = useState({
    title: "",
    description: "",
    points_required: 500,
    icon: "",
    reward_type: "physical",
    redemption_info: "",
    business_name: "",
    image_url: "",
    voucher_code: "",
    active: true
  })

  useEffect(() => {
    const user = getUser()
    const school = getSchool()
    if (!user) { router.replace("/login"); return }
    setADMIN(user)
    if (school) setSCHOOL(school)
    if (user === "Alieu") setIsSuperAdmin(true)
  }, [])

  useEffect(() => {
    const load = async () => {
      if (tab === "sessions") await loadSessions()
      if (tab === "codes") await loadCodes()
      if (tab === "proofs") await loadProofs()
      if (tab === "members") await loadMembers()
      if (tab === "communities") { await loadCommunities(); await loadPendingMembers() }
      if (tab === "rewards") await loadRewards()
    }
    load()
  }, [tab])

  async function loadSessions() {
    const { data } = await supabase
      .from("sessions")
      .select("*")
      .eq("institution", SCHOOL)
      .order("created_at", { ascending: false })
    if (data) setSessions(data)
  }

  async function loadCodes() {
    const { data } = await supabase.from("invite_codes").select("*").order("created_at", { ascending: false })
    if (data) setCodes(data)
  }

  async function loadProofs() {
    const { data: schoolStudents } = await supabase
      .from("users")
      .select("user_name")
      .eq("school", SCHOOL)
      .eq("role", "student")

    if (!schoolStudents || schoolStudents.length === 0) { setProofs([]); return }

    const usernames = schoolStudents.map(s => s.user_name)

    // Load session attempt proofs
    const { data: attemptProofs } = await supabase
      .from("session_attempts")
      .select("*")
      .in("user_name", usernames)
      .not("proof_url", "is", null)
      .order("created_at", { ascending: false })

    // Load hub posts as proofs
    const { data: hubPosts } = await supabase
      .from("hub_posts")
      .select("*")
      .in("user_name", usernames)
      .order("created_at", { ascending: false })

    let allProofs: any[] = []

    if (attemptProofs) {
      const withTitles = await Promise.all(
        attemptProofs.map(async (p) => {
          const { data: session } = await supabase.from("sessions").select("title, institution").eq("id", p.session_id).maybeSingle()
          return { ...p, session_title: session?.title || "Unknown", institution: session?.institution, type: "session_proof" }
        })
      )
      const filtered = withTitles.filter(p => p.institution === SCHOOL)
      allProofs = [...allProofs, ...filtered]
    }

    if (hubPosts) {
      const hubProofs = hubPosts.map(p => ({
        ...p,
        id: `hub_${p.id}`,
        session_title: p.session_title,
        proof_url: p.media_url,
        status: "posted",
        type: "hub_post"
      }))
      allProofs = [...allProofs, ...hubProofs]
    }

    // Sort by created_at descending
    allProofs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    setProofs(allProofs)
  }

  async function loadMembers() {
    const { data: users } = await supabase
      .from("users").select("user_name, school").eq("role", "student")
    if (!users) return
    const withStats = await Promise.all(
      users.map(async (u) => {
        const { count: sessionCount } = await supabase
          .from("session_attempts").select("*", { count: "exact", head: true }).eq("user_name", u.user_name)
        const { data: lb } = await supabase
          .from("leaderboard").select("points").eq("user_name", u.user_name).maybeSingle()
        return { user_name: u.user_name, school: u.school, sessions: sessionCount || 0, points: lb?.points || 0 }
      })
    )
    withStats.sort((a, b) => b.points - a.points)
    setMembers(withStats)
  }

  async function loadCommunities() {
    const { data } = await supabase.from("communities").select("*").eq("institution", SCHOOL)
    if (data) setCommunities(data)
  }

  async function loadPendingMembers() {
    const { data } = await supabase.from("community_members").select("*").eq("status", "pending")
    if (data) setPendingMembers(data)
  }

  async function loadCommunityMessages(communityId: string) {
    const { data } = await supabase
      .from("community_messages").select("*")
      .eq("community_id", communityId)
      .order("created_at", { ascending: true })
    if (data) setCommunityMessages(data)
  }

  async function loadRewards() {
    const { data } = await supabase.from("rewards").select("*").order("points_required", { ascending: true })
    if (data) setRewards(data)
  }

  async function createReward() {
    if (!newReward.title) return alert("Please enter a reward title")
    if (!newReward.business_name) return alert("Please enter the business or org name")
    if (!newReward.points_required) return alert("Please enter LP cost")

    const { error } = await supabase.from("rewards").insert({
      title: newReward.title,
      description: newReward.description,
      points_required: newReward.points_required,
      icon: newReward.icon || "🎁",
      reward_type: newReward.reward_type,
      redemption_info: newReward.redemption_info,
      business_name: newReward.business_name,
      image_url: newReward.image_url,
      voucher_code: newReward.voucher_code,
      active: true,
      created_by: ADMIN
    })

    if (error) return alert(`Error: ${error.message}`)

    setNewReward({
      title: "", description: "", points_required: 500, icon: "",
      reward_type: "physical", redemption_info: "", business_name: "", image_url: "", voucher_code: "", active: true
    })
    loadRewards()
    alert("Reward created!")
  }

  async function toggleRewardActive(id: string, current: boolean) {
    await supabase.from("rewards").update({ active: !current }).eq("id", id)
    loadRewards()
  }

  async function deleteReward(id: string) {
    if (!confirm("Delete this reward?")) return
    await supabase.from("rewards").delete().eq("id", id)
    loadRewards()
  }

  async function sendMessage(communityId: string) {
    if (!messageText.trim()) return
    setSendingMessage(true)
    await supabase.from("community_messages").insert({
      community_id: communityId, sender: ADMIN,
      message: messageText.trim(), media_type: "text"
    })
    setMessageText("")
    await loadCommunityMessages(communityId)
    setSendingMessage(false)
  }

  async function sendMedia(communityId: string, file: File) {
    setUploadingMedia(true)
    const ext = file.name.split(".").pop()
    const fileName = `community-${communityId}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from("proof").upload(fileName, file, { upsert: true })
    if (error) { alert(`Upload error: ${error.message}`); setUploadingMedia(false); return }
    const { data: urlData } = supabase.storage.from("proof").getPublicUrl(fileName)
    const isVideo = file.type.startsWith("video")
    await supabase.from("community_messages").insert({
      community_id: communityId, sender: ADMIN,
      message: messageText.trim() || "",
      media_url: urlData.publicUrl,
      media_type: isVideo ? "video" : "image"
    })
    setMessageText("")
    await loadCommunityMessages(communityId)
    setUploadingMedia(false)
  }

  async function createSession() {
    if (!newSession.title) return alert("Please enter a title")
    const { error } = await supabase.from("sessions")
      .insert({ ...newSession, creator: ADMIN, institution: SCHOOL })
    if (error) return alert(`Error: ${error.message}`)
    const { data: allStudents } = await supabase.from("users").select("user_name").eq("role", "student")
    if (allStudents && allStudents.length > 0) {
      await supabase.from("notifications").insert(
        allStudents.map(s => ({
          user_name: s.user_name,
          title: "New Session Available! ⚡",
          message: `A new session "${newSession.title}" has been posted!`,
          type: "new_session", read: false
        }))
      )
    }
    setNewSession({ title: "", type: "Quest", skill_type: "Open Skill", points: 50, category: "", creator: "", image: "" })
    loadSessions()
    alert("Session created!")
  }

  async function deleteSession(id: string) {
    await supabase.from("sessions").delete().eq("id", id)
    loadSessions()
  }

  function generateRandomCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let result = "IRL-"
    for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length))
    return result
  }

  async function createCode() {
    if (!newCode.user_name) return alert("Please enter a name")
    const code = generateRandomCode()
    const { error } = await supabase.from("invite_codes")
      .insert({ code, user_name: newCode.user_name, school: SCHOOL, role: newCode.role, used: false })
    if (error) return alert(`Error: ${error.message}`)
    setGeneratedCode(code)
    setNewCode({ user_name: "", role: "admin" })
    loadCodes()
  }

  async function updateProofStatus(id: string, status: string, userName: string, sessionId: string) {
    const { error } = await supabase.from("session_attempts").update({ status }).eq("id", id)
    if (error) { alert(`Error: ${error.message}`); return }

    if (status === "accepted") {
      const { data: session } = await supabase.from("sessions")
        .select("points, title").eq("id", sessionId).maybeSingle()
      if (session) {
        const { data: lb } = await supabase.from("leaderboard")
          .select("id, points").eq("user_name", userName).maybeSingle()
        if (lb) {
          await supabase.from("leaderboard").update({ points: lb.points + session.points }).eq("id", lb.id)
        } else {
          await supabase.from("leaderboard").insert({ user_name: userName, points: session.points })
        }

        const { data: userCommunities } = await supabase.from("community_members")
          .select("community_id").eq("user_name", userName).eq("status", "accepted")
        if (userCommunities && userCommunities.length > 0) {
          for (const c of userCommunities) {
            const { data: cMembers } = await supabase.from("community_members")
              .select("user_name").eq("community_id", c.community_id).eq("status", "accepted")
            if (cMembers) {
              const usernames = cMembers.map(m => m.user_name)
              const { data: lbData } = await supabase.from("leaderboard")
                .select("points").in("user_name", usernames)
              if (lbData) {
                const totalLP = lbData.reduce((sum, u) => sum + u.points, 0)
                await supabase.from("communities").update({ total_lp: totalLP }).eq("id", c.community_id)
              }
            }
          }
        }

        await supabase.from("notifications").insert({
          user_name: userName,
          title: "Proof Accepted! 🎉",
          message: `Your proof for "${session.title}" was accepted. +${session.points} LP!`,
          type: "proof_accepted", read: false
        })
      }
    }

    if (status === "declined") {
      const { data: session } = await supabase.from("sessions")
        .select("title").eq("id", sessionId).maybeSingle()
      await supabase.from("notifications").insert({
        user_name: userName,
        title: "Proof Declined ❌",
        message: `Your proof for "${session?.title || "a session"}" was declined. Try again!`,
        type: "proof_declined", read: false
      })
    }

    loadProofs()
    alert(`Proof ${status}!`)
  }

  async function createCommunity() {
    if (!newCommunity.name) return alert("Please enter a community name")
    const { error } = await supabase.from("communities")
      .insert({ name: newCommunity.name, description: newCommunity.description, institution: SCHOOL, total_lp: 0 })
    if (error) alert(`Error: ${error.message}`)
    setNewCommunity({ name: "", description: "" })
    loadCommunities()
    alert("Community created!")
  }

  async function handleMemberRequest(id: string, status: string) {
    await supabase.from("community_members").update({ status }).eq("id", id)
    loadPendingMembers()
  }

  async function deleteCommunity(id: string) {
    if (!confirm("Delete this community? This cannot be undone.")) return
    
    try {
      const { error: membersError } = await supabase
        .from("community_members")
        .delete()
        .eq("community_id", id)
      
      if (membersError) throw membersError
      
      const { error: messagesError } = await supabase
        .from("community_messages")
        .delete()
        .eq("community_id", id)
      
      if (messagesError) throw messagesError
      
      const { error: communityError } = await supabase
        .from("communities")
        .delete()
        .eq("id", id)
      
      if (communityError) throw communityError
      
      await loadCommunities()
      alert("Community deleted successfully!")
    } catch (error) {
      console.error("Error deleting community:", error)
      alert("Failed to delete community")
    }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(diff / 60000)
    const h = Math.floor(diff / 3600000)
    if (m < 1) return "just now"
    if (m < 60) return `${m}m ago`
    return `${h}h ago`
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "proofs", label: "Proofs", icon: "📎" },
    { key: "sessions", label: "Sessions", icon: "⚡" },
    { key: "members", label: "Members", icon: "👥" },
    { key: "communities", label: "Communities", icon: "👥 Communities" },
    { key: "rewards", label: "Rewards", icon: "🎁" },
    ...(isSuperAdmin ? [
      { key: "codes" as Tab, label: "Codes", icon: "🔑" },
      { key: "institutions" as Tab, label: "Institutions", icon: "🏫" },
    ] : []),
  ]

  if (activeCommunityChat) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
        <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center gap-4 flex-shrink-0">
          <button onClick={() => setActiveCommunityChat(null)}
            className="text-zinc-400 hover:text-white text-sm">← Back</button>
          <div>
            <h1 className="text-lg font-bold text-cyan-400">{activeCommunityChat.name} — Announcements</h1>
            <p className="text-zinc-500 text-xs">Sending as {ADMIN} (Admin)</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4 max-w-2xl mx-auto w-full">
          {communityMessages.length === 0 && (
            <div className="text-center py-16 text-zinc-600">
              <p className="text-4xl mb-3">💬</p>
              <p>No messages yet. Send the first one.</p>
            </div>
          )}
          {communityMessages.map(msg => (
            <div key={msg.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 flex items-center justify-center text-xs font-bold">
                  {msg.sender.charAt(0).toUpperCase()}
                </div>
                <span className="text-cyan-400 text-sm font-bold">{msg.sender}</span>
                <span className="bg-purple-500/20 border border-purple-500/40 text-purple-400 text-[9px] font-bold px-2 py-0.5 rounded-full">ADMIN</span>
                <span className="text-zinc-600 text-xs ml-auto">{timeAgo(msg.created_at)}</span>
              </div>
              {msg.media_type === "video" && msg.media_url && (
                <video src={msg.media_url} controls className="w-full max-h-64 rounded-xl mb-2 object-cover" />
              )}
              {msg.media_type === "image" && msg.media_url && (
                <img src={msg.media_url} className="w-full max-h-64 rounded-xl mb-2 object-cover" />
              )}
              {msg.message && <p className="text-zinc-200 text-sm">{msg.message}</p>}
            </div>
          ))}
        </div>
        <div className="border-t border-zinc-800 p-4 max-w-2xl mx-auto w-full flex-shrink-0">
          <div className="flex gap-3 items-center bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-3">
            <label className="cursor-pointer text-zinc-400 hover:text-white flex-shrink-0">
              <span className="text-xl">{uploadingMedia ? "⏳" : "📎"}</span>
              <input type="file" accept="image/*,video/*" className="hidden" disabled={uploadingMedia}
                onChange={e => { const f = e.target.files?.[0]; if (f) sendMedia(activeCommunityChat.id, f) }} />
            </label>
            <input value={messageText} onChange={e => setMessageText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") sendMessage(activeCommunityChat.id) }}
              placeholder="Send a message to this group..."
              className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-zinc-600" />
            <button onClick={() => sendMessage(activeCommunityChat.id)}
              disabled={sendingMessage || !messageText.trim()}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-30"
              style={{ background: messageText.trim() ? "linear-gradient(135deg, #B400FF, #00D4FF)" : "#27272a", color: "white" }}>
              {sendingMessage ? "..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">

      <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-cyan-400">Admin Dashboard</h1>
          <p className="text-zinc-500 text-sm">{SCHOOL}</p>
        </div>
        <button onClick={() => { logout(); router.replace("/login") }}
          className="text-sm text-red-400 border border-red-400/30 px-4 py-2 rounded-xl hover:bg-red-400/10">
          Log Out
        </button>
      </div>

      <div className="bg-zinc-900 border-b border-zinc-800 px-6 flex gap-1 overflow-x-auto flex-shrink-0">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-3.5 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${
              tab === t.key ? "text-cyan-400 border-cyan-400" : "text-zinc-500 border-transparent hover:text-white"
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-6">

          {tab === "proofs" && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white">Proof Submissions</h2>
              {proofs.length === 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500">No proofs submitted yet</div>
              )}
              {proofs.map(p => (
                <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-bold text-white">{p.user_name}</p>
                      <p className="text-zinc-500 text-sm">{p.session_title}</p>
                      {p.type === "hub_post" && (
                        <p className="text-cyan-400 text-xs">📱 Hub Post</p>
                      )}
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                      p.type === "hub_post" ? "bg-cyan-500/20 text-cyan-400" :
                      p.status === "accepted" ? "bg-green-500/20 text-green-400" :
                      p.status === "declined" ? "bg-red-500/20 text-red-400" :
                      "bg-yellow-500/20 text-yellow-400"
                    }`}>
                      {p.type === "hub_post" ? "Posted to Hub" : p.status}
                    </span>
                  </div>
                  {p.proof_url && (
                    <div className="mb-4 rounded-xl overflow-hidden">
                      {p.media_type === "video" || p.proof_url.match(/\.(mp4|mov|avi)$/i) ? (
                        <video src={p.proof_url} controls className="w-full max-h-64 object-cover" />
                      ) : (
                        <img src={p.proof_url} className="w-full max-h-64 object-cover" />
                      )}
                    </div>
                  )}
                  {p.type !== "hub_post" && p.status === "submitted" && (
                    <div className="flex gap-3">
                      <button onClick={() => updateProofStatus(p.id, "accepted", p.user_name, p.session_id)}
                        className="flex-1 py-2.5 bg-green-500/20 border border-green-500/40 text-green-400 rounded-xl font-semibold">
                        ✅ Accept
                      </button>
                      <button onClick={() => updateProofStatus(p.id, "declined", p.user_name, p.session_id)}
                        className="flex-1 py-2.5 bg-red-500/20 border border-red-500/40 text-red-400 rounded-xl font-semibold">
                        ❌ Decline
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === "sessions" && (
            <div className="space-y-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                <h2 className="text-lg font-bold text-white">Create Session</h2>
                <input placeholder="Session title" value={newSession.title}
                  onChange={e => setNewSession(p => ({ ...p, title: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400" />
                <div className="grid grid-cols-2 gap-3">
                  <select value={newSession.type} onChange={e => setNewSession(p => ({ ...p, type: e.target.value }))}
                    className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400">
                    <option>Quest</option><option>Challenge</option><option>Activity</option>
                  </select>
                  <select value={newSession.skill_type} onChange={e => setNewSession(p => ({ ...p, skill_type: e.target.value }))}
                    className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400">
                    <option>Open Skill</option><option>Competitive</option>
                  </select>
                  <input placeholder="Category (e.g. Sport)" value={newSession.category}
                    onChange={e => setNewSession(p => ({ ...p, category: e.target.value }))}
                    className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400" />
                  <input type="number" placeholder="LP points" value={newSession.points}
                    onChange={e => setNewSession(p => ({ ...p, points: Number(e.target.value) }))}
                    className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400" />
                </div>
                <input placeholder="Image URL (optional)" value={newSession.image}
                  onChange={e => setNewSession(p => ({ ...p, image: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400" />
                {newSession.image && (
                  <div className="rounded-xl overflow-hidden h-32">
                    <img src={newSession.image} className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                  </div>
                )}
                <button onClick={createSession}
                  className="w-full py-3 bg-gradient-to-r from-purple-500 to-cyan-400 rounded-xl font-bold">
                  ⚡ Create Session
                </button>
              </div>
              <h2 className="text-lg font-bold text-white">All Sessions</h2>
              {sessions.length === 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500">No sessions yet</div>
              )}
              {sessions.map(s => (
                <div key={s.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                  {s.image && <img src={s.image} className="w-full h-32 object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />}
                  <div className="p-5 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-white">{s.title}</p>
                      <p className="text-zinc-500 text-sm">{s.type} · {s.skill_type} · ⚡ {s.points} LP</p>
                    </div>
                    <button onClick={() => deleteSession(s.id)}
                      className="text-red-400 text-sm border border-red-400/30 px-4 py-2 rounded-xl">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "members" && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white">All Members</h2>
              {members.length === 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500">No members yet</div>
              )}
              {members.map(s => (
                <div key={s.user_name} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 flex items-center justify-center font-bold text-white">
                      {s.user_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-white">{s.user_name}</p>
                      <p className="text-zinc-500 text-sm">{s.school} · {s.sessions} sessions</p>
                    </div>
                  </div>
                  <span className="text-cyan-400 font-bold text-lg">{s.points} LP</span>
                </div>
              ))}
            </div>
          )}

          {tab === "codes" && (
            <div className="space-y-4">
              {generatedCode && (
                <div className="bg-cyan-400/10 border border-cyan-400/40 rounded-2xl p-6 text-center">
                  <p className="text-zinc-400 text-sm mb-2">New code generated — share this with the admin</p>
                  <p className="text-4xl font-black text-cyan-400 tracking-widest">{generatedCode}</p>
                  <p className="text-zinc-500 text-xs mt-2">They use this code + choose their own password on the login page</p>
                </div>
              )}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                <h2 className="text-lg font-bold text-white">Generate Admin Code</h2>
                <p className="text-zinc-500 text-sm">The new admin uses this code on the login page and sets their own password.</p>
                <input placeholder="Admin name" value={newCode.user_name}
                  onChange={e => setNewCode(p => ({ ...p, user_name: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400" />
                <select value={newCode.role} onChange={e => setNewCode(p => ({ ...p, role: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400">
                  <option value="admin">Admin</option>
                  <option value="student">Student</option>
                </select>
                <button onClick={createCode}
                  className="w-full py-3 bg-gradient-to-r from-purple-500 to-cyan-400 rounded-xl font-bold">
                  🔑 Generate Code
                </button>
              </div>
              <h2 className="text-lg font-bold text-white">All Codes</h2>
              {codes.length === 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500">No codes yet</div>
              )}
              {codes.map(c => (
                <div key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex justify-between items-center">
                  <div>
                    <p className="font-mono font-bold text-cyan-400 text-lg">{c.code}</p>
                    <p className="text-zinc-500 text-sm">{c.user_name} · {c.role}</p>
                  </div>
                  <span className={`text-sm px-3 py-1 rounded-full font-semibold ${
                    c.used ? "bg-green-500/20 text-green-400" : "bg-zinc-700 text-zinc-400"
                  }`}>{c.used ? "Used" : "Unused"}</span>
                </div>
              ))}
            </div>
          )}

          {tab === "communities" && (
            <div className="space-y-4">
              {pendingMembers.length > 0 && (
                <>
                  <h2 className="text-lg font-bold text-yellow-400">⏳ Pending Requests</h2>
                  {pendingMembers.map(m => (
                    <div key={m.id} className="bg-zinc-900 border border-yellow-500/30 rounded-2xl p-5">
                      <p className="font-bold text-white mb-1">{m.user_name}</p>
                      <p className="text-zinc-500 text-sm mb-4">wants to join a group</p>
                      <div className="flex gap-3">
                        <button onClick={() => handleMemberRequest(m.id, "accepted")}
                          className="flex-1 py-2.5 bg-green-500/20 border border-green-500/40 text-green-400 rounded-xl font-semibold">
                          ✅ Accept
                        </button>
                        <button onClick={() => handleMemberRequest(m.id, "declined")}
                          className="flex-1 py-2.5 bg-red-500/20 border border-red-500/40 text-red-400 rounded-xl font-semibold">
                          ❌ Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                <h2 className="text-lg font-bold text-white">Create Group</h2>
                <input placeholder="Community name" value={newCommunity.name}
                  onChange={e => setNewCommunity(p => ({ ...p, name: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400" />
                <input placeholder="Description (optional)" value={newCommunity.description}
                  onChange={e => setNewCommunity(p => ({ ...p, description: e.target.value }))}  
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400" />
                <button onClick={createCommunity}
                  className="w-full py-3 bg-gradient-to-r from-purple-500 to-cyan-400 rounded-xl font-bold">
                  🏘 Create Group
                </button>
              </div>
              <h2 className="text-lg font-bold text-white">All Communities</h2>
              {communities.length === 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500">No communities yet</div>
              )}
              {communities.map(c => (
                <div key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-bold text-white text-base">{c.name}</p>
                      {c.description && <p className="text-zinc-500 text-sm">{c.description}</p>}
                      <p className="text-zinc-600 text-xs mt-1">⚡ {c.total_lp || 0} LP</p>
                    </div>
                    <button onClick={() => deleteCommunity(c.id)}
                      className="text-red-400 text-sm border border-red-400/30 px-3 py-1.5 rounded-xl">
                      🗑 Delete
                    </button>
                  </div>
                  <button
                    onClick={() => { setActiveCommunityChat(c); loadCommunityMessages(c.id) }}
                    className="w-full py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm font-semibold text-zinc-300 hover:border-cyan-500 hover:text-white transition-colors">
                    💬 Send Message to Group
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === "rewards" && (
            <div className="space-y-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                <h2 className="text-lg font-bold text-white">Add New Reward</h2>
                <p className="text-zinc-500 text-sm">Add real world or digital rewards from your org or business partners.</p>

                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="Business / Org name e.g. Nando's"
                    value={newReward.business_name}
                    onChange={e => setNewReward(p => ({ ...p, business_name: e.target.value }))}
                    className="col-span-2 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400" />

                  <input placeholder="Reward title e.g. Free Wings"
                    value={newReward.title}
                    onChange={e => setNewReward(p => ({ ...p, title: e.target.value }))}
                    className="col-span-2 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400" />

                  <input placeholder="Description e.g. Free wings when you spend £5"
                    value={newReward.description}
                    onChange={e => setNewReward(p => ({ ...p, description: e.target.value }))}
                    className="col-span-2 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400" />

                  <input type="number" placeholder="LP cost e.g. 3000"
                    value={newReward.points_required}
                    onChange={e => setNewReward(p => ({ ...p, points_required: Number(e.target.value) }))}
                    className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400" />

                  <input placeholder="Emoji icon e.g. 🍗"
                    value={newReward.icon}
                    onChange={e => setNewReward(p => ({ ...p, icon: e.target.value }))}
                    className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400" />

                  <select value={newReward.reward_type}
                    onChange={e => setNewReward(p => ({ ...p, reward_type: e.target.value }))}
                    className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400">
                    <option value="physical">Physical — shown in store</option>
                    <option value="digital">Digital — code or link</option>
                    <option value="voucher">Voucher — printed ticket</option>
                  </select>

                    <input placeholder="Image URL for reward (optional)"
                    value={newReward.image_url}
                    onChange={e => setNewReward(p => ({ ...p, image_url: e.target.value }))}
                    className="col-span-2 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400" />

                  {newReward.reward_type === "voucher" && (
                    <input placeholder="Voucher code"
                      value={newReward.voucher_code}
                      onChange={e => setNewReward(p => ({ ...p, voucher_code: e.target.value }))}
                      className="col-span-2 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400" />
                  )}

                  <input placeholder="Redemption info e.g. Show ticket at counter"
                    value={newReward.redemption_info}
                    onChange={e => setNewReward(p => ({ ...p, redemption_info: e.target.value }))}
                    className="col-span-2 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400" />
                </div>

                <button onClick={createReward}
                  className="w-full py-3 bg-gradient-to-r from-purple-500 to-cyan-400 rounded-xl font-bold">
                  🎁 Add Reward
                </button>
              </div>

              <h2 className="text-lg font-bold text-white">All Rewards</h2>
              {rewards.length === 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500">
                  No rewards added yet — add your first one above
                </div>
              )}
              {rewards.map(r => (
                <div key={r.id} className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 shadow-xl shadow-black/20 transition hover:-translate-y-0.5">
                  {r.image_url && (
                    <div className="mb-4 overflow-hidden rounded-3xl border border-zinc-800">
                      <img src={r.image_url} alt={r.title} className="w-full h-56 object-cover" />
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-purple-500 to-cyan-400 flex items-center justify-center text-3xl flex-shrink-0">
                        {r.icon || "🎁"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-zinc-400 text-[11px] font-bold uppercase tracking-[0.3em] mb-1">{r.business_name}</p>
                        <div className="flex flex-col gap-1">
                          <p className="font-bold text-white text-lg">{r.title}</p>
                          {r.description && <p className="text-zinc-300 text-sm leading-relaxed">{r.description}</p>}
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <span className="text-cyan-300 text-xs font-semibold">⚡ {r.points_required} LP</span>
                          <span className="text-zinc-600 text-xs">·</span>
                          <span className="text-zinc-400 text-xs capitalize">{r.reward_type}</span>
                          <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                            r.active ? "bg-green-500/15 text-green-300 border border-green-500/20" : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                          }`}>
                            {r.active ? "Active" : "Hidden"}
                          </span>
                        </div>
                        {r.reward_type === "voucher" && r.voucher_code && (
                          <div className="mt-3 rounded-2xl bg-zinc-900 border border-zinc-800 px-4 py-3 text-sm text-zinc-300">
                            <p className="font-semibold text-white mb-1">Voucher code</p>
                            <p className="font-mono text-sm tracking-[0.15em]">{r.voucher_code}</p>
                          </div>
                        )}
                        {r.redemption_info && (
                          <p className="mt-3 text-zinc-400 text-sm">{r.redemption_info}</p>
                        )}
                        <p className="mt-4 text-zinc-500 text-xs">Posted by <span className="text-white">{r.created_by || "Admin"}</span></p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => toggleRewardActive(r.id, r.active)}
                      className={`px-3 py-2 rounded-2xl text-xs font-semibold border ${
                        r.active
                          ? "border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/10"
                          : "border-green-500/40 text-green-300 hover:bg-green-500/10"
                      }`}>
                      {r.active ? "Hide" : "Show"}
                    </button>
                    <button onClick={() => deleteReward(r.id)}
                      className="px-3 py-2 rounded-2xl text-xs font-semibold border border-red-400/30 text-red-400 hover:bg-red-400/10">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "institutions" && (
            <div className="space-y-4">
              <InstitutionsTab school={SCHOOL} />
            </div>
          )}

        </div>
      </div>
    </div>
  )
}