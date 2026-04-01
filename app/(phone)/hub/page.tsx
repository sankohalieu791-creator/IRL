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
  session_id: string
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

    if (post.session_id) {
      router.push(`/sessions?session=${post.session_id}`)
    } else {
      router.push("/sessions")
    }
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
      <div style={{ flexShrink: 0 }}>
        <BottomNav />
      </div>
    </div>
  )
}