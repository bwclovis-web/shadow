"use client"

import { useEffect } from "react"

import { useCSRF } from "@/hooks/useCSRF"

/** Must stay below `PRESENCE_ACTIVE_MS` in `models/conversation-presence.server.ts`. */
const PRESENCE_HEARTBEAT_MS = 60_000

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

    const heartbeat = () => {
      if (document.visibilityState === "visible") postPresence(true)
    }

    update()
    const heartbeatId = setInterval(heartbeat, PRESENCE_HEARTBEAT_MS)
    document.addEventListener("visibilitychange", update)

    return () => {
      clearInterval(heartbeatId)
      document.removeEventListener("visibilitychange", update)
      postPresence(false)
    }
  }, [counterpartUserId, addToHeaders])
}
