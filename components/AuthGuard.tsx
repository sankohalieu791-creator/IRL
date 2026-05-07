"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { getUser } from "@/lib/auth"

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const user = getUser()

      if (!user) {
        // Not logged in
        setIsAuthenticated(false)
        if (pathname !== "/login") {
          router.replace("/login")
        }
      } else {
        // Logged in
        setIsAuthenticated(true)
        if (pathname === "/login") {
          router.replace("/sessions")
        }
      }
    } catch (error) {
      console.error("AuthGuard error:", error)
      setError("Failed to authenticate. Please refresh the page.")
      // On error, redirect to login
      if (pathname !== "/login") {
        router.replace("/login")
      }
    }

    setIsLoading(false)
  }, [pathname, router])

  if (isLoading) {
    return <div className="bg-black h-screen" />
  }

  if (error) {
    return (
      <div className="bg-black min-h-screen text-white flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-cyan-400 text-black rounded-lg font-bold hover:bg-cyan-300"
          >
            Refresh Page
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
