"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import BottomNav from "@/components/BottomNav"
import { getUser } from "@/lib/auth"

const USER = getUser() || "Test User"
export default function Leaderboard() {
  const router = useRouter()
  const [users, setUsers] = useState<any[]>([])

  useEffect(() => {
    loadLeaderboard()
  }, [])

  async function loadLeaderboard() {
    const { data } = await supabase
      .from("leaderboard")
      .select("*")
      .order("points", { ascending: false })
      .limit(20)

    if (data) setUsers(data)
  }

  const medals = ["🥇", "🥈", "🥉"]

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex flex-col flex-1 overflow-y-auto pb-16 text-white p-6 space-y-4">

        <button
          onClick={() => router.push("/sessions")}
          className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm w-fit"
        >
          ← Back to Sessions
        </button>

        <h1 className="text-2xl font-bold text-cyan-400">Leaderboard</h1>

        {users.map((u, i) => (
          <div
            key={`${u.user_name}-${i}`}
            className={`rounded-xl p-4 flex justify-between items-center border ${
              i === 0 ? "bg-yellow-500/10 border-yellow-500/40" :
              i === 1 ? "bg-zinc-400/10 border-zinc-400/40" :
              i === 2 ? "bg-orange-500/10 border-orange-500/40" :
              "bg-zinc-900 border-zinc-800"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg w-7">
                {i < 3 ? medals[i] : `${i + 1}.`}
              </span>
              <div>
                <p className="font-semibold text-sm">{u.user_name}</p>
                {u.school && (
                  <p className="text-zinc-500 text-xs">{u.school}</p>
                )}
              </div>
            </div>
            <span className="text-cyan-400 font-bold">{u.points} LP</span>
          </div>
        ))}

      </main>
      <BottomNav />
    </div>
  )
}