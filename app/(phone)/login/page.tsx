"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { login, signUp } from "@/lib/auth"

export default function LoginPage() {
  const router = useRouter()
  const [isSignUp, setIsSignUp] = useState(false)
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit() {
    if (!code || !password) {
      setError("Please fill in all fields")
      return
    }

    setLoading(true)
    setError("")

    const result = isSignUp
      ? await signUp(code, password)
      : await login(code, password)

    if (result.error) {
      setError(result.error)
    } else {
      router.push("/sessions")
    }

    setLoading(false)
  }

  return (
    <div className="flex flex-col min-h-screen bg-black text-white justify-center px-6">

      {/* Logo */}
      <div className="mb-10 text-center">
        <h1 className="text-5xl font-black text-cyan-400 tracking-tight">
          IRL
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          In Real Life
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex bg-zinc-900 rounded-2xl p-1 mb-6">
        <button
          onClick={() => { setIsSignUp(false); setError("") }}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            !isSignUp
              ? "bg-cyan-400 text-black"
              : "text-zinc-400"
          }`}
        >
          Login
        </button>
        <button
          onClick={() => { setIsSignUp(true); setError("") }}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            isSignUp
              ? "bg-cyan-400 text-black"
              : "text-zinc-400"
          }`}
        >
          Sign Up
        </button>
      </div>

      {/* Form */}
      <div className="space-y-4">

        <div>
          <label className="text-zinc-400 text-xs mb-1.5 block">
            Invite Code
          </label>
          <input
            type="text"
            placeholder="e.g. IRL-ABC123"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-400 transition-colors placeholder:text-zinc-600"
          />
        </div>

        <div>
          <label className="text-zinc-400 text-xs mb-1.5 block">
            Password
          </label>
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-400 transition-colors placeholder:text-zinc-600"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/40 text-red-400 text-xs px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3.5 bg-gradient-to-r from-purple-500 to-cyan-400 rounded-xl text-sm font-bold mt-2 disabled:opacity-50"
        >
          {loading
            ? "Please wait..."
            : isSignUp
            ? "Create Account"
            : "Login"
          }
        </button>

      </div>

      {/* Sign up info */}
      {isSignUp && (
        <p className="text-zinc-600 text-xs text-center mt-6">
          Your invite code is provided by your institution.
          Contact your admin if you don't have one.
        </p>
      )}

    </div>
  )
}