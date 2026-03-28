"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getUser, getSchool, logout } from "@/lib/auth"
import InstitutionsTab from "@/components/InstitutionsTab"

type Tab = "proofs" | "sessions" | "students" | "codes" | "groups" | "institutions"

export default function AdminDashboard() {
  const router = useRouter()
  const [ADMIN, setADMIN] = useState("Admin")
  const [SCHOOL, setSCHOOL] = useState("Test School")
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

  useEffect(() => {
    const user = getUser()
    const school = getSchool()
    if (!user) {
      router.replace("/login")
      return
    }
    if (user) setADMIN(user)
    if (school) setSCHOOL(school)
  }, [])

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

    setNewSession({ title: "", type: "Quest", skill_type: "Open Skill", points: 50, category: "", creator: ADMIN, image: "" })
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
      .insert({ code, user_name: newCode.user_name, school: SCHOOL, role: newCode.role, used: false })
    if (error) return alert(`Error: ${error.message}`)
    setGeneratedCode(code)
    setNewCode({ user_name: "", role: "student" })
    loadCodes()
  }

  async function updateProofStatus(id: string, status: string, userName: string, sessionId: string) {
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

      if (session) {
        const { data: lb } = await supabase
          .from("leaderboard")
          .select("id, points")
          .eq("user_name", userName)
          .maybeSingle()

        if (lb) {
          const newPoints = lb.points + session.points
          await supabase.from("leaderboard").update({ points: newPoints }).eq("id", lb.id)
        } else {
          await supabase.from("leaderboard").insert({ user_name: userName, points: session.points })
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
      .insert({ name: newGroup.name, description: newGroup.description, institution: SCHOOL, total_lp: 0 })
    if (error) return alert(`Error: ${error.message}`)
    setNewGroup({ name: "", description: "" })
    loadGroups()
    alert("Group created!")
  }

  async function handleMemberRequest(id: string, status: string) {
    await supabase.from("group_members").update({ status }).eq("id", id)
    loadPendingMembers()
  }

  async function deleteGroup(id: string) {
    if (!confirm("Are you sure you want to delete this group?")) return
    await supabase.from("groups").delete().eq("id", id)
    loadGroups()
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "proofs", label: "Proofs", icon: "📎" },
    { key: "sessions", label: "Sessions", icon: "⚡" },
    { key: "students", label: "Students", icon: "👥" },
    { key: "codes", label: "Codes", icon: "🔑" },
    { key: "groups", label: "Groups", icon: "👥" },
    { key: "institutions", label: "Institutions", icon: "🏫" },
  ]

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-cyan-400">Admin Dashboard</h1>
          <p className="text-zinc-500 text-sm">{SCHOOL}</p>
        </div>
        <button
          onClick={() => { logout(); router.replace("/login") }}
          className="text-sm text-red-400 border border-red-400/30 px-4 py-2 rounded-xl hover:bg-red-400/10 transition-colors"
        >
          Log Out
        </button>
      </div>

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

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {tab === "institutions" && (
          <div className="space-y-4">
            <InstitutionsTab school={SCHOOL} />
          </div>
        )}
      </div>
    </div>
  )
}