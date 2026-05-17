"use client"

import { useEffect } from "react"

/** Keeps `User.lastActiveAt` fresh while the user has the app open. */
export const useActivityPing = (userId: string | null | undefined) => {
  useEffect(() => {
    if (!userId) return

    const ping = () => {
      void fetch("/api/activity/ping", { method: "POST", credentials: "include" })
    }

    ping()

    const onFocus = () => ping()
    window.addEventListener("focus", onFocus)

    const interval = window.setInterval(ping, 10 * 60 * 1000)

    return () => {
      window.removeEventListener("focus", onFocus)
      window.clearInterval(interval)
    }
  }, [userId])
}
