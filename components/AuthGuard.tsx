"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { getUser } from "@/lib/auth"
export default function AuthGuard({ children }: { children: React.ReactNode }) {
const router = useRouter()
const pathname = usePathname()
  useEffect(() => {
    const user = getUser()
    if (!user) {
      router.replace("/login")
    }
  }, [pathname])
  return <>{children}</>
}