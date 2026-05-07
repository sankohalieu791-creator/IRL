"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { getUser } from "@/lib/auth"

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
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

    setIsLoading(false)
  }, [pathname, router])

  if (isLoading) {
    return <div className="bg-black h-screen" />
  }

  return <>{children}</>
}
