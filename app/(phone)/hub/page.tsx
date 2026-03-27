"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getUser } from "@/lib/auth"
import BottomNav from "@/components/BottomNav"

const USER = getUser() || "Test User"
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
  const [posts, setPosts] = useState<HubPost[]>([])
  const [filter, setFilter] = useState<Filter>("All")
  const [tried, setTried] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [mutedPosts, setMutedPosts] = useState<{ [key: string]: boolean }>({})
  const [currentVisible, setCurrentVisible] = useState<string | null>(null)
  const [showMusicPicker, setShowMusicPicker] = useState(false)
  const [tracks, setTracks] = useState<Track[]>([])
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null)
  const [musicSearch, setMusicSearch] = useState("")
  const [musicLoading, setMusicLoading] = useState(false)
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({})
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const cardRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  useEffect(() => {
    loadPosts()
    loadTried()
  }, [filter])

  useEffect(() => {
    // Set up intersection observer to detect which card is visible
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const postId = entry.target.getAttribute("data-post-id")
          if (!postId) return

          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            setCurrentVisible(postId)
            // Play video when visible
            const video = videoRefs.current[postId]
            if (video) {
              video.play().catch(() => {})
            }
          } else {
            // Pause and mute video when not visible
            const video = videoRefs.current[postId]
            if (video) {
              video.pause()
              video.muted = true
              setMutedPosts(prev => ({ ...prev, [postId]: true }))
            }
          }
        })
      },
      { threshold: 0.5 }
    )

    return () => observerRef.current?.disconnect()
  }, [])

  useEffect(() => {
    // Observe all cards
    Object.entries(cardRefs.current).forEach(([postId, el]) => {
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

    if (filter !== "All") {
      query = query.eq("session_type", filter)
    }

    const { data } = await query
    if (data) setPosts(data)
    setLoading(false)
  }

  async function loadTried() {
    const { data } = await supabase
      .from("hub_tries")
      .select("hub_post_id")
      .eq("user_name", USER)

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
    if (audioRef.current) {
      audioRef.current.pause()
    }
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

    await supabase.from("hub_tries").insert({
      hub_post_id: post.id,
      user_name: USER
    })

    await supabase
      .from("hub_posts")
      .update({ tried_count: post.tried_count + 1 })
      .eq("id", post.id)

    setTried(prev => [...prev, post.id])
    setPosts(prev =>
      prev.map(p =>
        p.id === post.id ? { ...p, tried_count: p.tried_count + 1 } : p
      )
    )

    router.push("/sessions")
  }

  function toggleMute(postId: string) {
    const video = videoRefs.current[postId]
    if (video) {
      video.muted = !video.muted
      setMutedPosts(prev => ({ ...prev, [postId]: video.muted }))
    }
  }

  function isMuted(postId: string) {
    return mutedPosts[postId] !== false
  }

  function getTypeColor(type: string) {
    if (type === "Challenge") return "bg-blue-600"
    if (type === "Activity") return "bg-pink-600"
    return "bg-purple-600"
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  const filters: Filter[] = ["All", "Challenge", "Activity", "Quest"]

  return (
    <div className="flex flex-col bg-black overflow-hidden" style={{ height: "100%" }}>

      {/* FEED */}
      <div className="flex-1 overflow-hidden relative" style={{ minHeight: 0 }}>

        {/* FLOATING HEADER */}
        <div
          className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-3 pb-2"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)" }}
        >
          <h1 className="text-2xl font-bold text-white" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.8)" }}>
            Hub
          </h1>
          <div className="flex items-center gap-2">
            {/* Music button */}
            <button
              onClick={() => {
                setShowMusicPicker(true)
                searchMusic("motivational")
              }}
              className="bg-black/50 border border-white/20 rounded-full px-3 py-1 text-white text-xs flex items-center gap-1"
            >
              🎵 {selectedTrack ? selectedTrack.title.slice(0, 10) + "..." : "Music"}
            </button>
            {selectedTrack && (
              <button onClick={stopMusic} className="bg-red-500/30 border border-red-400/40 rounded-full px-2 py-1 text-red-400 text-xs">
                Stop
              </button>
            )}
            {/* Filters */}
            <div className="flex gap-1">
              {filters.map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                    filter === f ? "bg-cyan-400 text-black" : "bg-black/50 text-white border border-white/20"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* MUSIC PICKER */}
        {showMusicPicker && (
          <div className="absolute inset-0 z-50 bg-black/95 flex flex-col">
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-zinc-800">
              <h2 className="text-white font-bold">Choose Music</h2>
              <button onClick={() => setShowMusicPicker(false)} className="text-zinc-400 text-sm">Close</button>
            </div>
            <div className="px-4 py-3">
              <input
                type="text"
                placeholder="Search music..."
                value={musicSearch}
                onChange={e => {
                  setMusicSearch(e.target.value)
                  if (e.target.value.length > 2) searchMusic(e.target.value)
                }}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-400 placeholder:text-zinc-600"
              />
            </div>
            <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-4">
              {musicLoading && (
                <p className="text-zinc-500 text-sm text-center py-8">Searching...</p>
              )}
              {!musicLoading && tracks.map(track => (
                <div
                  key={track.id}
                  className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3"
                >
                  <div>
                    <p className="text-white text-sm font-semibold">{track.title}</p>
                    <p className="text-zinc-500 text-xs">{track.artist}</p>
                  </div>
                  <button
                    onClick={() => playTrack(track)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-black"
                    style={{ background: "linear-gradient(to right, #B400FF, #00D4FF)" }}
                  >
                    Play
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SCROLL CONTAINER */}
        <div
          style={{
            height: "100%",
            overflowY: "scroll",
            scrollSnapType: "y mandatory",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {loading && (
            <div className="flex items-center justify-center bg-black" style={{ height: "100%" }}>
              <p className="text-zinc-600 text-sm">Loading Hub...</p>
            </div>
          )}

          {!loading && posts.length === 0 && (
            <div className="flex flex-col items-center justify-center px-8 text-center bg-black" style={{ height: "100%" }}>
              <p className="text-5xl mb-4">🌍</p>
              <p className="text-white font-bold text-lg mb-2">Hub is empty</p>
              <p className="text-zinc-500 text-sm mb-6">Complete a session and share it to the Hub to be first!</p>
              <button
                onClick={() => router.push("/sessions")}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-cyan-400 rounded-xl text-sm font-bold text-white"
              >
                ⚡ Go Complete a Session
              </button>
            </div>
          )}

          {!loading && posts.map((post) => (
            <div
              key={post.id}
              ref={el => { cardRefs.current[post.id] = el }}
              data-post-id={post.id}
              style={{
                height: "100%",
                scrollSnapAlign: "start",
                scrollSnapStop: "always",
                position: "relative",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              {/* MEDIA */}
              {post.media_type === "video" ? (
                <>
                  <video
                    ref={el => { videoRefs.current[post.id] = el }}
                    src={post.media_url}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      background: "#000"
                    }}
                    autoPlay
                    loop
                    muted={isMuted(post.id)}
                    playsInline
                  />
                  {/* Mute button */}
                  <button
                    onClick={() => toggleMute(post.id)}
                    className="absolute top-20 right-4 z-20 bg-black/50 border border-white/20 rounded-full p-2.5 backdrop-blur-sm"
                  >
                    {!isMuted(post.id) ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="white"/>
                        <line x1="23" y1="9" x2="17" y2="15" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                        <line x1="17" y1="9" x2="23" y2="15" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    )}
                  </button>
                </>
              ) : (
                <img
                  src={post.media_url}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    background: "#000"
                  }}
                />
              )}

              {/* Gradient overlay */}
              <div style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.2) 40%, transparent 70%, rgba(0,0,0,0.4) 100%)",
                zIndex: 1
              }} />

              {/* Type badge */}
              <div style={{ position: "absolute", top: 52, left: 16, zIndex: 10 }}>
                <span className={`${getTypeColor(post.session_type)} text-white text-[11px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wide`}>
                  {post.session_type}
                </span>
              </div>

              {/* Category badge */}
              <div style={{ position: "absolute", top: 52, right: 16, zIndex: 10 }}>
                <span className="text-white text-[11px] font-semibold px-3 py-1.5 rounded-full border border-white/20" style={{ background: "rgba(0,0,0,0.6)" }}>
                  {post.session_category}
                </span>
              </div>

              {/* Bottom content */}
              <div style={{ position: "absolute", bottom: 80, left: 16, right: 16, zIndex: 10 }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 flex items-center justify-center text-xs font-black text-white border-2 border-white/20 flex-shrink-0">
                    {post.user_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white text-xs font-bold leading-tight">{post.user_name}</p>
                    <p className="text-zinc-400 text-[10px] leading-tight">{post.school} · {timeAgo(post.created_at)}</p>
                  </div>
                </div>

                <p className="text-white font-black text-lg leading-tight mb-4">{post.session_title}</p>

                {/* Try IRL + Tried */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTryIRL(post)}
                    disabled={tried.includes(post.id)}
                    className="flex-1 py-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2 transition-all active:scale-95"
                    style={tried.includes(post.id) ? {
                      background: "#27272a",
                      color: "#71717a"
                    } : {
                      background: "linear-gradient(to right, #00D4FF, #00BB77)",
                      boxShadow: "0 4px 20px rgba(0,212,255,0.4)",
                      color: "#000"
                    }}
                  >
                    {tried.includes(post.id) ? (
                      <>✓ Tried IRL</>
                    ) : (
                      <>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="black">
                          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                        </svg>
                        TRY IRL
                      </>
                    )}
                  </button>

                  <div
                    className="rounded-2xl px-4 py-3 flex items-center gap-1.5 flex-shrink-0"
                    style={{ background: "rgba(0,0,0,0.65)", border: "1px solid rgba(255,255,255,0.15)" }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    <span className="text-white text-xs font-bold">{post.tried_count.toLocaleString()} Tried</span>
                  </div>
                </div>
              </div>

            </div>
          ))}
        </div>
      </div>

      <div className="flex-shrink-0">
        <BottomNav />
      </div>

    </div>
  )
}