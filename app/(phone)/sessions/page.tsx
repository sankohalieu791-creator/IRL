"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import BottomNav from "@/components/BottomNav"
import NotificationBell from "@/components/NotificationBell"
import { supabase } from "@/lib/supabase"
import { getUser, getSchool } from "@/lib/auth"

const USER = getUser() || "Test User"
const SCHOOL = getSchool() || "Test School"

type Session = {
  id: string
  title: string
  points: number
  image: string
  category: string
  type: string
  skill_type: string
  creator: string
  expires_at: string
}

type AttemptStatus = {
  [sessionId: string]: {
    timeLeft: string
    status: string
    expired: boolean
  }
}

export default function Sessions() {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [attempts, setAttempts] = useState<AttemptStatus>({})
  const [activeUpload, setActiveUpload] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [shareChoice, setShareChoice] = useState<{ [sessionId: string]: "hub" | "private" | null }>({})

  const ticker = [
    "🏆 Alex is #1 on the leaderboard!",
    "🎉 Jessica just earned the Bronze Trophy",
    "⚡ Jordan completed Morning Run Challenge",
    "🔥 Sam unlocked 500 LP milestone"
  ]

  useEffect(() => {
    loadSessions()
    loadAttempts()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setSessions(prev => [...prev])
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  function getTimeLeft(expiresAt: string) {
    if (!expiresAt) return null
    const diff = new Date(expiresAt).getTime() - Date.now()
    if (diff <= 0) return "Expired"
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    return `${h}h ${m}m ${s}s remaining`
  }

  async function loadSessions() {
    const { data } = await supabase.from("sessions").select("*")
    if (data) setSessions(data)
  }

  async function loadAttempts() {
    const { data } = await supabase
      .from("session_attempts")
      .select("session_id, status")
      .eq("user_name", USER)

    if (!data) return
    const map: AttemptStatus = {}
    data.forEach(a => {
      map[a.session_id] = {
        timeLeft: "",
        status: a.status,
        expired: false
      }
    })
    setAttempts(map)
  }

  async function trySession(session: Session) {
    const { data: existing } = await supabase
      .from("session_attempts")
      .select("id")
      .eq("user_name", USER)
      .eq("session_id", session.id)
      .maybeSingle()

    if (existing) {
      setActiveUpload(session.id)
      return
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const { error } = await supabase
      .from("session_attempts")
      .insert({
        user_name: USER,
        session_id: session.id,
        status: "pending"
      })

    if (error) {
      alert(`Error: ${error.message}`)
      return
    }

    await supabase
      .from("sessions")
      .update({ expires_at: expiresAt })
      .eq("id", session.id)

    setSessions(prev =>
      prev.map(s => s.id === session.id ? { ...s, expires_at: expiresAt } : s)
    )
    setAttempts(prev => ({
      ...prev,
      [session.id]: {
        timeLeft: "24h 0m 0s remaining",
        status: "pending",
        expired: false
      }
    }))
    setActiveUpload(session.id)
  }

  async function uploadProof(sessionId: string, file: File, shareType: "hub" | "private") {
    setUploading(true)
    try {
      const ext = file.name.split(".").pop()
      const fileName = `${USER}-${sessionId}-${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from("proof")
        .upload(fileName, file, { upsert: true })

      if (uploadError) {
        alert(`Upload error: ${uploadError.message}`)
        setUploading(false)
        return
      }

      const { data: urlData } = supabase.storage
        .from("proof")
        .getPublicUrl(fileName)

      const proofUrl = urlData.publicUrl

      if (shareType === "hub") {
        // Share to Hub — get LP instantly
        const session = sessions.find(s => s.id === sessionId)

        // Update attempt to accepted immediately
        await supabase
          .from("session_attempts")
          .update({
            proof_url: proofUrl,
            status: "accepted"
          })
          .eq("user_name", USER)
          .eq("session_id", sessionId)

        // Award LP instantly
        const { data: lb } = await supabase
          .from("leaderboard")
          .select("id, points")
          .eq("user_name", USER)
          .maybeSingle()

        if (lb && session) {
          await supabase
            .from("leaderboard")
            .update({ points: lb.points + session.points })
            .eq("id", lb.id)
        }

        // Determine media type
        const isVideo = file.type.startsWith("video")

        // Post to Hub
        await supabase.from("hub_posts").insert({
          user_name: USER,
          school: SCHOOL,
          session_id: sessionId,
          session_title: session?.title || "",
          session_type: session?.type || "Quest",
          session_category: session?.category || "General",
          media_url: proofUrl,
          media_type: isVideo ? "video" : "image",
          tried_count: 0
        })

        // Send notification
        await supabase.from("notifications").insert({
          user_name: USER,
          title: "LP Awarded! ⚡",
          message: `You shared your proof on the Hub and earned ${session?.points} LP instantly!`,
          type: "proof_accepted",
          read: false
        })

        setAttempts(prev => ({
          ...prev,
          [sessionId]: { ...prev[sessionId], status: "accepted" }
        }))

        alert(`🔥 Posted to Hub! +${session?.points} LP awarded instantly!`)

      } else {
        // Share privately — admin reviews
        await supabase
          .from("session_attempts")
          .update({
            proof_url: proofUrl,
            status: "submitted"
          })
          .eq("user_name", USER)
          .eq("session_id", sessionId)

        setAttempts(prev => ({
          ...prev,
          [sessionId]: { ...prev[sessionId], status: "submitted" }
        }))

        alert("Proof submitted privately! Your institution will review it.")
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

  function getSkillColor(skill: string) {
    if (skill === "Competitive") return "border-orange-400 text-orange-300"
    return "border-zinc-500 text-zinc-300"
  }

  return (
    <div className="flex flex-col h-full">
      <main className="flex flex-col flex-1 overflow-y-auto pb-16 text-white">

        {/* HEADER */}
        <div className="p-4 pb-2 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-cyan-400">Sessions</h1>
          <NotificationBell />
        </div>

      {/* TABS */}
<div className="flex text-sm border-b border-zinc-800">
  <button className="flex-1 py-2.5 text-white font-semibold bg-zinc-800">
    Sessions
  </button>
  <button
    onClick={() => router.push("/groups")}
    className="flex-1 py-2.5 text-zinc-400 hover:text-white transition-colors"
  >
    Groups
  </button>
  <button
    onClick={() => router.push("/leaderboard")}
    className="flex-1 py-2.5 text-zinc-400 hover:text-white transition-colors"
  >
    Leaderboard
  </button>
</div>

        {/* TICKER */}
        <div className="bg-zinc-900/60 border-b border-zinc-800 py-2 overflow-hidden w-full">
          <div className="animate-marquee text-xs text-zinc-400 whitespace-nowrap px-4">
            {ticker.join("     ·     ")}
          </div>
        </div>

        {/* SESSIONS */}
        <div className="p-4 space-y-5">
          {sessions.map((session) => {
            const attempt = attempts[session.id]
            const hasAttempt = !!attempt
            const isSubmitted = attempt?.status === "submitted"
            const isAccepted = attempt?.status === "accepted"
            const isDeclined = attempt?.status === "declined"
            const showUpload = activeUpload === session.id
            const timeLeft = getTimeLeft(session.expires_at)
            const currentChoice = shareChoice[session.id]

            return (
              <div
                key={session.id}
                className="bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800"
              >
                <div className="relative">
                  {session.image ? (
                    <img
                      src={session.image}
                      className="w-full h-36 object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none"
                      }}
                    />
                  ) : (
                    <div className="w-full h-36 bg-gradient-to-br from-zinc-800 to-zinc-700" />
                  )}

                  <div className="absolute top-2 left-2 flex gap-1.5">
                    <span className={`${getTypeColor(session.type)} text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide`}>
                      {session.type || "Quest"}
                    </span>
                    <span className={`bg-zinc-900/80 border ${getSkillColor(session.skill_type)} text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide`}>
                      ◎ {session.skill_type || "Open Skill"}
                    </span>
                  </div>

                  <div className="absolute top-2 right-2 bg-zinc-900/80 border border-cyan-500/50 text-cyan-400 text-[11px] font-bold px-2.5 py-1 rounded-full">
                    ⚡ {session.points} LP
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="font-bold text-white text-base">{session.title}</h3>
                  <p className="text-zinc-500 text-xs mt-0.5 mb-2">
                    by {session.creator || "Admin"} · {session.category || "General"}
                  </p>

                  {timeLeft && timeLeft !== "Expired" && (
                    <p className="text-cyan-400 text-xs mb-3">⏱ {timeLeft}</p>
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

                  {/* UPLOAD SECTION */}
                  {showUpload && !isSubmitted && !isAccepted && (
                    <div className="bg-zinc-800 rounded-xl p-3 mb-3 border border-zinc-700 space-y-3">
                      <p className="text-sm text-white font-semibold">📎 Upload Proof</p>

                      {/* Share choice */}
                      {!currentChoice && (
                        <>
                          <p className="text-xs text-zinc-400">How do you want to share your proof?</p>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => setShareChoice(prev => ({ ...prev, [session.id]: "hub" }))}
                              className="p-3 bg-gradient-to-br from-purple-900/60 to-cyan-900/40 border border-cyan-500/40 rounded-xl text-center"
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

                      {/* File picker after choice */}
                      {currentChoice && (
                        <>
                          <div className={`text-xs px-3 py-2 rounded-xl text-center font-semibold ${
                            currentChoice === "hub"
                              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                              : "bg-zinc-700 text-zinc-300"
                          }`}>
                            {currentChoice === "hub" ? "🌍 Sharing to Hub — LP awarded instantly" : "🔒 Sharing privately — admin will review"}
                          </div>

                          <label className="block w-full py-2.5 bg-gradient-to-r from-purple-500 to-cyan-400 rounded-xl text-sm font-semibold text-center cursor-pointer text-white">
                            {uploading ? "Uploading..." : "Choose Photo or Video"}
                            <input
                              type="file"
                              accept="image/*,video/*"
                              capture="environment"
                              className="hidden"
                              disabled={uploading}
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
                            ← Change sharing option
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
                      className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-cyan-400 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
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