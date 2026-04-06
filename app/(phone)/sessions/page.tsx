"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import BottomNav from "@/components/BottomNav"
import NotificationBell from "@/components/NotificationBell"
import { supabase } from "@/lib/supabase"
import { getUser, getSchool } from "@/lib/auth"

export default function Sessions() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const highlightSession = searchParams.get("session")

  const [user, setUser] = useState("")
  const [school, setSchool] = useState("")
  const [sessions, setSessions] = useState<any[]>([])
  const [attempts, setAttempts] = useState<Record<string, any>>({})
  const [activeUpload, setActiveUpload] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [shareChoice, setShareChoice] = useState<Record<string, "hub" | "private" | null>>({})
  const [ticker, setTicker] = useState<string[]>([
    "⚡ Welcome to IRL — In Real Life",
    "🏆 Be the first to top the leaderboard!",
    "🌍 Complete a session and share it to the Hub",
  ])
  const sessionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    const u = getUser() || ""
    const s = getSchool() || ""
    setUser(u)
    setSchool(s)
  }, [])

  useEffect(() => {
    if (user) {
      loadSessions()
      loadAttempts()
      loadTicker()
    }
  }, [user])

  // Auto open specific session from Hub
  useEffect(() => {
    if (!highlightSession || sessions.length === 0) return
    setTimeout(() => {
      const el = sessionRefs.current[highlightSession]
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" })
      setActiveUpload(highlightSession)
    }, 300)
  }, [highlightSession, sessions])

  // Live timer ticker
  useEffect(() => {
    const interval = setInterval(() => setSessions(prev => [...prev]), 1000)
    return () => clearInterval(interval)
  }, [])

  async function loadTicker() {
    const items: string[] = []

    // Top 3 leaderboard
    const { data: lb } = await supabase
      .from("leaderboard")
      .select("user_name, points")
      .order("points", { ascending: false })
      .limit(3)

    if (lb && lb.length > 0) {
      const medals = ["🥇", "🥈", "🥉"]
      lb.forEach((u, i) => {
        items.push(`${medals[i]} ${u.user_name} is #${i + 1} with ${u.points} LP`)
      })
    }

    // Recent hub posts
    const { data: posts } = await supabase
      .from("hub_posts")
      .select("user_name, session_title")
      .order("created_at", { ascending: false })
      .limit(3)

    if (posts && posts.length > 0) {
      posts.forEach(p => {
        items.push(`⚡ ${p.user_name} just posted "${p.session_title}" on the Hub`)
      })
    }

    // Recent accepted proofs
    const { data: accepted } = await supabase
      .from("session_attempts")
      .select("user_name, session_id")
      .eq("status", "accepted")
      .order("created_at", { ascending: false })
      .limit(3)

    if (accepted && accepted.length > 0) {
      for (const a of accepted) {
        const { data: s } = await supabase
          .from("sessions")
          .select("title")
          .eq("id", a.session_id)
          .maybeSingle()
        if (s) items.push(`✅ ${a.user_name} completed "${s.title}"`)
      }
    }

    if (items.length > 0) setTicker(items)
  }

  function getTimeLeft(expiresAt: string) {
    if (!expiresAt) return null
    const diff = new Date(expiresAt).getTime() - Date.now()
    if (diff <= 0) return "Expired"
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    return `${h}h ${m}m ${s}s`
  }

  async function loadSessions() {
    const { data } = await supabase.from("sessions").select("*")
    if (data) setSessions(data)
  }

  async function loadAttempts() {
    const { data } = await supabase
      .from("session_attempts")
      .select("session_id, status, created_at")
      .eq("user_name", user)
    if (!data) return
    const map: Record<string, any> = {}
    data.forEach(a => { map[a.session_id] = a })
    setAttempts(map)
  }

  async function trySession(session: any) {
    const { data: existing } = await supabase
      .from("session_attempts").select("id")
      .eq("user_name", user).eq("session_id", session.id).maybeSingle()

    if (existing) { setActiveUpload(session.id); return }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    await supabase.from("session_attempts").insert({
      user_name: user, session_id: session.id, status: "pending"
    })
    await supabase.from("sessions").update({ expires_at: expiresAt }).eq("id", session.id)

    setSessions(prev => prev.map(s =>
      s.id === session.id ? { ...s, expires_at: expiresAt } : s
    ))
    setAttempts(prev => ({
      ...prev,
      [session.id]: { session_id: session.id, status: "pending" }
    }))
    setActiveUpload(session.id)
  }

  async function uploadProof(sessionId: string, file: File, shareType: "hub" | "private") {
    setUploading(true)
    try {
      const ext = file.name.split(".").pop()
      const fileName = `${user}-${sessionId}-${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from("proof").upload(fileName, file, { upsert: true })
      if (uploadError) { alert(`Upload error: ${uploadError.message}`); setUploading(false); return }

      const { data: urlData } = supabase.storage.from("proof").getPublicUrl(fileName)
      const proofUrl = urlData.publicUrl

      if (shareType === "hub") {
        const session = sessions.find(s => s.id === sessionId)

        await supabase.from("session_attempts")
          .update({ proof_url: proofUrl, status: "accepted" })
          .eq("user_name", user).eq("session_id", sessionId)

        const { data: lb } = await supabase.from("leaderboard")
          .select("id, points").eq("user_name", user).maybeSingle()
        if (lb && session) {
          await supabase.from("leaderboard")
            .update({ points: lb.points + session.points }).eq("id", lb.id)
        }

        const isVideo = file.type.startsWith("video")
        await supabase.from("hub_posts").insert({
          user_name: user, school,
          session_id: sessionId,
          session_title: session?.title || "",
          session_type: session?.type || "Quest",
          session_category: session?.category || "General",
          media_url: proofUrl,
          media_type: isVideo ? "video" : "image",
          tried_count: 0
        })

        await supabase.from("notifications").insert({
          user_name: user,
          title: "LP Awarded! ⚡",
          message: `You shared to the Hub and earned ${session?.points} LP instantly!`,
          type: "proof_accepted", read: false
        })

        setAttempts(prev => ({ ...prev, [sessionId]: { ...prev[sessionId], status: "accepted" } }))
        // Refresh ticker with new data
        loadTicker()
        alert(`🔥 Posted to Hub! +${session?.points} LP awarded!`)
      } else {
        await supabase.from("session_attempts")
          .update({ proof_url: proofUrl, status: "submitted" })
          .eq("user_name", user).eq("session_id", sessionId)
        setAttempts(prev => ({ ...prev, [sessionId]: { ...prev[sessionId], status: "submitted" } }))
        alert("Proof submitted! Your institution will review it.")
      }

      setActiveUpload(null)
      setShareChoice(prev => ({ ...prev, [sessionId]: null }))
    } catch (e: any) {
      alert(`Failed: ${e.message}`)
    }
    setUploading(false)
  }

  function getTypeColor(type: string) {
    if (type === "Challenge") return "bg-red-500"
    if (type === "Activity") return "bg-pink-500"
    return "bg-purple-500"
  }

  return (
    <div className="flex flex-col h-full bg-black text-white">
      <main className="flex flex-col flex-1 overflow-y-auto" style={{ paddingBottom: 80 }}>

        {/* HEADER */}
        <div className="p-4 pb-2 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-cyan-400">Sessions</h1>
          <NotificationBell />
        </div>

        {/* TABS */}
        <div className="flex text-sm border-b border-zinc-800">
          <button className="flex-1 py-2.5 text-white font-semibold bg-zinc-800">Sessions</button>
          <button onClick={() => router.push("/groups")} className="flex-1 py-2.5 text-zinc-400">Groups</button>
          <button onClick={() => router.push("/leaderboard")} className="flex-1 py-2.5 text-zinc-400">Leaderboard</button>
        </div>
{/* TICKER */}
<div style={{
  background: "rgba(24,24,27,0.9)",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  padding: "8px 0",
  overflow: "hidden",
  width: "100%",
  position: "relative",
}}>
  <div style={{
    display: "flex",
    whiteSpace: "nowrap",
    animation: "tickerScroll 25s linear infinite",
  }}>
    <span style={{ color: "#71717a", fontSize: 12, paddingRight: 60 }}>
      {ticker.join("     ·     ")}
    </span>
    {/* Duplicate for seamless loop */}
    <span style={{ color: "#71717a", fontSize: 12, paddingRight: 60 }}>
      {ticker.join("     ·     ")}
    </span>
  </div>
  <style>{`
    @keyframes tickerScroll {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
  `}</style>
</div>
        {/* SESSIONS */}
        <div className="p-4 space-y-5">
          {sessions.length === 0 && (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">⚡</p>
              <p className="text-zinc-500 text-sm">No sessions yet</p>
              <p className="text-zinc-700 text-xs mt-1">Your institution will post sessions here</p>
            </div>
          )}

          {sessions.map((session) => {
            const attempt = attempts[session.id]
            const hasAttempt = !!attempt
            const isSubmitted = attempt?.status === "submitted"
            const isAccepted = attempt?.status === "accepted"
            const isDeclined = attempt?.status === "declined"
            const showUpload = activeUpload === session.id
            const timeLeft = getTimeLeft(session.expires_at)
            const currentChoice = shareChoice[session.id]
            const isHighlighted = highlightSession === session.id

            return (
              <div
                key={session.id}
                ref={(el) => { sessionRefs.current[session.id] = el }}
                className="rounded-2xl overflow-hidden"
                style={{
                  background: isHighlighted ? "rgba(0,212,255,0.05)" : "#18181b",
                  border: isHighlighted
                    ? "1.5px solid rgba(0,212,255,0.5)"
                    : "1px solid rgba(255,255,255,0.07)",
                  boxShadow: isHighlighted ? "0 0 30px rgba(0,212,255,0.1)" : "none",
                  transition: "all 0.3s"
                }}
              >
                {/* IMAGE */}
                <div className="relative">
                  {session.image ? (
                    <img src={session.image} className="w-full h-36 object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                  ) : (
                    <div className="w-full h-36 bg-gradient-to-br from-zinc-800 to-zinc-700" />
                  )}
                  <div className="absolute top-2 left-2">
                    <span className={`${getTypeColor(session.type)} text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide`}>
                      {session.type || "Quest"}
                    </span>
                  </div>
                  <div className="absolute top-2 right-2 bg-zinc-900/80 border border-cyan-500/50 text-cyan-400 text-[11px] font-bold px-2.5 py-1 rounded-full">
                    ⚡ {session.points} LP
                  </div>
                  {isHighlighted && (
                    <div className="absolute bottom-2 left-2">
                      <span className="bg-cyan-400 text-black text-[10px] font-black px-3 py-1 rounded-full">
                        ← From Hub
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <h3 className="font-bold text-white text-base">{session.title}</h3>
                  <p className="text-zinc-500 text-xs mt-0.5 mb-3">
                    by {session.creator || "Admin"} · {session.category || "General"}
                  </p>

                  {/* LIVE TIMER */}
                  {timeLeft && timeLeft !== "Expired" && hasAttempt && !isAccepted && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-zinc-500 text-xs">Time remaining</span>
                        <span className="text-cyan-400 text-xs font-bold">⏱ {timeLeft}</span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-1.5">
                        <div
                          className="bg-gradient-to-r from-cyan-400 to-purple-500 h-1.5 rounded-full"
                          style={{
                            width: `${Math.max(0, Math.min(100,
                              (1 - (new Date(session.expires_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000)) * 100
                            ))}%`,
                            transition: "width 1s linear"
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {isAccepted && (
                    <div className="bg-green-500/20 border border-green-500 text-green-400 text-xs px-3 py-2 rounded-xl mb-3 text-center font-semibold">
                      ✅ Accepted — LP awarded!
                    </div>
                  )}
                  {isDeclined && (
                    <div className="bg-red-500/20 border border-red-500 text-red-400 text-xs px-3 py-2 rounded-xl mb-3 text-center font-semibold">
                      ❌ Declined — try again
                    </div>
                  )}
                  {isSubmitted && (
                    <div className="bg-yellow-500/20 border border-yellow-500 text-yellow-400 text-xs px-3 py-2 rounded-xl mb-3 text-center font-semibold">
                      ⏳ Proof submitted — awaiting review
                    </div>
                  )}

                  {/* UPLOAD PANEL */}
                  {showUpload && !isSubmitted && !isAccepted && (
                    <div className="bg-zinc-800 rounded-xl p-3 mb-3 border border-zinc-700 space-y-3">
                      <p className="text-sm text-white font-semibold">📎 Upload your proof</p>

                      {!currentChoice && (
                        <>
                          <p className="text-xs text-zinc-400">How do you want to share?</p>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => setShareChoice(prev => ({ ...prev, [session.id]: "hub" }))}
                              className="p-3 rounded-xl text-center"
                              style={{ background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.3)" }}
                            >
                              <p className="text-lg mb-1">🌍</p>
                              <p className="text-white text-xs font-bold">Share on Hub</p>
                              <p className="text-cyan-400 text-[10px] mt-0.5">Get LP instantly</p>
                            </button>
                            <button
                              onClick={() => setShareChoice(prev => ({ ...prev, [session.id]: "private" }))}
                              className="p-3 bg-zinc-900 border border-zinc-700 rounded-xl text-center"
                            >
                              <p className="text-lg mb-1">🔒</p>
                              <p className="text-white text-xs font-bold">Share Privately</p>
                              <p className="text-zinc-500 text-[10px] mt-0.5">Admin reviews</p>
                            </button>
                          </div>
                        </>
                      )}

                      {currentChoice && (
                        <>
                          <div className={`text-xs px-3 py-2 rounded-xl text-center font-semibold ${
                            currentChoice === "hub"
                              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                              : "bg-zinc-700 text-zinc-300"
                          }`}>
                            {currentChoice === "hub"
                              ? "🌍 Sharing to Hub — LP awarded instantly"
                              : "🔒 Sharing privately — admin will review"}
                          </div>
                          <label className="block w-full py-3 bg-gradient-to-r from-purple-500 to-cyan-400 rounded-xl text-sm font-bold text-center cursor-pointer text-white">
                            {uploading ? "Uploading..." : "📷 Choose Photo or Video"}
                            <input
                              type="file" accept="image/*,video/*" capture="environment"
                              className="hidden" disabled={uploading}
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) uploadProof(session.id, file, currentChoice)
                              }}
                            />
                          </label>
                          <button
                            onClick={() => setShareChoice(prev => ({ ...prev, [session.id]: null }))}
                            className="w-full text-zinc-500 text-xs"
                          >
                            ← Change option
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {!isAccepted && !isSubmitted && (
                    <button
                      onClick={() => {
                        if (hasAttempt) {
                          setActiveUpload(activeUpload === session.id ? null : session.id)
                        } else {
                          trySession(session)
                        }
                      }}
                      className="w-full py-3 bg-gradient-to-r from-purple-500 to-cyan-400 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                    >
                      ⚡ {hasAttempt ? "Upload Proof" : "Try IRL"}
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