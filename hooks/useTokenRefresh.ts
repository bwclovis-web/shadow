"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef } from "react"

const REFRESH_INTERVAL_MS = 50 * 60 * 1000 // 50 minutes (before 1h access expiry)

const REFRESH_API = "/api/auth/refresh"

/** Periodically refreshes auth tokens and revalidates server-rendered data. */
export const useTokenRefresh = (enabled: boolean) => {
  const router = useRouter()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const doRefresh = useCallback(async () => {
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
  }, [router])

  useEffect(() => {
    if (!enabled) return

    intervalRef.current = setInterval(() => {
      void doRefresh()
    }, REFRESH_INTERVAL_MS)

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void doRefresh()
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [doRefresh, enabled])
}
