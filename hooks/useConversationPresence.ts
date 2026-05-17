"use client"

import { useEffect } from "react"

import { useCSRF } from "@/hooks/useCSRF"

export const useConversationPresence = (counterpartUserId: string | null) => {
  const { addToHeaders } = useCSRF()

  useEffect(() => {
    if (!counterpartUserId) return

    const postPresence = (active: boolean) => {
      void fetch("/api/push/presence", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...addToHeaders(),
        },
        body: JSON.stringify({
          counterpartUserId: active ? counterpartUserId : null,
        }),
      })
    }

    const update = () => {
      const visible = document.visibilityState === "visible"
      postPresence(visible)
    }

    update()
    const heartbeat = setInterval(update, 30_000)
    document.addEventListener("visibilitychange", update)
    window.addEventListener("focus", update)
    window.addEventListener("blur", update)

    return () => {
      clearInterval(heartbeat)
      document.removeEventListener("visibilitychange", update)
      window.removeEventListener("focus", update)
      window.removeEventListener("blur", update)
      postPresence(false)
    }
  }, [counterpartUserId, addToHeaders])
}
