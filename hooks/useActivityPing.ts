"use client"

import { useEffect } from "react"

const CSRF_COOKIE_PREFIX = "_csrf="

const getCsrfHeaders = (): HeadersInit => {
  const csrfCookie = document.cookie
    .split(";")
    .find((c) => c.trim().startsWith(CSRF_COOKIE_PREFIX))
  const token = csrfCookie?.split("=")[1]?.trim()
  return token ? { "x-csrf-token": token } : {}
}

/** Keeps `User.lastActiveAt` fresh while the user has the app open. */
export const useActivityPing = (userId: string | null | undefined) => {
  useEffect(() => {
    if (!userId) return

    const ping = () => {
      void fetch("/api/activity/ping", {
        method: "POST",
        credentials: "include",
        headers: getCsrfHeaders(),
      })
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
