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
  const [activeFilter, setActiveFilter] = useState<Filter>("All")
  const [tried, setTried] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({})
  const cardRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    const currentUser = getUser()
    if (currentUser) setUser(currentUser)
  }, [])

  useEffect(() => {
    loadPosts()
  }, [activeFilter])

  useEffect(() => {
    if (!user) return
    loadTried()
  }, [user])

  // Intersection Observer for video autoplay
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const postId = entry.target.getAttribute("data-post-id")
          if (!postId) return
          const video = videoRefs.current[postId]
          if (entry.isIntersecting && entry.intersectionRatio > 0.7) {
            video?.play().catch(() => {})
          } else {
            video?.pause()
            if (video) video.currentTime = 0
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

    if (activeFilter !== "All") {
      query = query.eq("session_type", activeFilter)
    }

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
    await supabase
      .from("hub_posts")
      .update({ tried_count: post.tried_count + 1 })
      .eq("id", post.id)

    setTried((prev) => [...prev, post.id])
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id ? { ...p, tried_count: p.tried_count + 1 } : p
      )
    )
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
    <div className="h-screen flex flex-col bg-black overflow-hidden">
      {/* FIXED TOP NAV - exactly like your first screenshot */}
      <div className="flex-shrink-0 pt-2 pb-3 px-4 bg-black border-b border-zinc-900 z-50">
        <div className="flex items-center justify-between mb-3">
          <div className="text-2xl font-bold text-white">Hub</div>
        </div>

        {/* Tab pills - All, Challenge, Activities, Quest */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-5 py-1.5 text-sm font-semibold rounded-full whitespace-nowrap transition-all ${
                activeFilter === f
                  ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/50"
                  : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* FULL SCREEN SCROLL FEED */}
      <div
        className="flex-1 overflow-y-scroll snap-y snap-mandatory scroll-smooth"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {loading && (
          <div className="h-full flex items-center justify-center">
            <p className="text-zinc-500 text-sm">Loading Hub...</p>
          </div>
        )}

        {!loading && posts.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center px-8 text-center">
            <p className="text-6xl mb-4">🌍</p>
            <p className="text-white font-bold text-lg mb-2">Hub is empty</p>
            <p className="text-zinc-500 text-sm mb-8">
              Complete a session and share it to be first!
            </p>
            <button
              onClick={() => router.push("/sessions")}
              className="px-8 py-3 bg-gradient-to-r from-violet-600 to-cyan-400 rounded-2xl font-bold text-white"
            >
              ⚡ Go Complete a Session
            </button>
          </div>
        )}

        {!loading &&
          posts.map((post) => (
            <div
              key={post.id}
              ref={(el) => { cardRefs.current[post.id] = el }}
              data-post-id={post.id}
              className="h-screen w-full relative flex-shrink-0 snap-start bg-black overflow-hidden"
            >
              {/* MEDIA - full bleed */}
              {post.media_type === "video" ? (
                <video
                  ref={(el) => { videoRefs.current[post.id] = el }}
                  src={post.media_url}
                  className="absolute inset-0 w-full h-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              ) : (
                <img
                  src={post.media_url}
                  className="absolute inset-0 w-full h-full object-cover"
                  alt={post.session_title}
                />
              )}

              {/* Overlay gradient */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90" />

              {/* CHALLENGE BADGE + CATEGORY (top right area) */}
              <div className="absolute top-6 left-4 right-4 z-10 flex items-center justify-between">
                <div
                  className="px-4 py-1 text-xs font-black tracking-widest rounded-full text-white shadow-xl"
                  style={{ background: getTypeGradient(post.session_type) }}
                >
                  {post.session_type.toUpperCase()}
                </div>

                <div className="px-4 py-1 bg-black/60 backdrop-blur-md text-white text-xs font-semibold rounded-full">
                  {post.session_category}
                </div>
              </div>

              {/* BOTTOM CONTENT */}
              <div className="absolute bottom-20 left-4 right-4 z-10">
                <p className="text-zinc-400 text-xs mb-1">
                  {post.user_name} · {post.school} · {timeAgo(post.created_at)}
                </p>

                <p className="text-white font-bold text-[17px] leading-tight mb-6 pr-8">
                  {post.session_title}
                </p>

                <div className="flex gap-3 items-center">
                  {/* TRY IRL Button */}
                  <button
                    onClick={() => handleTryIRL(post)}
                    disabled={tried.includes(post.id)}
                    className={`flex-1 py-4 rounded-full font-bold text-base flex items-center justify-center gap-2 transition-all ${
                      tried.includes(post.id)
                        ? "bg-zinc-800 text-zinc-500"
                        : "bg-gradient-to-r from-violet-600 to-cyan-400 text-white shadow-xl shadow-violet-500/40 active:scale-95"
                    }`}
                  >
                    {tried.includes(post.id) ? (
                      <>✓ Tried IRL</>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                        </svg>
                        TRY IRL
                      </>
                    )}
                  </button>

                  {/* Tried Count */}
                  <div className="flex-shrink-0 bg-zinc-900/90 backdrop-blur-md px-6 py-4 rounded-full flex items-center gap-2 border border-white/10">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <span className="font-bold text-sm text-white">
                      {post.tried_count.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* Bottom Navigation */}
      <div className="flex-shrink-0 z-50 border-t border-zinc-900 bg-black">
        <BottomNav />
      </div>
    </div>
  )
}