import { supabase } from "./supabase"
import bcrypt from "bcryptjs"

export async function signUp(code: string, password: string, username?: string, institution?: string) {
  
  // NEW FLOW — institution based signup (no invite code)
  if (username && institution) {
    // Check if username already exists
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("user_name", username)
      .maybeSingle()

    if (existing) {
      return { error: "That username is already taken. Please choose another." }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const { error: userError } = await supabase
      .from("users")
      .insert({
        user_name: username,
        school: institution,
        institution_name: institution,
        role: "student",
        code: `IRL-${username.toUpperCase().replace(/\s/g, "")}`,
        password: hashedPassword
      })

    if (userError) {
      return { error: `Failed to create account: ${userError.message}` }
    }

    // Auto create leaderboard row
    await supabase
      .from("leaderboard")
      .insert({ user_name: username, points: 0 })

    // Save to storage
    saveToStorage(username, institution, "student")

    return { success: true, role: "student" }
  }

  // OLD FLOW — invite code based signup (for admins)
  const { data: invite, error: inviteError } = await supabase
    .from("invite_codes")
    .select("*")
    .eq("code", code.toUpperCase())
    .eq("used", false)
    .single()

  if (inviteError || !invite) {
    return { error: "Invalid or already used invite code" }
  }

  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("user_name", invite.user_name)
    .maybeSingle()

  if (existingUser) {
    return { error: "This invite code has already been used to create an account" }
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10)

  const { error: userError } = await supabase
    .from("users")
    .insert({
      user_name: invite.user_name,
      school: invite.school,
      role: invite.role,
      code: code.toUpperCase(),
      password: hashedPassword
    })

  if (userError) {
    return { error: `Failed to create account: ${userError.message}` }
  }

  await supabase
    .from("leaderboard")
    .insert({ user_name: invite.user_name, points: 0 })

  await supabase
    .from("invite_codes")
    .update({ used: true })
    .eq("code", code.toUpperCase())

  saveToStorage(invite.user_name, invite.school, invite.role)

  return { success: true, role: invite.role }
}

export async function login(code: string, password: string) {
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle()

  if (error || !user) {
    return { error: "Invalid code or password" }
  }

  const passwordMatch = await bcrypt.compare(password, user.password)

  if (!passwordMatch) {
    return { error: "Invalid code or password" }
  }

  saveToStorage(user.user_name, user.school, user.role)

  return { success: true, role: user.role }
}

function saveToStorage(userName: string, school: string, role: string) {
  if (typeof window === "undefined") return

  localStorage.setItem("irl_user", userName)
  localStorage.setItem("irl_school", school)
  localStorage.setItem("irl_role", role)
  sessionStorage.setItem("irl_user", userName)
  sessionStorage.setItem("irl_school", school)
  sessionStorage.setItem("irl_role", role)

  const expires = new Date()
  expires.setFullYear(expires.getFullYear() + 1)
  document.cookie = `irl_user=${userName}; expires=${expires.toUTCString()}; path=/`
  document.cookie = `irl_school=${school}; expires=${expires.toUTCString()}; path=/`
  document.cookie = `irl_role=${role}; expires=${expires.toUTCString()}; path=/`
}

export function getUser(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("irl_user")
    || sessionStorage.getItem("irl_user")
    || getCookieValue("irl_user")
}

export function getSchool(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("irl_school")
    || sessionStorage.getItem("irl_school")
    || getCookieValue("irl_school")
}

export function getRole(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("irl_role")
    || sessionStorage.getItem("irl_role")
    || getCookieValue("irl_role")
}

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null
  const cookies = document.cookie.split(";")
  const cookie = cookies.find(c => c.trim().startsWith(`${name}=`))
  return cookie ? cookie.split("=")[1] : null
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
  document.cookie = "irl_user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
  document.cookie = "irl_school=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
  document.cookie = "irl_role=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
}