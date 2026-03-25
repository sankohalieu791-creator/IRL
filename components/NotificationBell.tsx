"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { getUser } from "@/lib/auth"

type Notification = {
  id: string
  title: string
  message: string
  type: string
  read: boolean
  created_at: string
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const USER = getUser() || "Test User"

  useEffect(() => {
    loadNotifications()
  }, [])

  async function loadNotifications() {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_name", USER)
      .order("created_at", { ascending: false })
      .limit(20)

    if (data) setNotifications(data)
    setLoading(false)
  }

  async function markAllRead() {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_name", USER)
      .eq("read", false)

    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  async function markOneRead(id: string) {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id)

    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    )
  }

  function getIcon(type: string) {
    switch (type) {
      case "proof_accepted": return "✅"
      case "proof_declined": return "❌"
      case "new_session": return "⚡"
      case "leaderboard": return "🏆"
      case "group": return "👥"
      case "reward": return "💎"
      default: return "🔔"
    }
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

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen(!open)
          if (!open && unreadCount > 0) markAllRead()
        }}
        className="relative p-2 rounded-full hover:bg-zinc-800 transition-colors"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full text-[9px] font-black text-white flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <h3 className="text-white font-bold text-sm">Notifications</h3>
            {notifications.some(n => !n.read) && (
              <button onClick={markAllRead} className="text-cyan-400 text-xs font-semibold">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <p className="text-zinc-600 text-xs text-center py-6">Loading...</p>
            )}
            {!loading && notifications.length === 0 && (
              <div className="text-center py-8">
                <p className="text-3xl mb-2">🔔</p>
                <p className="text-zinc-600 text-xs">No notifications yet</p>
              </div>
            )}
            {!loading && notifications.map(n => (
              <div
                key={n.id}
                onClick={() => markOneRead(n.id)}
                className={`flex gap-3 px-4 py-3 border-b border-zinc-800/50 cursor-pointer hover:bg-zinc-800/50 transition-colors ${!n.read ? "bg-zinc-800/30" : ""}`}
              >
                <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-base flex-shrink-0">
                  {getIcon(n.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold leading-tight ${!n.read ? "text-white" : "text-zinc-400"}`}>
                    {n.title}
                  </p>
                  <p className="text-zinc-500 text-[11px] mt-0.5 leading-tight">
                    {n.message}
                  </p>
                  <p className="text-zinc-600 text-[10px] mt-1">
                    {timeAgo(n.created_at)}
                  </p>
                </div>
                {!n.read && (
                  <div className="w-2 h-2 bg-cyan-400 rounded-full flex-shrink-0 mt-1" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}
    </div>
  )
}