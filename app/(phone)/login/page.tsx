"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import bcrypt from "bcryptjs"

type Institution = { id: string; name: string; type: string }

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<"student-login" | "student-signup" | "admin">("student-login")
  const [password, setPassword] = useState("")
  const [username, setUsername] = useState("")
  const [adminCode, setAdminCode] = useState("")
  const [selectedInstitution, setSelectedInstitution] = useState("")
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => { loadInstitutions() }, [])

  async function loadInstitutions() {
    const { data } = await supabase.from("institutions").select("*").order("name", { ascending: true })
    if (data) setInstitutions(data)
  }

  const filtered = institutions.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))

  function saveToStorage(userName: string, school: string, role: string) {
    localStorage.setItem("irl_user", userName)
    localStorage.setItem("irl_school", school)
    localStorage.setItem("irl_role", role)
    sessionStorage.setItem("irl_user", userName)
    sessionStorage.setItem("irl_school", school)
    sessionStorage.setItem("irl_role", role)
    const expires = new Date()
    expires.setFullYear(expires.getFullYear() + 2)
    const opts = `expires=${expires.toUTCString()}; path=/; SameSite=Lax`
    document.cookie = `irl_user=${encodeURIComponent(userName)}; ${opts}`
    document.cookie = `irl_school=${encodeURIComponent(school)}; ${opts}`
    document.cookie = `irl_role=${role}; ${opts}`
  }

  async function handleStudentLogin() {
    if (!username || !password) { setError("Please fill in all fields"); return }
    setLoading(true); setError("")
    const { data: user } = await supabase.from("users").select("*").eq("user_name", username).eq("role", "student").maybeSingle()
    if (!user) { setError("Username not found"); setLoading(false); return }
    const match = await bcrypt.compare(password, user.password)
    if (!match) { setError("Incorrect password"); setLoading(false); return }
    saveToStorage(user.user_name, user.school, user.role)
    router.push("/sessions")
    setLoading(false)
  }

  async function handleStudentSignUp() {
    if (!username || !password || !selectedInstitution) { setError("Please fill in all fields and select your institution"); return }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return }
    setLoading(true); setError("")
    const { data: existing } = await supabase.from("users").select("id").eq("user_name", username).maybeSingle()
    if (existing) { setError("Username already taken"); setLoading(false); return }
    const hashed = await bcrypt.hash(password, 10)
    const { error: err } = await supabase.from("users").insert({
      user_name: username, school: selectedInstitution,
      institution_name: selectedInstitution, role: "student",
      code: `IRL-${username.toUpperCase().replace(/\s/g, "")}`, password: hashed
    })
    if (err) { setError(`Failed: ${err.message}`); setLoading(false); return }
    await supabase.from("leaderboard").insert({ user_name: username, points: 0 })
    saveToStorage(username, selectedInstitution, "student")
    router.push("/sessions")
    setLoading(false)
  }

  async function handleAdminLogin() {
    if (!adminCode || !password) { setError("Please fill in all fields"); return }
    setLoading(true); setError("")

    const { data: existingUser } = await supabase.from("users")
      .select("*").eq("code", adminCode.toUpperCase()).eq("role", "admin").maybeSingle()

    if (existingUser) {
      const match = await bcrypt.compare(password, existingUser.password)
      if (!match) { setError("Incorrect password"); setLoading(false); return }
      saveToStorage(existingUser.user_name, existingUser.school, existingUser.role)
      router.push("/admin")
      setLoading(false)
      return
    }

    const { data: invite } = await supabase.from("invite_codes")
      .select("*").eq("code", adminCode.toUpperCase()).eq("used", false).maybeSingle()

    if (!invite || invite.role !== "admin") {
      setError("Invalid admin code")
      setLoading(false)
      return
    }

    const hashed = await bcrypt.hash(password, 10)
    const { error: err } = await supabase.from("users").insert({
      user_name: invite.user_name, school: invite.school,
      role: "admin", code: adminCode.toUpperCase(), password: hashed
    })
    if (err) { setError(`Failed: ${err.message}`); setLoading(false); return }

    await supabase.from("invite_codes").update({ used: true }).eq("code", adminCode.toUpperCase())
    await supabase.from("leaderboard").insert({ user_name: invite.user_name, points: 0 })
    saveToStorage(invite.user_name, invite.school, "admin")
    router.push("/admin")
    setLoading(false)
  }

  return (
    <div className="flex flex-col h-full bg-black text-white overflow-y-auto">
      <div className="flex flex-col justify-center min-h-full px-6 py-10">

        {/* Logo */}
        <div className="mb-10 text-center">
          <div className="flex items-center justify-center gap-1 mb-2">
            <span className="text-5xl font-black text-white tracking-tighter">IR</span>
            <span className="text-4xl font-black px-2 py-0.5" style={{ background: "#B400FF", color: "#00D4FF", border: "2px solid #00D4FF" }}>L</span>
          </div>
          <p className="text-zinc-500 text-sm">In Real Life</p>
        </div>

        {/* Mode switcher */}
        <div className="flex bg-zinc-900 rounded-2xl p-1 mb-6 gap-1">
          {[
            { key: "student-login", label: "Login" },
            { key: "student-signup", label: "Sign Up" },
            { key: "admin", label: "Admin" },
          ].map(m => (
            <button key={m.key} onClick={() => { setMode(m.key as any); setError("") }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                mode === m.key
                  ? m.key === "admin" ? "bg-purple-500 text-white" : "bg-cyan-400 text-black"
                  : "text-zinc-400"
              }`}>
              {m.label}
            </button>
          ))}
        </div>

        {/* STUDENT LOGIN */}
        {mode === "student-login" && (
          <div className="space-y-4">
            <div>
              <label className="text-zinc-400 text-xs mb-1.5 block">Username</label>
              <input type="text" placeholder="Enter your username" value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-400 placeholder:text-zinc-600" />
            </div>
            <div>
              <label className="text-zinc-400 text-xs mb-1.5 block">Password</label>
              <input type="password" placeholder="Enter your password" value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-400 placeholder:text-zinc-600" />
            </div>
            {error && <div className="bg-red-500/20 border border-red-500/40 text-red-400 text-xs px-4 py-3 rounded-xl">{error}</div>}
            <button onClick={handleStudentLogin} disabled={loading}
              className="w-full py-3.5 rounded-xl text-sm font-bold disabled:opacity-50 text-white"
              style={{ background: "linear-gradient(to right, #B400FF, #00D4FF)" }}>
              {loading ? "Please wait..." : "Login"}
            </button>
          </div>
        )}

        {/* STUDENT SIGNUP */}
        {mode === "student-signup" && (
          <div className="space-y-4">
            <div>
              <label className="text-zinc-400 text-xs mb-1.5 block">Your Institution</label>
              <div className="relative">
                <input type="text" placeholder="Search for your school or college..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setShowDropdown(true); setSelectedInstitution("") }}
                  onFocus={() => setShowDropdown(true)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-400 placeholder:text-zinc-600" />
                {selectedInstitution && <div className="absolute right-3 top-3.5"><span className="text-cyan-400 text-xs font-bold">✓ Selected</span></div>}
                {showDropdown && search && filtered.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-zinc-800 border border-zinc-700 rounded-xl mt-1 max-h-48 overflow-y-auto z-50">
                    {filtered.map(i => (
                      <button key={i.id} onClick={() => { setSelectedInstitution(i.name); setSearch(i.name); setShowDropdown(false) }}
                        className="w-full text-left px-4 py-3 text-white text-sm hover:bg-zinc-700 border-b border-zinc-700/50 last:border-0">
                        <p className="font-semibold">{i.name}</p>
                        <p className="text-zinc-500 text-[11px] capitalize">{i.type}</p>
                      </button>
                    ))}
                  </div>
                )}
                {showDropdown && search && filtered.length === 0 && (
                  <div className="absolute top-full left-0 right-0 bg-zinc-800 border border-zinc-700 rounded-xl mt-1 z-50">
                    <p className="text-zinc-500 text-sm px-4 py-3">Not found. Ask your admin to register it.</p>
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="text-zinc-400 text-xs mb-1.5 block">Choose a Username</label>
              <input type="text" placeholder="e.g. JohnSmith" value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-400 placeholder:text-zinc-600" />
            </div>
            <div>
              <label className="text-zinc-400 text-xs mb-1.5 block">Choose a Password</label>
              <input type="password" placeholder="At least 6 characters" value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-400 placeholder:text-zinc-600" />
            </div>
            {error && <div className="bg-red-500/20 border border-red-500/40 text-red-400 text-xs px-4 py-3 rounded-xl">{error}</div>}
            <button onClick={handleStudentSignUp} disabled={loading}
              className="w-full py-3.5 rounded-xl text-sm font-bold disabled:opacity-50 text-white"
              style={{ background: "linear-gradient(to right, #B400FF, #00D4FF)" }}>
              {loading ? "Creating account..." : "Create Account"}
            </button>
            <p className="text-zinc-600 text-xs text-center">Can't find your institution? Contact your admin.</p>
          </div>
        )}

        {/* ADMIN */}
        {mode === "admin" && (
          <div className="space-y-4">
            <p className="text-zinc-500 text-xs text-center">First time? Enter your invite code and set a password. Already set up? Enter your code and password to login.</p>
            <div>
              <label className="text-zinc-400 text-xs mb-1.5 block">Admin Code</label>
              <input type="text" placeholder="e.g. IRL-ABC123" value={adminCode}
                onChange={e => setAdminCode(e.target.value.toUpperCase())}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-400 placeholder:text-zinc-600" />
            </div>
            <div>
              <label className="text-zinc-400 text-xs mb-1.5 block">Password</label>
              <input type="password" placeholder="Your password" value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-400 placeholder:text-zinc-600" />
            </div>
            {error && <div className="bg-red-500/20 border border-red-500/40 text-red-400 text-xs px-4 py-3 rounded-xl">{error}</div>}
            <button onClick={handleAdminLogin} disabled={loading}
              className="w-full py-3.5 rounded-xl text-sm font-bold disabled:opacity-50 text-white"
              style={{ background: "linear-gradient(to right, #7B00CC, #B400FF)" }}>
              {loading ? "Please wait..." : "Continue"}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
