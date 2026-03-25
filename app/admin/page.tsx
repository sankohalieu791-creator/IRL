"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getUser, getSchool, logout } from "@/lib/auth"

type Tab = "proofs" | "sessions" | "students" | "codes" | "groups"

export default function AdminDashboard() {
  const router = useRouter()
  const ADMIN = getUser() || "Admin"
  const SCHOOL = getSchool() || "Test School"

  const [tab, setTab] = useState<Tab>("proofs")
  const [sessions, setSessions] = useState<any[]>([])
  const [newSession, setNewSession] = useState({
    title: "",
    type: "Quest",
    skill_type: "Open Skill",
    points: 50,
    category: "",
    creator: "",
    image: ""
  })
  const [codes, setCodes] = useState<any[]>([])
  const [newCode, setNewCode] = useState({ user_name: "", role: "student" })
  const [generatedCode, setGeneratedCode] = useState("")
  const [proofs, setProofs] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [pendingMembers, setPendingMembers] = useState<any[]>([])
  const [newGroup, setNewGroup] = useState({ name: "", description: "" })

  async function loadSessions() {
    const { data } = await supabase
      .from("sessions")
      .select("*")
      .order("created_at", { ascending: false })
    if (data) setSessions(data)
  }

  async function loadCodes() {
    const { data } = await supabase
      .from("invite_codes")
      .select("*")
      .order("created_at", { ascending: false })
    if (data) setCodes(data)
  }

  async function loadProofs() {
    const { data } = await supabase
      .from("session_attempts")
      .select("*")
      .not("proof_url", "is", null)
      .order("created_at", { ascending: false })

    if (!data) return

    const withTitles = await Promise.all(
      data.map(async (p) => {
        const { data: session } = await supabase
          .from("sessions")
          .select("title")
          .eq("id", p.session_id)
          .maybeSingle()
        return { ...p, session_title: session?.title || "Unknown" }
      })
    )
    setProofs(withTitles)
  }

  async function loadStudents() {
    const { data: users } = await supabase
      .from("users")
      .select("user_name, school")
      .eq("school", SCHOOL)
      .eq("role", "student")

    if (!users) return

    const withStats = await Promise.all(
      users.map(async (u) => {
        const { count: sessionCount } = await supabase
          .from("session_attempts")
          .select("*", { count: "exact", head: true })
          .eq("user_name", u.user_name)

        const { data: lb } = await supabase
          .from("leaderboard")
          .select("points")
          .eq("user_name", u.user_name)
          .order("points", { ascending: false })
          .limit(1)
          .maybeSingle()

        return {
          user_name: u.user_name,
          school: u.school,
          sessions: sessionCount || 0,
          points: lb?.points || 0
        }
      })
    )

    withStats.sort((a, b) => b.points - a.points)
    setStudents(withStats)
  }

  async function loadGroups() {
    const { data } = await supabase
      .from("groups")
      .select("*")
      .eq("institution", SCHOOL)
    if (data) setGroups(data)
  }

  async function loadPendingMembers() {
    const { data } = await supabase
      .from("group_members")
      .select("*")
      .eq("status", "pending")
    if (data) setPendingMembers(data)
  }

  useEffect(() => {
    const load = async () => {
      if (tab === "sessions") await loadSessions()
      if (tab === "codes") await loadCodes()
      if (tab === "proofs") await loadProofs()
      if (tab === "students") await loadStudents()
      if (tab === "groups") {
        await loadGroups()
        await loadPendingMembers()
      }
    }
    load()
  }, [tab])

  async function createSession() {
    if (!newSession.title) return alert("Please enter a title")
    const { error } = await supabase
      .from("sessions")
      .insert({ ...newSession, creator: ADMIN, institution: SCHOOL })
    if (error) return alert(`Error: ${error.message}`)

    const { data: allStudents } = await supabase
      .from("users")
      .select("user_name")
      .eq("school", SCHOOL)
      .eq("role", "student")

    if (allStudents && allStudents.length > 0) {
      const notifs = allStudents.map(s => ({
        user_name: s.user_name,
        title: "New Session Available! ⚡",
        message: `A new session "${newSession.title}" has been posted. Complete it to earn LP!`,
        type: "new_session",
        read: false
      }))
      await supabase.from("notifications").insert(notifs)
    }

    setNewSession({
      title: "",
      type: "Quest",
      skill_type: "Open Skill",
      points: 50,
      category: "",
      creator: ADMIN,
      image: ""
    })
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
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  async function createCode() {
    if (!newCode.user_name) return alert("Please enter a name")
    const code = generateRandomCode()
    const { error } = await supabase
      .from("invite_codes")
      .insert({
        code,
        user_name: newCode.user_name,
        school: SCHOOL,
        role: newCode.role,
        used: false
      })
    if (error) return alert(`Error: ${error.message}`)
    setGeneratedCode(code)
    setNewCode({ user_name: "", role: "student" })
    loadCodes()
  }

  async function updateProofStatus(
    id: string,
    status: string,
    userName: string,
    sessionId: string
  ) {
    console.log("Updating proof:", { id, status, userName, sessionId })

    const { error: statusError } = await supabase
      .from("session_attempts")
      .update({ status })
      .eq("id", id)

    if (statusError) {
      alert(`Error updating status: ${statusError.message}`)
      return
    }

    if (status === "accepted") {
      const { data: session } = await supabase
        .from("sessions")
        .select("points, title")
        .eq("id", sessionId)
        .maybeSingle()

      console.log("Session found:", session)

      if (session) {
        const { data: lb } = await supabase
          .from("leaderboard")
          .select("id, points")
          .eq("user_name", userName)
          .maybeSingle()

        console.log("Leaderboard row found:", lb)

        if (lb) {
          const newPoints = lb.points + session.points
          const { error: lbError } = await supabase
            .from("leaderboard")
            .update({ points: newPoints })
            .eq("id", lb.id)

          console.log("LP updated to:", newPoints, "Error:", lbError)

          if (lbError) {
            alert(`Error updating LP: ${lbError.message}`)
            return
          }
        } else {
          console.log("No leaderboard row for:", userName, "creating one")
          const { error: insertError } = await supabase
            .from("leaderboard")
            .insert({
              user_name: userName,
              points: session.points
            })

          if (insertError) {
            alert(`Error creating leaderboard row: ${insertError.message}`)
            return
          }
        }

        await supabase.from("notifications").insert({
          user_name: userName,
          title: "Proof Accepted! 🎉",
          message: `Your proof for "${session.title}" was accepted. +${session.points} LP awarded!`,
          type: "proof_accepted",
          read: false
        })

        const { data: allUsers } = await supabase
          .from("leaderboard")
          .select("user_name, points")
          .order("points", { ascending: false })

        if (allUsers) {
          const position = allUsers.findIndex(u => u.user_name === userName) + 1
          if (position <= 5) {
            await supabase.from("notifications").insert({
              user_name: userName,
              title: `You are ranked #${position}! 🏆`,
              message: `You just moved into the top 5 on the leaderboard. Keep going!`,
              type: "leaderboard",
              read: false
            })
          }
        }
      }
    }

    if (status === "declined") {
      const { data: session } = await supabase
        .from("sessions")
        .select("title")
        .eq("id", sessionId)
        .maybeSingle()

      await supabase.from("notifications").insert({
        user_name: userName,
        title: "Proof Declined ❌",
        message: `Your proof for "${session?.title || "a session"}" was declined. Try again!`,
        type: "proof_declined",
        read: false
      })
    }

    loadProofs()
    alert(`Proof ${status}!`)
  }

  async function createGroup() {
    if (!newGroup.name) return alert("Please enter a group name")
    const { error } = await supabase
      .from("groups")
      .insert({
        name: newGroup.name,
        description: newGroup.description,
        institution: SCHOOL,
        total_lp: 0
      })
    if (error) return alert(`Error: ${error.message}`)
    setNewGroup({ name: "", description: "" })
    loadGroups()
    alert("Group created!")
  }

  async function handleMemberRequest(id: string, status: string) {
    await supabase
      .from("group_members")
      .update({ status })
      .eq("id", id)
    loadPendingMembers()
  }

  async function deleteGroup(id: string) {
    await supabase.from("groups").delete().eq("id", id)
    loadGroups()
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "proofs", label: "Proofs", icon: "📎" },
    { key: "sessions", label: "Sessions", icon: "⚡" },
    { key: "students", label: "Students", icon: "👥" },
    { key: "codes", label: "Codes", icon: "🔑" },
    { key: "groups", label: "Groups", icon: "🏫" },
  ]

  return (
    <div className="min-h-screen bg-zinc-950 text-white">

      {/* HEADER */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-cyan-400">Admin Dashboard</h1>
          <p className="text-zinc-500 text-sm">{SCHOOL}</p>
        </div>
        <button
          onClick={() => { logout(); router.push("/login") }}
          className="text-sm text-red-400 border border-red-400/30 px-4 py-2 rounded-xl hover:bg-red-400/10 transition-colors"
        >
          Log Out
        </button>
      </div>

      {/* TAB BAR */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-6 flex gap-1 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-3.5 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${
              tab === t.key
                ? "text-cyan-400 border-cyan-400"
                : "text-zinc-500 border-transparent hover:text-white"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div className="max-w-4xl mx-auto p-6 space-y-6">

        {/* PROOFS */}
        {tab === "proofs" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Proof Submissions</h2>
            {proofs.length === 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500">
                No proofs submitted yet
              </div>
            )}
            {proofs.map(p => (
              <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-bold text-white">{p.user_name}</p>
                    <p className="text-zinc-500 text-sm">{p.session_title}</p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                    p.status === "accepted" ? "bg-green-500/20 text-green-400" :
                    p.status === "declined" ? "bg-red-500/20 text-red-400" :
                    "bg-yellow-500/20 text-yellow-400"
                  }`}>
                    {p.status}
                  </span>
                </div>
                {p.proof_url && (
                  <div className="mb-4 rounded-xl overflow-hidden">
                    {p.proof_url.match(/\.(mp4|mov|avi)$/i) ? (
                      <video
                        src={p.proof_url}
                        controls
                        className="w-full max-h-64 object-cover"
                      />
                    ) : (
                      <img
                        src={p.proof_url}
                        className="w-full max-h-64 object-cover"
                      />
                    )}
                  </div>
                )}
                {p.status === "submitted" && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => updateProofStatus(p.id, "accepted", p.user_name, p.session_id)}
                      className="flex-1 py-2.5 bg-green-500/20 border border-green-500/40 text-green-400 rounded-xl font-semibold hover:bg-green-500/30 transition-colors"
                    >
                      ✅ Accept
                    </button>
                    <button
                      onClick={() => updateProofStatus(p.id, "declined", p.user_name, p.session_id)}
                      className="flex-1 py-2.5 bg-red-500/20 border border-red-500/40 text-red-400 rounded-xl font-semibold hover:bg-red-500/30 transition-colors"
                    >
                      ❌ Decline
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* SESSIONS */}
        {tab === "sessions" && (
          <div className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <h2 className="text-lg font-bold text-white">Create Session</h2>
              <input
                placeholder="Session title"
                value={newSession.title}
                onChange={e => setNewSession(p => ({ ...p, title: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={newSession.type}
                  onChange={e => setNewSession(p => ({ ...p, type: e.target.value }))}
                  className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
                >
                  <option>Quest</option>
                  <option>Challenge</option>
                  <option>Activity</option>
                </select>
                <select
                  value={newSession.skill_type}
                  onChange={e => setNewSession(p => ({ ...p, skill_type: e.target.value }))}
                  className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
                >
                  <option>Open Skill</option>
                  <option>Competitive</option>
                </select>
                <input
                  placeholder="Category (e.g. Sport)"
                  value={newSession.category}
                  onChange={e => setNewSession(p => ({ ...p, category: e.target.value }))}
                  className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400"
                />
                <input
                  type="number"
                  placeholder="LP points"
                  value={newSession.points}
                  onChange={e => setNewSession(p => ({ ...p, points: Number(e.target.value) }))}
                  className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
              <input
                placeholder="Image URL (optional)"
                value={newSession.image}
                onChange={e => setNewSession(p => ({ ...p, image: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400"
              />
              {newSession.image ? (
                <div className="rounded-xl overflow-hidden h-32">
                  <img
                    src={newSession.image}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none"
                    }}
                  />
                </div>
              ) : null}
              <button
                onClick={createSession}
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-cyan-400 rounded-xl font-bold hover:opacity-90 transition-opacity"
              >
                ⚡ Create Session
              </button>
            </div>

            <h2 className="text-lg font-bold text-white">All Sessions</h2>
            {sessions.length === 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500">
                No sessions created yet
              </div>
            )}
            {sessions.map(s => (
              <div
                key={s.id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden"
              >
                {s.image && (
                  <img
                    src={s.image}
                    className="w-full h-32 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none"
                    }}
                  />
                )}
                <div className="p-5 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-white">{s.title}</p>
                    <p className="text-zinc-500 text-sm">
                      {s.type} · {s.skill_type} · ⚡ {s.points} LP
                    </p>
                  </div>
                  <button
                    onClick={() => deleteSession(s.id)}
                    className="text-red-400 text-sm border border-red-400/30 px-4 py-2 rounded-xl hover:bg-red-400/10 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* STUDENTS */}
        {tab === "students" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Students — {SCHOOL}</h2>
            {students.length === 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500">
                No students signed up yet
              </div>
            )}
            {students.map((s) => (
              <div
                key={s.user_name}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex justify-between items-center"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 flex items-center justify-center font-bold text-white">
                    {s.user_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-white">{s.user_name}</p>
                    <p className="text-zinc-500 text-sm">
                      {s.sessions} sessions completed
                    </p>
                  </div>
                </div>
                <span className="text-cyan-400 font-bold text-lg">
                  {s.points} LP
                </span>
              </div>
            ))}
          </div>
        )}

        {/* CODES */}
        {tab === "codes" && (
          <div className="space-y-4">
            {generatedCode && (
              <div className="bg-cyan-400/10 border border-cyan-400/40 rounded-2xl p-6 text-center">
                <p className="text-zinc-400 text-sm mb-2">
                  New code generated — share this with the student
                </p>
                <p className="text-4xl font-black text-cyan-400 tracking-widest">
                  {generatedCode}
                </p>
              </div>
            )}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <h2 className="text-lg font-bold text-white">Generate Invite Code</h2>
              <input
                placeholder="Student or admin name"
                value={newCode.user_name}
                onChange={e => setNewCode(p => ({ ...p, user_name: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400"
              />
              <select
                value={newCode.role}
                onChange={e => setNewCode(p => ({ ...p, role: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="student">Student</option>
                <option value="admin">Admin</option>
              </select>
              <button
                onClick={createCode}
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-cyan-400 rounded-xl font-bold hover:opacity-90 transition-opacity"
              >
                🔑 Generate Code
              </button>
            </div>

            <h2 className="text-lg font-bold text-white">All Codes</h2>
            {codes.length === 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500">
                No codes generated yet
              </div>
            )}
            {codes.map(c => (
              <div
                key={c.id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex justify-between items-center"
              >
                <div>
                  <p className="font-mono font-bold text-cyan-400 text-lg">
                    {c.code}
                  </p>
                  <p className="text-zinc-500 text-sm">
                    {c.user_name} · {c.role}
                  </p>
                </div>
                <span className={`text-sm px-3 py-1 rounded-full font-semibold ${
                  c.used
                    ? "bg-green-500/20 text-green-400"
                    : "bg-zinc-700 text-zinc-400"
                }`}>
                  {c.used ? "Used" : "Unused"}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* GROUPS */}
        {tab === "groups" && (
          <div className="space-y-4">
            {pendingMembers.length > 0 && (
              <>
                <h2 className="text-lg font-bold text-yellow-400">
                  ⏳ Pending Join Requests
                </h2>
                {pendingMembers.map(m => (
                  <div
                    key={m.id}
                    className="bg-zinc-900 border border-yellow-500/30 rounded-2xl p-5"
                  >
                    <p className="font-bold text-white mb-1">{m.user_name}</p>
                    <p className="text-zinc-500 text-sm mb-4">
                      wants to join a group
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleMemberRequest(m.id, "accepted")}
                        className="flex-1 py-2.5 bg-green-500/20 border border-green-500/40 text-green-400 rounded-xl font-semibold"
                      >
                        ✅ Accept
                      </button>
                      <button
                        onClick={() => handleMemberRequest(m.id, "declined")}
                        className="flex-1 py-2.5 bg-red-500/20 border border-red-500/40 text-red-400 rounded-xl font-semibold"
                      >
                        ❌ Decline
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <h2 className="text-lg font-bold text-white">Create Group</h2>
              <input
                placeholder="Group name"
                value={newGroup.name}
                onChange={e => setNewGroup(p => ({ ...p, name: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400"
              />
              <input
                placeholder="Description (optional)"
                value={newGroup.description}
                onChange={e => setNewGroup(p => ({ ...p, description: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400"
              />
              <button
                onClick={createGroup}
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-cyan-400 rounded-xl font-bold hover:opacity-90 transition-opacity"
              >
                🏫 Create Group
              </button>
            </div>

            <h2 className="text-lg font-bold text-white">Your Groups</h2>
            {groups.length === 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500">
                No groups yet
              </div>
            )}
            {groups.map(g => (
              <div
                key={g.id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex justify-between items-center"
              >
                <div>
                  <p className="font-bold text-white">{g.name}</p>
                  {g.description && (
                    <p className="text-zinc-500 text-sm">{g.description}</p>
                  )}
                </div>
                <button
                  onClick={() => deleteGroup(g.id)}
                  className="text-red-400 text-sm border border-red-400/30 px-4 py-2 rounded-xl hover:bg-red-400/10 transition-colors"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}