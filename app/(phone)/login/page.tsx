"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { saveToStorage, getUser } from "@/lib/auth"

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
  const [showArrow, setShowArrow] = useState(true)

  useEffect(() => {
    const user = getUser()
    if (user) { router.replace("/sessions"); return }
    loadInstitutions()
    // Hide arrow once they click Sign Up
    if (mode === "student-signup") setShowArrow(false)
  }, [])

  useEffect(() => {
    if (mode === "student-signup") setShowArrow(false)
  }, [mode])

  async function loadInstitutions() {
    const { data } = await supabase.from("institutions").select("*").order("name", { ascending: true })
    if (data) setInstitutions(data)
  }

  const filtered = institutions.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))

  async function handleStudentLogin() {
    if (!username || !password) { setError("Please fill in all fields"); return }
    setLoading(true); setError("")
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, mode: "student-login" })
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || "Login failed"); setLoading(false); return }
    saveToStorage(data.user.user_name, data.user.school, data.user.role)
    router.push("/sessions")
    setLoading(false)
  }

  async function handleStudentSignUp() {
    if (!username || !password || !selectedInstitution) { setError("Please fill in all fields and select your institution"); return }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return }
    setLoading(true); setError("")
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, mode: "student-signup", selectedInstitution })
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || "Signup failed"); setLoading(false); return }
    saveToStorage(data.user.user_name, data.user.school, data.user.role)
    router.push("/sessions")
    setLoading(false)
  }

  async function handleAdminLogin() {
    if (!adminCode || !password) { setError("Please fill in all fields"); return }
    setLoading(true); setError("")
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminCode, password, mode: "admin" })
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || "Login failed"); setLoading(false); return }
    saveToStorage(data.user.user_name, data.user.school, data.user.role)
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

        {/* NEW USER BANNER */}
        {showArrow && (
          <div
            onClick={() => { setMode("student-signup"); setShowArrow(false) }}
            style={{
              background: "linear-gradient(135deg, rgba(180,0,255,0.15), rgba(0,212,255,0.15))",
              border: "1px solid rgba(0,212,255,0.3)",
              borderRadius: 16,
              padding: "12px 16px",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer"
            }}
          >
            <div>
              <p style={{ color: "#00D4FF", fontSize: 13, fontWeight: 800, marginBottom: 2 }}>
                New here? 👋
              </p>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>
                Tap to create your free account
              </p>
            </div>
            {/* Bouncing arrow */}
            <div style={{
              fontSize: 24,
              animation: "bounceRight 0.8s ease-in-out infinite alternate"
            }}>
              👉
            </div>
          </div>
        )}

        {/* Bouncing arrow CSS */}
        <style>{`
          @keyframes bounceRight {
            from { transform: translateX(0px); }
            to { transform: translateX(8px); }
          }
        `}</style>

        {/* Mode switcher */}
        <div className="flex bg-zinc-900 rounded-2xl p-1 mb-6 gap-1">
          {[
            { key: "student-login", label: "Login" },
            { key: "student-signup", label: "Sign Up" },
            { key: "admin", label: "Admin" },
          ].map(m => (
            <button key={m.key} onClick={() => { setMode(m.key as any); setError(""); if (m.key === "student-signup") setShowArrow(false) }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                mode === m.key
                  ? m.key === "admin" ? "bg-purple-500 text-white" : "bg-cyan-400 text-black"
                  : "text-zinc-400"
              }`}>
              {m.label}
              {/* Pulse dot on Sign Up when arrow is showing */}
              {m.key === "student-signup" && showArrow && (
                <span style={{
                  display: "inline-block",
                  width: 6, height: 6,
                  background: "#00D4FF",
                  borderRadius: "50%",
                  marginLeft: 4,
                  verticalAlign: "middle",
                  animation: "pulse 1s ease-in-out infinite alternate"
                }} />
              )}
            </button>
          ))}
        </div>

        <style>{`
          @keyframes pulse {
            from { opacity: 1; transform: scale(1); }
            to { opacity: 0.3; transform: scale(0.8); }
          }
        `}</style>

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
            {/* Nudge to sign up */}
            <p
              onClick={() => { setMode("student-signup"); setShowArrow(false) }}
              style={{ color: "#00D4FF", fontSize: 12, textAlign: "center", cursor: "pointer", marginTop: 8 }}
            >
              Don't have an account? <strong>Sign up free →</strong>
            </p>
          </div>
        )}

        {/* STUDENT SIGNUP */}
        {mode === "student-signup" && (
          <div className="space-y-4">
            {/* Signup guide banner */}
            <div style={{
              background: "rgba(0,212,255,0.08)",
              border: "1px solid rgba(0,212,255,0.2)",
              borderRadius: 12,
              padding: "10px 14px"
            }}>
              <p style={{ color: "#00D4FF", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                How to sign up 👇
              </p>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, lineHeight: 1.6 }}>
                1. Search for your school or type <strong style={{ color: "white" }}>IRL</strong> if you're independent<br />
                2. Choose a username<br />
                3. Choose a password<br />
                4. Tap Create Account — you're in ✅
              </p>
            </div>

            <div>
              <label className="text-zinc-400 text-xs mb-1.5 block">Your Institution</label>
              <div className="relative">
                <input type="text" placeholder="Search your school or type IRL..."
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
                    <p className="text-zinc-500 text-sm px-4 py-3">Not found. Try typing IRL or ask your admin.</p>
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