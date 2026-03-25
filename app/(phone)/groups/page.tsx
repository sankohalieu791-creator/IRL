"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import BottomNav from "@/components/BottomNav"
import { getUser } from "@/lib/auth"

const USER = getUser() || "Test User"


type Group = {
  id: string
  name: string
  description: string
  institution: string
  total_lp: number
  member_count?: number
}

type Member = {
  user_name: string
  status: string
  joined_at: string
}

export default function Groups() {
  const router = useRouter()
  const [groups, setGroups] = useState<Group[]>([])
  const [myMemberships, setMyMemberships] = useState<Record<string, string>>({})
  const [activeGroup, setActiveGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [groupLeaderboard, setGroupLeaderboard] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadGroups()
    loadMyMemberships()
  }, [])

  async function loadGroups() {
    const { data } = await supabase
      .from("groups")
      .select("*")
      .order("total_lp", { ascending: false })

    if (!data) return

    // Get member counts
    const groupsWithCounts = await Promise.all(
      data.map(async (g) => {
        const { count } = await supabase
          .from("group_members")
          .select("*", { count: "exact", head: true })
          .eq("group_id", g.id)
          .eq("status", "accepted")
        return { ...g, member_count: count || 0 }
      })
    )
    setGroups(groupsWithCounts)
  }

  async function loadMyMemberships() {
    const { data } = await supabase
      .from("group_members")
      .select("group_id, status")
      .eq("user_name", USER)

    if (!data) return
    const map: Record<string, string> = {}
    data.forEach(m => { map[m.group_id] = m.status })
    setMyMemberships(map)
  }

  async function requestJoin(groupId: string) {
    setLoading(true)
    const { error } = await supabase
      .from("group_members")
      .insert({
        group_id: groupId,
        user_name: USER,
        status: "pending"
      })

    if (error) {
      alert(`Error: ${error.message}`)
    } else {
      setMyMemberships(prev => ({ ...prev, [groupId]: "pending" }))
    }
    setLoading(false)
  }

  async function openGroup(group: Group) {
    setActiveGroup(group)
    loadMembers(group.id)
    loadGroupLeaderboard(group.id)
  }

  async function loadMembers(groupId: string) {
    const { data } = await supabase
      .from("group_members")
      .select("user_name, status, joined_at")
      .eq("group_id", groupId)
      .eq("status", "accepted")
      .order("joined_at", { ascending: true })

    if (data) setMembers(data)
  }

  async function loadGroupLeaderboard(groupId: string) {
    // Get accepted members
    const { data: memberData } = await supabase
      .from("group_members")
      .select("user_name")
      .eq("group_id", groupId)
      .eq("status", "accepted")

    if (!memberData) return

    const usernames = memberData.map(m => m.user_name)

    // Get their points from leaderboard
    const { data: pointsData } = await supabase
      .from("leaderboard")
      .select("user_name, points, school")
      .in("user_name", usernames)
      .order("points", { ascending: false })

    if (pointsData) setGroupLeaderboard(pointsData)
  }

  const medals = ["🥇", "🥈", "🥉"]

  // GROUP DETAIL VIEW
  if (activeGroup) {
    const totalLP = groupLeaderboard.reduce((sum, u) => sum + u.points, 0)

    return (
      <div className="flex flex-col min-h-screen">
        <main className="flex flex-col flex-1 overflow-y-auto pb-16 text-white">

          {/* HEADER */}
          <div className="p-4 pb-2">
            <button
              onClick={() => setActiveGroup(null)}
              className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm mb-3"
            >
              ← Back to Groups
            </button>
            <h1 className="text-2xl font-bold text-cyan-400">
              {activeGroup.name}
            </h1>
            {activeGroup.institution && (
              <p className="text-zinc-500 text-xs mt-0.5">
                {activeGroup.institution}
              </p>
            )}
            {activeGroup.description && (
              <p className="text-zinc-400 text-sm mt-1">
                {activeGroup.description}
              </p>
            )}
          </div>

          {/* TOTAL LP CARD */}
          <div className="mx-4 mb-4 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-cyan-500/30 rounded-2xl p-4 flex justify-between items-center">
            <div>
              <p className="text-zinc-400 text-xs">Group Total LP</p>
              <p className="text-3xl font-bold text-cyan-400">{totalLP} LP</p>
            </div>
            <div>
              <p className="text-zinc-400 text-xs">Members</p>
              <p className="text-2xl font-bold text-white">{members.length}</p>
            </div>
          </div>

          {/* GROUP LEADERBOARD */}
          <div className="px-4 mb-4">
            <h2 className="text-sm font-bold text-zinc-300 mb-3 uppercase tracking-wider">
              Group Leaderboard
            </h2>
            <div className="space-y-2">
              {groupLeaderboard.map((u, i) => (
                <div
                  key={`${u.user_name}-${i}`}
                  className={`rounded-xl p-3 flex justify-between items-center border ${
                    i === 0 ? "bg-yellow-500/10 border-yellow-500/40" :
                    i === 1 ? "bg-zinc-400/10 border-zinc-400/40" :
                    i === 2 ? "bg-orange-500/10 border-orange-500/40" :
                    "bg-zinc-900 border-zinc-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base w-6">
                      {i < 3 ? medals[i] : `${i + 1}.`}
                    </span>
                    <div>
                      <p className="font-semibold text-sm">{u.user_name}</p>
                      {u.school && (
                        <p className="text-zinc-500 text-xs">{u.school}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-cyan-400 font-bold text-sm">
                    {u.points} LP
                  </span>
                </div>
              ))}
              {groupLeaderboard.length === 0 && (
                <p className="text-zinc-500 text-sm text-center py-4">
                  No members yet
                </p>
              )}
            </div>
          </div>

          {/* MEMBERS LIST */}
          <div className="px-4">
            <h2 className="text-sm font-bold text-zinc-300 mb-3 uppercase tracking-wider">
              Members
            </h2>
            <div className="space-y-2">
              {members.map((m, i) => (
                <div
                  key={`${m.user_name}-${i}`}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 flex items-center justify-center text-xs font-bold">
                    {m.user_name.charAt(0).toUpperCase()}
                  </div>
                  <p className="font-semibold text-sm">{m.user_name}</p>
                  {m.user_name === USER && (
                    <span className="ml-auto text-cyan-400 text-xs">You</span>
                  )}
                </div>
              ))}
              {members.length === 0 && (
                <p className="text-zinc-500 text-sm text-center py-4">
                  No members yet
                </p>
              )}
            </div>
          </div>

        </main>
        <BottomNav />
      </div>
    )
  }

  // GROUPS LIST VIEW
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex flex-col flex-1 overflow-y-auto pb-16 text-white">

        {/* HEADER */}
        <div className="p-4 pb-2">
          <button
            onClick={() => router.push("/sessions")}
            className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm mb-3"
          >
            ← Back to Sessions
          </button>
          <h1 className="text-2xl font-bold text-cyan-400">Groups</h1>
          <p className="text-zinc-500 text-xs mt-0.5">
            Join a group to compete with your institution
          </p>
        </div>

        {/* GROUPS LIST */}
        <div className="p-4 space-y-4">
          {groups.length === 0 && (
            <p className="text-zinc-500 text-sm text-center py-8">
              No groups yet — ask your institution to create one
            </p>
          )}

          {groups.map((group) => {
            const memberStatus = myMemberships[group.id]
            const isMember = memberStatus === "accepted"
            const isPending = memberStatus === "pending"

            return (
              <div
                key={group.id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4"
              >
                {/* Group header */}
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-white text-base">
                      {group.name}
                    </h3>
                    {group.institution && (
                      <p className="text-zinc-500 text-xs mt-0.5">
                        {group.institution}
                      </p>
                    )}
                  </div>
                  <div className="bg-zinc-800 border border-cyan-500/30 rounded-xl px-2.5 py-1 text-center">
                    <p className="text-cyan-400 font-bold text-sm">
                      {group.total_lp} LP
                    </p>
                  </div>
                </div>

                {group.description && (
                  <p className="text-zinc-400 text-xs mb-3">
                    {group.description}
                  </p>
                )}

                {/* Member count */}
                <p className="text-zinc-500 text-xs mb-3">
                  👥 {group.member_count} members
                </p>

                {/* Action buttons */}
                <div className="flex gap-2">
                  {isMember && (
                    <>
                      <button
                        onClick={() => openGroup(group)}
                        className="flex-1 py-2 bg-gradient-to-r from-purple-500 to-cyan-400 rounded-xl text-sm font-semibold"
                      >
                        View Group
                      </button>
                    </>
                  )}

                  {isPending && (
                    <div className="flex-1 py-2 bg-yellow-500/20 border border-yellow-500/40 rounded-xl text-sm font-semibold text-yellow-400 text-center">
                      ⏳ Request Pending
                    </div>
                  )}

                  {!memberStatus && (
                    <button
                      onClick={() => requestJoin(group.id)}
                      disabled={loading}
                      className="flex-1 py-2 bg-zinc-800 border border-zinc-600 hover:border-cyan-500 rounded-xl text-sm font-semibold text-zinc-300 hover:text-white transition-colors"
                    >
                      Request to Join
                    </button>
                  )}

                  {isMember && (
                    <button
                      onClick={() => openGroup(group)}
                      className="py-2 px-3 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-zinc-400"
                    >
                      👥 {group.member_count}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

      </main>
      <BottomNav />
    </div>
  )
}