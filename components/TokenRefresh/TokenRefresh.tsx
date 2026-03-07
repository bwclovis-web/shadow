"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"

const REFRESH_INTERVAL_MS = 50 * 60 * 1000 // 50 minutes (before 1h access expiry)
const REFRESH_ON_MOUNT_DELAY_MS = 1_000 // 1s after mount so tokens refresh soon without blocking first paint

const REFRESH_API = "/api/auth/refresh"

/**
 * Calls the refresh endpoint on mount (after a short delay) and every 50 minutes
 * so the access token is renewed before it expires (1h). Keeps users logged in
 * without re-prompting every hour.
 */
export function TokenRefresh() {
  const router = useRouter()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const doRefresh = async () => {
    try {
      const res = await fetch(REFRESH_API, {
        method: "POST",
        credentials: "include",
      })
      if (res.ok) {
        router.refresh()
      }
    } catch {
      // Ignore network errors; next interval or next request will retry
    }
  }

  useEffect(() => {
    const onMount = setTimeout(() => {
      doRefresh()
    }, REFRESH_ON_MOUNT_DELAY_MS)

    intervalRef.current = setInterval(doRefresh, REFRESH_INTERVAL_MS)

    return () => {
      clearTimeout(onMount)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [router])

  return null
}
