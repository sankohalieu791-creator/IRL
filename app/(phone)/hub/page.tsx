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
    if (!currentUser) router.replace("/")
    else setUser(currentUser)
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

  function getTypeColor(type: string) {
    if (type === "Challenge") return "#1d4ed8"
    if (type === "Activity") return "#be185d"
    return "#7c3aed"
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
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#000", overflow: "hidden" }}>
      <div style={{ flex: 1, overflow: "hidden", position: "relative", minHeight: 0 }}>
        <div style={{ height: "100%", overflowY: "scroll", scrollSnapType: "y mandatory", WebkitOverflowScrolling: "touch" as any }}>
          {!loading && posts.map((post) => (
            <div key={post.id} ref={el => { cardRefs.current[post.id] = el }} data-post-id={post.id} style={{ height: "100%", scrollSnapAlign: "start", position: "relative", overflow: "hidden", background: "#000" }}>
              {post.media_type === "video" ? (
                <video ref={el => { videoRefs.current[post.id] = el }} src={post.media_url} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} autoPlay loop muted playsInline />
              ) : (
                <img src={post.media_url} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
              )}
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