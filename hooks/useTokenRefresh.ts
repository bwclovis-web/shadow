"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef } from "react"

const REFRESH_INTERVAL_MS = 50 * 60 * 1000 // 50 minutes (before 1h access expiry)
const REFRESH_ON_MOUNT_DELAY_MS = 1_000 // 1s after mount so tokens refresh soon without blocking first paint

const REFRESH_API = "/api/auth/refresh"

/** Periodically refreshes auth tokens and revalidates server-rendered data. */
export const useTokenRefresh = () => {
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
    const onMount = setTimeout(() => {
      void doRefresh()
    }, REFRESH_ON_MOUNT_DELAY_MS)

    intervalRef.current = setInterval(() => {
      void doRefresh()
    }, REFRESH_INTERVAL_MS)

    return () => {
      clearTimeout(onMount)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [doRefresh])
}
