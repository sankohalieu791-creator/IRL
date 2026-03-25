"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { getUser, isAdmin } from "@/lib/auth"

export default function AuthGuard({
  children
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const user = getUser()
    const admin = isAdmin()

    if (!user && pathname !== "/login") {
      router.push("/login")
    } else if (user && admin && !pathname.startsWith("/admin")) {
      router.push("/admin")
    } else if (user && !admin && pathname.startsWith("/admin")) {
      router.push("/sessions")
    }

    setChecking(false)
  }, [pathname])

  if (checking) return null

  return <>{children}</>
}