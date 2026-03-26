import { supabase } from "./supabase"

export async function signUp(code: string, password: string) {
  // Check invite code exists and is unused
  const { data: invite, error: inviteError } = await supabase
    .from("invite_codes")
    .select("*")
    .eq("code", code.toUpperCase())
    .eq("used", false)
    .single()

  if (inviteError || !invite) {
    return { error: "Invalid or already used invite code" }
  }

  // Check if username already exists
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("user_name", invite.user_name)
    .maybeSingle()

  if (existingUser) {
    return { error: "This invite code has already been used to create an account" }
  }

  // Create user
  const { error: userError } = await supabase
    .from("users")
    .insert({
      user_name: invite.user_name,
      school: invite.school,
      role: invite.role,
      code: code.toUpperCase(),
      password: password
    })

  if (userError) {
    return { error: `Failed to create account: ${userError.message}` }
  }

  // Auto create leaderboard row
  const { error: lbError } = await supabase
    .from("leaderboard")
    .insert({
      user_name: invite.user_name,
      points: 0
    })

  if (lbError) {
    console.error("Leaderboard insert failed:", lbError.message)
  }

  // Mark invite code as used
  await supabase
    .from("invite_codes")
    .update({ used: true })
    .eq("code", code.toUpperCase())

  // Save to both localStorage and sessionStorage
  localStorage.setItem("irl_user", invite.user_name)
  localStorage.setItem("irl_school", invite.school)
  localStorage.setItem("irl_role", invite.role)
  sessionStorage.setItem("irl_user", invite.user_name)
  sessionStorage.setItem("irl_school", invite.school)
  sessionStorage.setItem("irl_role", invite.role)

  return { success: true, role: invite.role }
}

export async function login(code: string, password: string) {
  // Find user by code and password
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("code", code.toUpperCase())
    .eq("password", password)
    .maybeSingle()

  if (error || !user) {
    return { error: "Invalid code or password" }
  }

  // Save to both localStorage and sessionStorage
  localStorage.setItem("irl_user", user.user_name)
  localStorage.setItem("irl_school", user.school)
  localStorage.setItem("irl_role", user.role)
  sessionStorage.setItem("irl_user", user.user_name)
  sessionStorage.setItem("irl_school", user.school)
  sessionStorage.setItem("irl_role", user.role)

  return { success: true, role: user.role }
}

export function getUser(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("irl_user") || sessionStorage.getItem("irl_user")
}

export function getSchool(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("irl_school") || sessionStorage.getItem("irl_school")
}

export function getRole(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("irl_role") || sessionStorage.getItem("irl_role")
}

export function isAdmin(): boolean {
  return getRole() === "admin"
}

export function logout() {
  if (typeof window === "undefined") return
  localStorage.removeItem("irl_user")
  localStorage.removeItem("irl_school")
  localStorage.removeItem("irl_role")
  sessionStorage.removeItem("irl_user")
  sessionStorage.removeItem("irl_school")
  sessionStorage.removeItem("irl_role")
}