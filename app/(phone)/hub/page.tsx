"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getUser } from "@/lib/auth"
import BottomNav from "@/components/BottomNav"

const PIXABAY_KEY = "55201448-489576e0e650dc45c42b8d3ff"

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

type Track = {
  id: number
  title: string
  audio: string
  artist: string
}

export default function Hub() {
  const router = useRouter()
  const [user, setUser] = useState("")
  const [posts, setPosts] = useState<HubPost[]>([])
  const [filter, setFilter] = useState<Filter>("All")
  const [tried, setTried] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [mutedPosts, setMutedPosts] = useState<{ [key: string]: boolean }>({})
  const [showMusicPicker, setShowMusicPicker] = useState(false)
  const [tracks, setTracks] = useState<Track[]>([])
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null)
  const [musicSearch, setMusicSearch] = useState("")
  const [musicLoading, setMusicLoading] = useState(false)
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({})
  const audioRef = useRef<HTMLAudioElement | null>(null)
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
        entries.forEach(entry => {
          const postId = entry.target.getAttribute("data-post-id")
          if (!postId) return
          const video = videoRefs.current[postId]
          if (entry.isIntersecting && entry.intersectionRatio > 0.7) {
            if (video) video.play().catch(() => {})
          } else {
            if (video) {
              video.pause()
              video.muted = true
              setMutedPosts(prev => ({ ...prev, [postId]: true }))
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

  async function searchMusic(query: string) {
    setMusicLoading(true)
    try {
      const res = await fetch(
        `https://pixabay.com/api/music/?key=${PIXABAY_KEY}&q=${encodeURIComponent(query)}&per_page=10`
      )
      const data = await res.json()
      if (data.hits) {
        setTracks(data.hits.map((h: any) => ({
          id: h.id,
          title: h.title,
          audio: h.audio,
          artist: h.user
        })))
      }
    } catch (e) {
      console.error("Music search failed:", e)
    }
    setMusicLoading(false)
  }

  function playTrack(track: Track) {
    if (audioRef.current) audioRef.current.pause()
    audioRef.current = new Audio(track.audio)
    audioRef.current.loop = true
    audioRef.current.volume = 0.5
    audioRef.current.play()
    setSelectedTrack(track)
    setShowMusicPicker(false)
  }

  function stopMusic() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setSelectedTrack(null)
  }

  async function handleTryIRL(post: HubPost) {
    if (tried.includes(post.id)) return
    await supabase.from("hub_tries").insert({ hub_post_id: post.id, user_name: user })
    await supabase.from("hub_posts").update({ tried_count: post.tried_count + 1 }).eq("id", post.id)
    setTried(prev => [...prev, post.id])
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, tried_count: p.tried_count + 1 } : p))
    router.push("/sessions")
  }

  function toggleMute(postId: string) {
    const video = videoRefs.current[postId]
    if (video) {
      video.muted = !video.muted
      setMutedPosts(prev => ({ ...prev, [postId]: video.muted }))
    }
  }

  function getTypeGradient(type: string) {
    if (type === "Challenge") return "linear-gradient(135deg, #7c3aed, #B400FF)"
    if (type === "Activity") return "linear-gradient(135deg, #be185d, #ec4899)"
    return "linear-gradient(135deg, #1d4ed8, #3b82f6)"
  }

  const filters: Filter[] = ["All", "Challenge", "Activity", "Quest"]

  return (
    <div className="w-full h-screen bg-black flex flex-col overflow-hidden">
      {/* Header with filters */}
      <div className="flex-shrink-0 px-4 pt-4 pb-4 border-b border-zinc-800">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-cyan-400">Hub</h1>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full whitespace-nowrap font-semibold transition-all text-sm ${
                filter === f
                  ? "bg-cyan-400 text-black"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Main content area with padding to avoid bottom nav overlap */}
      <div className="flex-1 overflow-y-auto pb-24">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-zinc-500">Loading...</div>
          </div>
        ) : posts.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-zinc-500">No posts found</div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-4">
            {posts.map(post => (
              <div
                key={post.id}
                ref={el => { if (el) cardRefs.current[post.id] = el }}
                data-post-id={post.id}
                className="relative w-full aspect-video rounded-2xl overflow-hidden bg-zinc-900 flex-shrink-0"
              >
                {/* Media background */}
                {post.media_type === "video" ? (
                  <video
                    ref={el => { if (el) videoRefs.current[post.id] = el }}
                    src={post.media_url}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                  />
                ) : (
                  <img
                    src={post.media_url}
                    alt={post.session_title}
                    className="w-full h-full object-cover"
                  />
                )}

                {/* Dark overlay gradient for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />

                {/* Type badge - top right */}
                <div className="absolute top-3 right-3 z-20">
                  <span
                    className="px-3 py-1.5 rounded-full text-xs font-semibold text-white"
                    style={{ background: getTypeGradient(post.session_type) }}
                  >
                    {post.session_category}
                  </span>
                </div>

                {/* Mute button - top right corner */}
                {post.media_type === "video" && (
                  <button
                    onClick={() => toggleMute(post.id)}
                    className="absolute top-3 right-16 z-20 bg-black/50 hover:bg-black/70 rounded-full p-2 transition-all"
                  >
                    {mutedPosts[post.id] ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                        <path d="M11 5L6 9H2v6h4l5 5v-16z" />
                        <line x1="23" y1="9" x2="17" y2="15" />
                        <line x1="17" y1="9" x2="23" y2="15" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                      </svg>
                    )}
                  </button>
                )}

                {/* Content area - BOTTOM LEFT positioning */}
                <div className="absolute bottom-0 left-0 right-0 p-4 z-20 flex flex-col justify-end h-full">
                  {/* Quest title at bottom left */}
                  <div className="mb-12">
                    <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight max-w-xs">
                      {post.session_title}
                    </h2>
                  </div>

                  {/* Action buttons and stats at the very bottom */}
                  <div className="flex gap-3 items-center">
                    {!tried.includes(post.id) ? (
                      <button
                        onClick={() => handleTryIRL(post)}
                        className="px-6 py-2.5 rounded-full bg-gradient-to-r from-cyan-400 to-blue-400 text-black font-bold text-sm hover:shadow-lg hover:shadow-cyan-400/50 transition-all"
                      >
                        TRY IRL
                      </button>
                    ) : (
                      <span className="text-cyan-400 font-bold text-sm">✓ Tried</span>
                    )}

                    {/* Tried count badge */}
                    <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-3 py-2 rounded-full">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      <span className="text-white font-semibold text-xs">
                        {post.tried_count.toLocaleString()} Tried
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom navigation - fixed at bottom */}
      <BottomNav />
    </div>
  )
}