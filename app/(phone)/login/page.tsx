"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { login, signUp } from "@/lib/auth"
import { supabase } from "@/lib/supabase"

type Institution = {
  id: string
  name: string
  type: string
}

export default function LoginPage() {
  const router = useRouter()
  const [isSignUp, setIsSignUp] = useState(false)
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [username, setUsername] = useState("")
  const [selectedInstitution, setSelectedInstitution] = useState("")
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    loadInstitutions()
  }, [])

  async function loadInstitutions() {
    const { data } = await supabase
      .from("institutions")
      .select("*")
      .order("name", { ascending: true })
    if (data) setInstitutions(data)
  }

  const filteredInstitutions = institutions.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase())
  )

  async function handleLogin() {
    if (!code || !password) {
      setError("Please fill in all fields")
      return
    }
    setLoading(true)
    setError("")
    const result = await login(code, password)
    if (result.error) {
      setError(result.error)
    } else {
      router.push(result.role === "admin" ? "/admin" : "/sessions")
    }
    setLoading(false)
  }

  // ✅ REPLACED handleSignUp FUNCTION
  async function handleSignUp() {
    if (!username || !password || !selectedInstitution) {
      setError("Please fill in all fields and select your institution")
      return
    }

    setLoading(true)
    setError("")

    const result = await signUp("", password, username, selectedInstitution)

    if (result.error) {
      setError(result.error)
    } else {
      router.push("/sessions")
    }

    setLoading(false)
  }

  return (
    <div className="flex flex-col h-full bg-black text-white overflow-y-auto">
      <div className="flex flex-col justify-center min-h-full px-6 py-10">

        {/* Logo */}
        <div className="mb-10 text-center">
          <div className="flex items-center justify-center gap-1 mb-2">
            <span className="text-5xl font-black text-white tracking-tighter">IR</span>
            <span className="text-4xl font-black px-2 py-0.5"
              style={{ background: "#B400FF", color: "#00D4FF", border: "2px solid #00D4FF" }}>
              L
            </span>
          </div>
          <p className="text-zinc-500 text-sm">In Real Life</p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-zinc-900 rounded-2xl p-1 mb-6">
          <button
            onClick={() => { setIsSignUp(false); setError("") }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              !isSignUp ? "bg-cyan-400 text-black" : "text-zinc-400"
            }`}
          >
            Login
          </button>
          <button
            onClick={() => { setIsSignUp(true); setError("") }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              isSignUp ? "bg-cyan-400 text-black" : "text-zinc-400"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* LOGIN FORM */}
        {!isSignUp && (
          <div className="space-y-4">
            <div>
              <label className="text-zinc-400 text-xs mb-1.5 block">Invite Code</label>
              <input
                type="text"
                placeholder="e.g. IRL-ABC123"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-400 placeholder:text-zinc-600"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-xs mb-1.5 block">Password</label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-400 placeholder:text-zinc-600"
              />
            </div>
            {error && (
              <div className="bg-red-500/20 border border-red-500/40 text-red-400 text-xs px-4 py-3 rounded-xl">
                {error}
              </div>
            )}
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-sm font-bold mt-2 disabled:opacity-50 text-white"
              style={{ background: "linear-gradient(to right, #B400FF, #00D4FF)" }}
            >
              {loading ? "Please wait..." : "Login"}
            </button>
          </div>
        )}

        {/* SIGNUP FORM */}
        {isSignUp && (
          <div className="space-y-4">
            {/* ...rest of your signup form untouched... */}
          </div>
        )}

      </div>
    </div>
  )
}