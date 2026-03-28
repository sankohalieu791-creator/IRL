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
      overflow: "hidden"
    }}>
      {showMusicPicker && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 100,
          background: "rgba(0,0,0,0.97)",
          display: "flex", flexDirection: "column"
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "center", padding: "16px",
            borderBottom: "1px solid rgba(255,255,255,0.1)"
          }}>
            <p style={{ color: "white", fontWeight: 700, fontSize: 16 }}>🎵 Choose Music</p>
            <button
              onClick={() => setShowMusicPicker(false)}
              style={{ color: "#71717a", fontSize: 13, background: "none", border: "none", cursor: "pointer" }}
            >
              Close
            </button>
          </div>
          <div style={{ padding: "12px 16px" }}>
            <input
              type="text"
              placeholder="Search music..."
              value={musicSearch}
              onChange={e => {
                setMusicSearch(e.target.value)
                if (e.target.value.length > 2) searchMusic(e.target.value)
              }}
              style={{
                width: "100%", background: "#18181b",
                border: "1px solid #3f3f46", borderRadius: 12,
                padding: "10px 16px", color: "white",
                fontSize: 13, outline: "none", boxSizing: "border-box" as any
              }}
            />
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px" }}>
            {musicLoading && (
              <p style={{ color: "#71717a", textAlign: "center", padding: 32, fontSize: 13 }}>
                Searching...
              </p>
            )}
            {!musicLoading && tracks.map(track => (
              <div key={track.id} style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", background: "#18181b",
                border: "1px solid #27272a", borderRadius: 12,
                padding: "12px 16px", marginBottom: 8
              }}>
                <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                  <p style={{
                    color: "white", fontSize: 13, fontWeight: 600,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                  }}>
                    {track.title}
                  </p>
                  <p style={{ color: "#71717a", fontSize: 11 }}>{track.artist}</p>
                </div>
                <button
                  onClick={() => playTrack(track)}
                  style={{
                    background: "linear-gradient(to right, #B400FF, #00D4FF)",
                    color: "white", border: "none", borderRadius: 8,
                    padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer"
                  }}
                >
                  Play
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{
        flexShrink: 0,
        padding: "12px 16px 8px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "#000",
        zIndex: 20
      }}>
        <span style={{
          color: "#00D4FF",
          fontWeight: 800,
          fontSize: 20,
          letterSpacing: -0.5,
          flexShrink: 0
        }}>
          Hub
        </span>

        <div style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          flex: 1,
          scrollbarWidth: "none" as any
        }}>
          {filters.map(f => (
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
                  : "#27272a",
                color: filter === f ? "white" : "#a1a1aa",
                boxShadow: filter === f ? "0 2px 12px rgba(180,0,255,0.4)" : "none"
              }}
            >
              {f}
            </button>
          ))}
          <button
            onClick={() => { setShowMusicPicker(true); searchMusic("motivational") }}
            style={{
              padding: "6px 12px",
              borderRadius: 100,
              fontSize: 12,
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              flexShrink: 0,
              background: selectedTrack ? "rgba(180,0,255,0.3)" : "#27272a",
              color: "white"
            }}
          >
            🎵
          </button>
          {selectedTrack && (
            <button
              onClick={stopMusic}
              style={{
                padding: "6px 10px", borderRadius: 100, fontSize: 11,
                fontWeight: 700, border: "none", cursor: "pointer",
                background: "rgba(255,0,0,0.2)", color: "#f87171", flexShrink: 0
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          overflowY: "scroll",
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch" as any,
          paddingBottom: "200px"
        }}>
          {loading && (
            <div style={{
              height: "100%", display: "flex",
              alignItems: "center", justifyContent: "center"
            }}>
              <p style={{ color: "#52525b", fontSize: 13 }}>Loading Hub...</p>
            </div>
          )}

          {!loading && posts.length === 0 && (
            <div style={{
              height: "100%", display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              padding: "0 32px", textAlign: "center"
            }}>
              <p style={{ fontSize: 48, marginBottom: 16 }}>🌍</p>
              <p style={{ color: "white", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
                Hub is empty
              </p>
              <p style={{ color: "#52525b", fontSize: 13, marginBottom: 24 }}>
                Complete a session and share it to the Hub to be first!
              </p>
              <button
                onClick={() => router.push("/sessions")}
                style={{
                  padding: "12px 24px",
                  background: "linear-gradient(to right, #B400FF, #00D4FF)",
                  borderRadius: 12, color: "white", fontWeight: 700,
                  fontSize: 13, border: "none", cursor: "pointer"
                }}
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
                display: "block",
                background: "#000",
                padding: "0"
              }}
            >
              <div style={{
                position: "relative",
                height: "100%",
                borderRadius: 0,
                overflow: "hidden",
                background: "#111"
              }}>
                {post.media_type === "video" ? (
                  <video
                    ref={el => { videoRefs.current[post.id] = el }}
                    src={post.media_url}
                    style={{
                      position: "absolute", inset: 0,
                      width: "100%", height: "100%",
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
                      position: "absolute", inset: 0,
                      width: "100%", height: "100%",
                      objectFit: "cover"
                    }}
                  />
                )}

                <div style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.1) 70%, transparent 100%)",
                  zIndex: 1
                }} />

                <div style={{
                  position: "absolute", top: 14, left: 14, right: 14,
                  zIndex: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8
                }}>
                  <span style={{
                    background: getTypeGradient(post.session_type),
                    color: "white", fontSize: 10, fontWeight: 800,
                    padding: "5px 12px", borderRadius: 100,
                    textTransform: "uppercase" as any, letterSpacing: 1,
                    flexShrink: 0,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.4)"
                  }}>
                    {post.session_type}
                  </span>

                  <span style={{
                    background: "rgba(50,50,50,0.85)",
                    color: "white", fontSize: 10, fontWeight: 600,
                    padding: "5px 10px", borderRadius: 100,
                    flexShrink: 0,
                    backdropFilter: "blur(4px)"
                  }}>
                    {post.session_category}
                  </span>
                </div>

                {post.media_type === "video" && (
                  <button
                    onClick={() => toggleMute(post.id)}
                    style={{
                      position: "absolute", top: 56, right: 14, zIndex: 10,
                      background: "rgba(0,0,0,0.5)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      borderRadius: "50%", width: 30, height: 30,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer"
                    }}
                  >
                    {mutedPosts[post.id] !== false ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="white"/>
                        <line x1="23" y1="9" x2="17" y2="15" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                        <line x1="17" y1="9" x2="23" y2="15" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
                      </svg>
                    )}
                  </button>
                )}

                <div style={{
                  position: "absolute", bottom: 14, left: 14, right: 14,
                  zIndex: 10
                }}>
                  <h2 style={{
                    color: "white", fontWeight: 800, fontSize: 18,
                    marginBottom: 12,
                    textShadow: "0 1px 6px rgba(0,0,0,1)"
                  }}>
                    {post.session_title}
                  </h2>

                  <p style={{
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 11, marginBottom: 6
                  }}>
                    {post.user_name} · {post.school} · {timeAgo(post.created_at)}
                  </p>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      onClick={() => handleTryIRL(post)}
                      disabled={tried.includes(post.id)}
                      style={{
                        flex: "0 0 65%",
                        padding: "12px 0",
                        borderRadius: 100,
                        fontSize: 14,
                        fontWeight: 800,
                        border: "none",
                        cursor: tried.includes(post.id) ? "default" : "pointer",
                        display: "flex", alignItems: "center",
                        justifyContent: "center", gap: 6,
                        background: tried.includes(post.id)
                          ? "#27272a"
                          : "linear-gradient(135deg, #B400FF, #00D4FF)",
                        color: tried.includes(post.id) ? "#71717a" : "white",
                        boxShadow: tried.includes(post.id)
                          ? "none"
                          : "0 4px 20px rgba(180,0,255,0.4)"
                      }}
                    >
                      {tried.includes(post.id) ? "✓ Tried IRL" : (
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
                      borderRadius: 100,
                      padding: "12px 0",
                      display: "flex", alignItems: "center",
                      justifyContent: "center", gap: 5
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
            </div>
          ))}

        </div>
      </div>

      <div style={{ flexShrink: 0 }}>
        <BottomNav />
      </div>

    </div>
  )
}