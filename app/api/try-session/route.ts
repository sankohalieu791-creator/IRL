import { supabase } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function POST(req: Request) {

  const { sessionId } = await req.json()

  const user = "Test User"

  const { data: session } = await supabase
    .from("sessions")
    .select("points")
    .eq("id", sessionId)
    .single()

  if (!session) {
    return NextResponse.json({ success: false })
  }

  const points = session.points

  await supabase
    .from("session_attempts")
    .insert({
      session_id: sessionId,
      user_name: user
    })

  const { data: leaderboard } = await supabase
    .from("leaderboard")
    .select("points")
    .eq("user_name", user)
    .single()

  const newPoints = (leaderboard?.points || 0) + points

  await supabase
    .from("leaderboard")
    .upsert({
      user_name: user,
      points: newPoints
    })

  return NextResponse.json({ success: true })
}