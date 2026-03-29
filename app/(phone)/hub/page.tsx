"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getUser } from "@/lib/auth"
import BottomNav from "@/components/BottomNav"

type HubPost = {
  id: string
  user_name: string
  school: string
  session_title: string
  session_type: string
  session_category: string
  media_url: string
  media_type: string
  tried_count: number
  created_at: string
}

type Filter = "All" | "Challenge" | "Activity" | "Quest"

export default function Hub() {
  const router = useRouter()
  const [user, setUser] = useState("")
  const [posts, setPosts] = useState<HubPost[]>([])
  const [filter, setFilter] = useState<Filter>("All")
  const [tried, setTried] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({})
  const cardRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Safe zone values
  const TOP_SAFE = 56  // below the phone status bar + nav
  const BOTTOM_SAFE = 72 // above the bottom nav

  useEffect(() => {
    const currentUser = getUser()
    if (currentUser) setUser(currentUser)
  }, [])

  useEffect(() => {
    loadPosts()
  }, [filter])

  useEffect(() => {
    if (!user) return
    loadTried()
  }, [user])

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const postId = entry.target.getAttribute("data-post-id")
          if (!postId) return
          const video = videoRefs.current[postId]
          if (entry.isIntersecting && entry.intersectionRatio > 0.7) {
            if (video) {
              video.muted = false
              video.play().catch(() => {
                video.muted = true
                video.play().catch(() => {})
              })
            }
          } else {
            if (video) {
              video.pause()
              video.currentTime = 0
            }
          }
        })
      },
      { threshold: 0.7 }
    )
    return () => observerRef.current?.disconnect()
  }, [])

  useEffect(() => {
    Object.entries(cardRefs.current).forEach(([_, el]) => {
      if (el) observerRef.current?.observe(el)
    })
  }, [posts])

  async function loadPosts() {
    setLoading(true)
    let query = supabase
      .from("hub_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
    if (filter !== "All") query = query.eq("session_type", filter)
    const { data } = await query
    if (data) setPosts(data)
    setLoading(false)
  }

  async function loadTried() {
    const { data } = await supabase
      .from("hub_tries")
      .select("hub_post_id")
      .eq("user_name", user)
    if (data) setTried(data.map(t => t.hub_post_id))
  }

  async function handleTryIRL(post: HubPost) {
    if (tried.includes(post.id)) return
    await supabase.from("hub_tries").insert({ hub_post_id: post.id, user_name: user })
    await supabase.from("hub_posts").update({ tried_count: post.tried_count + 1 }).eq("id", post.id)
    setTried(prev => [...prev, post.id])
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, tried_count: p.tried_count + 1 } : p))
    router.push("/sessions")
  }

  function getTypeGradient(type: string) {
    if (type === "Challenge") return "linear-gradient(135deg, #7c3aed, #B400FF)"
    if (type === "Activity") return "linear-gradient(135deg, #be185d, #ec4899)"
    return "linear-gradient(135deg, #1d4ed8, #3b82f6)"
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m`
    if (hours < 24) return `${hours}h`
    return `${days}d`
  }

  const filters: Filter[] = ["All", "Challenge", "Activity", "Quest"]

  return (
    <div style={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      background: "#000",
      overflow: "hidden",
      position: "relative"
    }}>

      {/* SCROLL FEED */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflowY: "scroll",
        scrollSnapType: "y mandatory",
        WebkitOverflowScrolling: "touch" as any,
      }}>

        {/* LOADING */}
        {loading && (
          <div style={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <p style={{ color: "#52525b", fontSize: 13 }}>Loading Hub...</p>
          </div>
        )}

        {/* EMPTY */}
        {!loading && posts.length === 0 && (
          <div style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 32px",
            textAlign: "center"
          }}>
            <p style={{ fontSize: 48, marginBottom: 16 }}>🌍</p>
            <p style={{ color: "white", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
              Hub is empty
            </p>
            <p style={{ color: "#52525b", fontSize: 13, marginBottom: 24 }}>
              Complete a session and share it to be first!
            </p>
            <button
              onClick={() => router.push("/sessions")}
              style={{
                padding: "12px 24px",
                background: "linear-gradient(to right, #B400FF, #00D4FF)",
                borderRadius: 12, color: "white",
                fontWeight: 700, fontSize: 13,
                border: "none", cursor: "pointer"
              }}
            >
              ⚡ Go Complete a Session
            </button>
          </div>
        )}

        {/* CARDS */}
        {!loading && posts.map((post) => (
          <div
            key={post.id}
            ref={el => { cardRefs.current[post.id] = el }}
            data-post-id={post.id}
            style={{
              height: "100%",
              width: "100%",
              scrollSnapAlign: "start",
              scrollSnapStop: "always",
              position: "relative",
              overflow: "hidden",
              display: "block",
              background: "#000",
              flexShrink: 0
            }}
          >
            {/* MEDIA — full bleed edge to edge */}
            {post.media_type === "video" ? (
              <video
                ref={el => { videoRefs.current[post.id] = el }}
                src={post.media_url}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover"
                }}
                autoPlay
                loop
                muted
                playsInline
              />
            ) : (
              <img
                src={post.media_url}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover"
                }}
              />
            )}

            {/* GRADIENT — top and bottom */}
            <div style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 25%, transparent 55%, rgba(0,0,0,0.95) 100%)",
              zIndex: 1
            }} />

            {/* TOP CONTENT — pushed below status bar into safe zone */}
            <div style={{
              position: "absolute",
              top: TOP_SAFE,
              left: 14,
              right: 14,
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              gap: 6
            }}>
              {/* Type badge — left */}
              <span style={{
                background: getTypeGradient(post.session_type),
                color: "white",
                fontSize: 10,
                fontWeight: 800,
                padding: "5px 12px",
                borderRadius: 100,
                textTransform: "uppercase" as any,
                letterSpacing: 1,
                flexShrink: 0,
                boxShadow: "0 2px 8px rgba(0,0,0,0.5)"
              }}>
                {post.session_type}
              </span>

              {/* Filter pills — center */}
              <div style={{
                display: "flex",
                gap: 5,
                flex: 1,
                overflowX: "auto",
                scrollbarWidth: "none" as any
              }}>
                {filters.map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    style={{
                      padding: "5px 11px",
                      borderRadius: 100,
                      fontSize: 11,
                      fontWeight: 700,
                      border: "none",
                      cursor: "pointer",
                      flexShrink: 0,
                      background: filter === f
                        ? "linear-gradient(135deg, #B400FF, #00D4FF)"
                        : "rgba(0,0,0,0.55)",
                      color: filter === f ? "white" : "rgba(255,255,255,0.75)",
                      backdropFilter: "blur(8px)",
                      boxShadow: filter === f
                        ? "0 2px 12px rgba(180,0,255,0.5)"
                        : "none"
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Category badge — right */}
              <span style={{
                background: "rgba(0,0,0,0.55)",
                backdropFilter: "blur(6px)",
                color: "white",
                fontSize: 10,
                fontWeight: 600,
                padding: "5px 10px",
                borderRadius: 100,
                flexShrink: 0
              }}>
                {post.session_category}
              </span>
            </div>

            {/* BOTTOM CONTENT — pushed above bottom nav */}
            <div style={{
              position: "absolute",
              bottom: BOTTOM_SAFE,
              left: 14,
              right: 14,
              zIndex: 10
            }}>
              {/* Username + school + time */}
              <p style={{
                color: "rgba(255,255,255,0.65)",
                fontSize: 11,
                marginBottom: 4
              }}>
                {post.user_name} · {post.school} · {timeAgo(post.created_at)}
              </p>

              {/* Session title — bottom left */}
              <p style={{
                color: "white",
                fontWeight: 800,
                fontSize: 15,
                lineHeight: 1.3,
                marginBottom: 12,
                textShadow: "0 1px 6px rgba(0,0,0,0.8)"
              }}>
                {post.session_title}
              </p>

              {/* TRY IRL + TRIED COUNT */}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>

                {/* TRY IRL button — 65% */}
                <button
                  onClick={() => handleTryIRL(post)}
                  disabled={tried.includes(post.id)}
                  style={{
                    flex: "0 0 65%",
                    padding: "13px 0",
                    borderRadius: 100,
                    fontSize: 14,
                    fontWeight: 800,
                    border: "none",
                    cursor: tried.includes(post.id) ? "default" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    background: tried.includes(post.id)
                      ? "#27272a"
                      : "linear-gradient(135deg, #B400FF, #00D4FF)",
                    color: tried.includes(post.id) ? "#71717a" : "white",
                    boxShadow: tried.includes(post.id)
                      ? "none"
                      : "0 4px 20px rgba(180,0,255,0.5)"
                  }}
                >
                  {tried.includes(post.id) ? (
                    <>✓ Tried IRL</>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                      </svg>
                      TRY IRL
                    </>
                  )}
                </button>

                {/* TRIED COUNT pill */}
                <div style={{
                  flex: 1,
                  background: "rgba(39,39,42,0.85)",
                  backdropFilter: "blur(6px)",
                  borderRadius: 100,
                  padding: "13px 0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  <span style={{ color: "white", fontSize: 11, fontWeight: 700 }}>
                    {post.tried_count.toLocaleString()} Tried
                  </span>
                </div>

              </div>
            </div>

          </div>
        ))}

      </div>

      {/* BOTTOM NAV */}
      <div style={{ flexShrink: 0 }}>
        <BottomNav />
      </div>

    </div>
  )
}