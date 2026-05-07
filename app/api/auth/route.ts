import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import bcrypt from "bcryptjs"

export async function POST(req: NextRequest) {
  try {
    const { username, password, mode, adminCode, selectedInstitution } = await req.json()

    if (mode === "student-login") {
      if (!username || !password) {
        return NextResponse.json({ error: "Please fill in all fields" }, { status: 400 })
      }

      const { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("user_name", username)
        .eq("role", "student")
        .maybeSingle()

      if (!user) {
        return NextResponse.json({ error: "Username not found" }, { status: 400 })
      }

      const match = await bcrypt.compare(password, user.password)
      if (!match) {
        return NextResponse.json({ error: "Incorrect password" }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        user: { user_name: user.user_name, school: user.school, role: user.role }
      })
    }

    if (mode === "student-signup") {
      if (!username || !password || !selectedInstitution) {
        return NextResponse.json({ error: "Please fill in all fields and select your institution" }, { status: 400 })
      }

      if (password.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
      }

      const { data: existing } = await supabase
        .from("users")
        .select("id")
        .eq("user_name", username)
        .maybeSingle()

      if (existing) {
        return NextResponse.json({ error: "Username already taken" }, { status: 400 })
      }

      const hashed = await bcrypt.hash(password, 10)
      const { error: err } = await supabase
        .from("users")
        .insert({
          user_name: username,
          school: selectedInstitution,
          institution_name: selectedInstitution,
          role: "student",
          code: `IRL-${username.toUpperCase().replace(/\s/g, "")}`,
          password: hashed
        })

      if (err) {
        return NextResponse.json({ error: `Failed: ${err.message}` }, { status: 500 })
      }

      await supabase
        .from("leaderboard")
        .insert({ user_name: username, points: 0 })

      return NextResponse.json({
        success: true,
        user: { user_name: username, school: selectedInstitution, role: "student" }
      })
    }

    if (mode === "admin") {
      if (!adminCode || !password) {
        return NextResponse.json({ error: "Please fill in all fields" }, { status: 400 })
      }

      const { data: existingUser } = await supabase
        .from("users")
        .select("*")
        .eq("code", adminCode.toUpperCase())
        .eq("role", "admin")
        .maybeSingle()

      if (existingUser) {
        const match = await bcrypt.compare(password, existingUser.password)
        if (!match) {
          return NextResponse.json({ error: "Incorrect password" }, { status: 400 })
        }

        return NextResponse.json({
          success: true,
          user: { user_name: existingUser.user_name, school: existingUser.school, role: existingUser.role }
        })
      }

      const { data: invite } = await supabase
        .from("invite_codes")
        .select("*")
        .eq("code", adminCode.toUpperCase())
        .eq("used", false)
        .maybeSingle()

      if (!invite || invite.role !== "admin") {
        return NextResponse.json({ error: "Invalid admin code" }, { status: 400 })
      }

      const hashed = await bcrypt.hash(password, 10)
      const { error: err } = await supabase
        .from("users")
        .insert({
          user_name: invite.user_name,
          school: invite.school,
          role: "admin",
          code: adminCode.toUpperCase(),
          password: hashed
        })

      if (err) {
        return NextResponse.json({ error: `Failed: ${err.message}` }, { status: 500 })
      }

      await supabase
        .from("invite_codes")
        .update({ used: true })
        .eq("code", adminCode.toUpperCase())

      await supabase
        .from("leaderboard")
        .insert({ user_name: invite.user_name, points: 0 })

      return NextResponse.json({
        success: true,
        user: { user_name: invite.user_name, school: invite.school, role: "admin" }
      })
    }

    return NextResponse.json({ error: "Invalid mode" }, { status: 400 })
  } catch (error) {
    console.error("Auth error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}