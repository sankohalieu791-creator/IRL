"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getUser, getSchool, logout } from "@/lib/auth"
import BottomNav from "@/components/BottomNav"

const USER = getUser() || "Test User"
const SCHOOL = getSchool() || "Test School"

type HubPost = {
  id: string
  session_title: string
  session_type: string
  media_url: string
  media_type: string
  tried_count: number
  created_at: string
}

export default function Profile() {
  const router = useRouter()
  const [points, setPoints] = useState(0)
  const [sessionCount, setSessionCount] = useState(0)
  const [rewardCount, setRewardCount] = useState(0)
  const [hubPosts, setHubPosts] = useState<HubPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProfile()
    loadHubPosts()

    const interval = setInterval(() => {
      loadProfile()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  async function loadProfile() {
    const { data: lb } = await supabase
      .from("leaderboard")
      .select("points")
      .eq("user_name", USER)
      .maybeSingle()

    if (lb) setPoints(lb.points)

    const { count: sessions } = await supabase
      .from("session_attempts")
      .select("*", { count: "exact", head: true })
      .eq("user_name", USER)
      .eq("status", "accepted")

    if (sessions) setSessionCount(sessions)

    const { count: rewards } = await supabase
      .from("user_rewards")
      .select("*", { count: "exact", head: true })
      .eq("user_name", USER)

    if (rewards) setRewardCount(rewards)

    setLoading(false)
  }

  async function loadHubPosts() {
    const { data } = await supabase
      .from("hub_posts")
      .select("*")
      .eq("user_name", USER)
      .order("created_at", { ascending: false })

    if (data) setHubPosts(data)
  }

  async function deleteHubPost(id: string) {
    await supabase.from("hub_posts").delete().eq("id", id)
    setHubPosts(prev => prev.filter(p => p.id !== id))
    alert("Post deleted!")
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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <main className="flex flex-col flex-1 overflow-y-auto pb-16 text-white">

        {/* HEADER */}
        <div className="p-6 pb-4">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 flex items-center justify-center text-2xl font-black text-white">
              {USER.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-black text-white">{USER}</h1>
              <p className="text-zinc-500 text-sm">{SCHOOL}</p>
            </div>
          </div>

          {/* STATS */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-center">
              <p className="text-cyan-400 font-black text-xl">{points}</p>
              <p className="text-zinc-500 text-[10px] mt-0.5">Total LP</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-center">
              <p className="text-white font-black text-xl">{sessionCount}</p>
              <p className="text-zinc-500 text-[10px] mt-0.5">Sessions</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-center">
              <p className="text-white font-black text-xl">{rewardCount}</p>
              <p className="text-zinc-500 text-[10px] mt-0.5">Rewards</p>
            </div>
          </div>

          {/* LOGOUT */}
          <button
            onClick={() => { logout(); router.push("/login") }}
            className="w-full py-2.5 border border-red-400/30 text-red-400 rounded-xl text-sm font-semibold hover:bg-red-400/10 transition-colors"
          >
            Log Out
          </button>
        </div>

        {/* DIVIDER */}
        <div className="h-px bg-zinc-800 mx-4" />

        {/* MY POSTS */}
        <div className="p-4">
          <h2 className="text-white font-bold text-base mb-4">My Hub Posts</h2>

          {loading && (
            <p className="text-zinc-600 text-sm text-center py-8">Loading...</p>
          )}

          {!loading && hubPosts.length === 0 && (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">🌍</p>
              <p className="text-zinc-600 text-sm">No posts yet</p>
              <p className="text-zinc-700 text-xs mt-1">Complete a session and share it to the Hub</p>
            </div>
          )}

          <div className="space-y-3">
            {hubPosts.map(post => (
              <div key={post.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="relative h-40">
                  {post.media_type === "video" ? (
                    <video
                      src={post.media_url}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      src={post.media_url}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute top-2 left-2">
                    <span className={`${getTypeColor(post.session_type)} text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase`}>
                      {post.session_type}
                    </span>
                  </div>
                </div>

                <div className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-bold">{post.session_title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-zinc-500 text-[11px]">{timeAgo(post.created_at)}</p>
                      <p className="text-zinc-600 text-[11px]">·</p>
                      <p className="text-zinc-500 text-[11px]">👥 {post.tried_count} tried</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm("Delete this post?")) {
                        deleteHubPost(post.id)
                      }
                    }}
                    className="text-red-400 text-xs border border-red-400/30 px-3 py-1.5 rounded-xl hover:bg-red-400/10 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>
      <BottomNav />
    </div>
  )
}