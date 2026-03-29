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
  const [mutedPosts, setMutedPosts] = useState<{ [key: string]: boolean }>({})

  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({})
  const cardRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})
  const observerRef = useRef<IntersectionObserver | null>(null)

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
        entries.forEach((entry) => {
          const postId = entry.target.getAttribute("data-post-id")
          if (!postId) return
          const video = videoRefs.current[postId]
          if (entry.isIntersecting && entry.intersectionRatio > 0.7) {
            video?.play().catch(() => {})
          } else if (video) {
            video.pause()
            video.muted = true
            setMutedPosts((prev) => ({ ...prev, [postId]: true }))
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
    setTried((prev) => [...prev, post.id])
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, tried_count: p.tried_count + 1 } : p))
    )
    router.push("/sessions")
  }

  function toggleMute(postId: string) {
    const video = videoRefs.current[postId]
    if (video) {
      video.muted = !video.muted
      setMutedPosts((prev) => ({ ...prev, [postId]: video.muted }))
    }
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
    <div style={{ height: "100vh", overflow: "hidden", background: "#000", position: "relative" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 30,
          padding: "12px 16px 8px",
          background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span style={{ color: "#00D4FF", fontWeight: 800, fontSize: 20, letterSpacing: -0.5 }}>
          Hub
        </span>

        <div style={{ display: "flex", gap: 6, overflowX: "auto", flex: 1, scrollbarWidth: "none" }}>
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
                  ? "linear-gradient(135deg, #B400FF, #00D4FF)"
                  : "rgba(255,255,255,0.15)",
                color: filter === f ? "white" : "#ddd",
                backdropFilter: "blur(8px)",
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          height: "100vh",
          overflowY: "scroll",
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {loading && (
          <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ color: "#52525b", fontSize: 13 }}>Loading Hub...</p>
          </div>
        )}

        {!loading &&
          posts.map((post) => (
            <div
              key={post.id}
              ref={(el) => {
                cardRefs.current[post.id] = el
              }}
              data-post-id={post.id}
              style={{
                height: "100vh",
                scrollSnapAlign: "start",
                scrollSnapStop: "always",
                position: "relative",
                overflow: "hidden",
                background: "#000",
              }}
            >
              {post.media_type === "video" ? (
                <video
                  ref={(el) => {
                    videoRefs.current[post.id] = el
                  }}
                  src={post.media_url}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
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
                    objectFit: "cover",
                  }}
                  alt=""
                />
              )}

              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.4) 45%, transparent 70%)",
                  zIndex: 1,
                }}
              />

              <div style={{ position: "absolute", bottom: 90, left: 16, right: 16, zIndex: 10 }}>
                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginBottom: 12 }}>
                  {post.user_name} · {post.school} · {timeAgo(post.created_at)}
                </p>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => handleTryIRL(post)}
                    disabled={tried.includes(post.id)}
                    style={{
                      flex: 1,
                      padding: "14px 0",
                      borderRadius: 9999,
                      fontSize: 15,
                      fontWeight: 800,
                      border: "none",
                      background: tried.includes(post.id)
                        ? "#27272a"
                        : "linear-gradient(135deg, #B400FF, #00D4FF)",
                      color: tried.includes(post.id) ? "#888" : "white",
                    }}
                  >
                    {tried.includes(post.id) ? "✓ Tried IRL" : "TRY IRL"}
                  </button>

                  <div
                    style={{
                      background: "rgba(39,39,42,0.9)",
                      borderRadius: 9999,
                      padding: "14px 18px",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      minWidth: 110,
                    }}
                  >
                    👥 <span style={{ fontWeight: 700 }}>{post.tried_count.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {post.media_type === "video" && (
                <button
                  onClick={() => toggleMute(post.id)}
                  style={{
                    position: "absolute",
                    top: 120,
                    right: 16,
                    zIndex: 20,
                    background: "rgba(0,0,0,0.5)",
                    border: "1px solid rgba(255,255,255,0.3)",
                    borderRadius: "50%",
                    width: 36,
                    height: 36,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {mutedPosts[post.id] !== false ? "🔇" : "🔊"}
                </button>
              )}
            </div>
          ))}
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 30 }}>
        <BottomNav />
      </div>
    </div>
  )
}