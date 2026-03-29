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
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({})
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    const currentUser = getUser()
    if (currentUser) setUser(currentUser)
  }, [])

  useEffect(() => {
    loadPosts()
  }, [filter])

  useEffect(() => {
    if (user) loadTried()
  }, [user])

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute("data-post-id")
          if (!id) return
          const vid = videoRefs.current[id]
          if (entry.isIntersecting && entry.intersectionRatio > 0.7) {
            if (vid) {
              vid.muted = false
              vid.play().catch(() => {
                vid.muted = true
                vid.play().catch(() => {})
              })
            }
          } else if (vid) {
            vid.pause()
            vid.currentTime = 0
            vid.muted = true
          }
        })
      },
      { threshold: 0.7 }
    )
    return () => observerRef.current?.disconnect()
  }, [])

  useEffect(() => {
    Object.values(cardRefs.current).forEach((el) => {
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
    if (data) setTried(data.map((t) => t.hub_post_id))
  }

  async function handleTryIRL(post: HubPost) {
    if (tried.includes(post.id)) return
    await supabase.from("hub_tries").insert({ hub_post_id: post.id, user_name: user })
    await supabase.from("hub_posts").update({ tried_count: post.tried_count + 1 }).eq("id", post.id)
    setTried((p) => [...p, post.id])
    setPosts((p) => p.map((x) => (x.id === post.id ? { ...x, tried_count: x.tried_count + 1 } : x)))
    router.push("/sessions")
  }

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime()
    const m = Math.floor(diff / 60000)
    const h = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (m < 1) return "just now"
    if (m < 60) return `${m}m`
    if (h < 24) return `${h}h`
    return `${days}d`
  }

  const getTypeGradient = (t: string) =>
    t === "Challenge"
      ? "linear-gradient(135deg,#7c3aed,#B400FF)"
      : t === "Activity"
      ? "linear-gradient(135deg,#be185d,#ec4899)"
      : "linear-gradient(135deg,#1d4ed8,#3b82f6)"

  const filters: Filter[] = ["All", "Challenge", "Activity", "Quest"]

  return (
    <div style={{
      height: "100%",
      overflow: "hidden",
      background: "#000",
      position: "relative",
      display: "flex",
      flexDirection: "column"
    }}>

      {/* TOP NAV — floats over feed */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        padding: "12px 16px 10px",
        background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)",
        display: "flex",
        alignItems: "center",
        gap: 10
      }}>
        <span style={{ color: "#00D4FF", fontWeight: 800, fontSize: 20, flexShrink: 0 }}>
          Hub
        </span>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", flex: 1, scrollbarWidth: "none" as any }}>
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "6px 14px",
                borderRadius: 100,
                fontSize: 12,
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                flexShrink: 0,
                background: filter === f
                  ? "linear-gradient(135deg,#B400FF,#00D4FF)"
                  : "rgba(255,255,255,0.15)",
                color: filter === f ? "white" : "#ddd",
                boxShadow: filter === f ? "0 2px 12px rgba(180,0,255,0.4)" : "none"
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* FEED */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflowY: "scroll",
        scrollSnapType: "y mandatory",
        WebkitOverflowScrolling: "touch" as any
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
                background: "linear-gradient(to right,#B400FF,#00D4FF)",
                borderRadius: 12,
                color: "white",
                fontWeight: 700,
                fontSize: 13,
                border: "none",
                cursor: "pointer"
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
            ref={(el) => { cardRefs.current[post.id] = el }}
            data-post-id={post.id}
            style={{
              height: "100%",
              scrollSnapAlign: "start",
              scrollSnapStop: "always",
              position: "relative",
              overflow: "hidden",
              background: "#000"
            }}
          >
            {/* MEDIA */}
            {post.media_type === "video" ? (
              <video
                ref={(el) => { videoRefs.current[post.id] = el }}
                src={post.media_url}
                autoPlay
                loop
                muted
                playsInline
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover"
                }}
              />
            ) : (
              <img
                src={post.media_url}
                alt=""
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover"
                }}
              />
            )}

            {/* GRADIENT */}
            <div style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.2) 40%, transparent 70%, rgba(0,0,0,0.4) 100%)",
              zIndex: 1
            }} />

            {/* TYPE + CATEGORY BADGES */}
            <div style={{
              position: "absolute",
              top: 72,
              left: 16,
              right: 16,
              zIndex: 10,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <span style={{
                background: getTypeGradient(post.session_type),
                padding: "6px 14px",
                borderRadius: 999,
                color: "white",
                fontSize: 11,
                fontWeight: 800,
                textTransform: "uppercase" as any,
                letterSpacing: 1,
                boxShadow: "0 2px 8px rgba(0,0,0,0.5)"
              }}>
                {post.session_type}
              </span>

              <span style={{
                background: "rgba(0,0,0,0.6)",
                backdropFilter: "blur(6px)",
                padding: "6px 12px",
                borderRadius: 999,
                color: "white",
                fontSize: 11,
                fontWeight: 600
              }}>
                {post.session_category}
              </span>
            </div>

            {/* BOTTOM CONTENT */}
            <div style={{
              position: "absolute",
              bottom: 80,
              left: 16,
              right: 16,
              zIndex: 10
            }}>
              <p style={{
                color: "rgba(255,255,255,0.65)",
                fontSize: 12,
                marginBottom: 4
              }}>
                {post.user_name} · {post.school} · {timeAgo(post.created_at)}
              </p>

              <p style={{
                color: "white",
                fontWeight: 800,
                fontSize: 16,
                lineHeight: 1.3,
                marginBottom: 14,
                textShadow: "0 1px 6px rgba(0,0,0,0.8)"
              }}>
                {post.session_title}
              </p>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  onClick={() => handleTryIRL(post)}
                  disabled={tried.includes(post.id)}
                  style={{
                    flex: "0 0 65%",
                    padding: "14px 0",
                    borderRadius: 9999,
                    border: "none",
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: tried.includes(post.id) ? "default" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    background: tried.includes(post.id)
                      ? "#27272a"
                      : "linear-gradient(135deg,#B400FF,#00D4FF)",
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

                <div style={{
                  flex: 1,
                  background: "rgba(39,39,42,0.9)",
                  backdropFilter: "blur(6px)",
                  borderRadius: 9999,
                  padding: "14px 0",
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
                  <span style={{ color: "white", fontSize: 12, fontWeight: 700 }}>
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