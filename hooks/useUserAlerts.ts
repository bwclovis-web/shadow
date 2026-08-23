"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { useCSRF } from "@/hooks/useCSRF"
import type { UserAlert } from "@/types/database"

export const USER_ALERTS_REFRESH_EVENT = "user-alerts-refresh"

type UseUserAlertsOptions = {
  userId: string
  initialAlerts?: UserAlert[]
  initialUnreadCount?: number
  initialTradeUnreadCount?: number
  initialDirectMessageUnreadCount?: number
  pollIntervalMs?: number
  /** When true, skips polling (e.g. profile uses shared provider context). */
  disabled?: boolean
}

export const useUserAlerts = ({
  userId,
  initialAlerts = [],
  initialUnreadCount = 0,
  initialTradeUnreadCount = 0,
  initialDirectMessageUnreadCount = 0,
  pollIntervalMs = 30_000,
  disabled = false,
}: UseUserAlertsOptions) => {
  const [alerts, setAlerts] = useState<UserAlert[]>(initialAlerts)
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const [tradeUnreadCount, setTradeUnreadCount] = useState(initialTradeUnreadCount)
  const [directMessageUnreadCount, setDirectMessageUnreadCount] = useState(
    initialDirectMessageUnreadCount
  )
  const { addToHeaders } = useCSRF()
  const addToHeadersRef = useRef(addToHeaders)

  useEffect(() => {
    addToHeadersRef.current = addToHeaders
  }, [addToHeaders])

  // Only re-sync from SSR when the signed-in user changes — not when parent passes a new array reference.
  useEffect(() => {
    setAlerts(initialAlerts)
    setUnreadCount(initialUnreadCount)
    setTradeUnreadCount(initialTradeUnreadCount)
    setDirectMessageUnreadCount(initialDirectMessageUnreadCount)
    // initialAlerts / initialUnreadCount are tied to userId from the layout; omit them from deps to avoid resetting after dismiss.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: sync on user change only
  }, [userId])

  const refresh = useCallback(async () => {
    if (!userId) return
    try {
      const [alertsResponse, messagesResponse] = await Promise.all([
        fetch(`/api/user-alerts/${userId}`, {
          headers: addToHeadersRef.current(),
          cache: "no-store",
          credentials: "include",
        }),
        fetch("/api/messages?unreadCountOnly=1", {
          cache: "no-store",
          credentials: "include",
        }),
      ])
      if (alertsResponse.ok) {
        const data = await alertsResponse.json()
        setAlerts(data.alerts ?? [])
        setUnreadCount(data.unreadCount ?? 0)
        setTradeUnreadCount(data.tradeUnreadCount ?? 0)
      }
      if (messagesResponse.ok) {
        const data: { unreadCount?: number } = await messagesResponse.json()
        setDirectMessageUnreadCount(data.unreadCount ?? 0)
      }
    } catch (error) {
      console.error("Failed to fetch unread counts:", error)
    }
  }, [userId])

  useEffect(() => {
    if (!userId || disabled) return

    const onRefresh = () => {
      void refresh()
    }

    let intervalId: ReturnType<typeof setInterval> | null = null

    const clearPoll = () => {
      if (intervalId != null) {
        clearInterval(intervalId)
        intervalId = null
      }
    }

    const startPoll = (ms: number) => {
      clearPoll()
      intervalId = setInterval(refresh, ms)
    }

    const visibleInterval = pollIntervalMs
    const hiddenInterval = Math.max(pollIntervalMs * 4, 120_000)

    const syncPollToVisibility = () => {
      if (typeof document === "undefined") {
        startPoll(visibleInterval)
        return
      }
      if (document.visibilityState === "visible") {
        startPoll(visibleInterval)
        void refresh()
      } else {
        startPoll(hiddenInterval)
      }
    }

    syncPollToVisibility()

    window.addEventListener(USER_ALERTS_REFRESH_EVENT, onRefresh)
    document.addEventListener("visibilitychange", syncPollToVisibility)

    return () => {
      clearPoll()
      window.removeEventListener(USER_ALERTS_REFRESH_EVENT, onRefresh)
      document.removeEventListener("visibilitychange", syncPollToVisibility)
    }
  }, [userId, pollIntervalMs, refresh, disabled])

  const handleDismissAll = async () => {
    try {
      const response = await fetch(`/api/user-alerts/${userId}/dismiss-all`, {
        method: "POST",
        headers: addToHeadersRef.current(),
        credentials: "include",
      })
      if (response.ok) {
        setAlerts([])
        setUnreadCount(0)
        return true
      }
    } catch (error) {
      console.error("Failed to dismiss all alerts:", error)
    }
    return false
  }

  const handleMarkAsRead = async (alertId: string) => {
    try {
      const response = await fetch(`/api/user-alerts/${userId}/alert/${alertId}/read`, {
        method: "POST",
        headers: addToHeadersRef.current(),
        credentials: "include",
      })

      if (response.ok) {
        setAlerts(prev =>
          prev.map(alert =>
            alert.id === alertId
              ? { ...alert, isRead: true, readAt: new Date() }
              : alert
          )
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
        dispatchUserAlertsRefresh()
      }
    } catch (error) {
      console.error("Failed to mark alert as read:", error)
    }
  }

  const handleDismissAlert = async (alertId: string) => {
    const target = alerts.find(a => a.id === alertId)
    if (!target) return

    const wasUnread = !target.isRead
    if (wasUnread) {
      setUnreadCount(prev => Math.max(0, prev - 1))
    }

    try {
      const response = await fetch(`/api/user-alerts/${userId}/alert/${alertId}/dismiss`, {
        method: "POST",
        headers: addToHeadersRef.current(),
        credentials: "include",
      })

      if (response.ok) {
        setAlerts(prev => prev.filter(alert => alert.id !== alertId))
        dispatchUserAlertsRefresh()
        return
      }

      if (wasUnread) {
        setUnreadCount(prev => prev + 1)
      }
      void refresh()
    } catch (error) {
      console.error("Failed to dismiss alert:", error)
      if (wasUnread) {
        setUnreadCount(prev => prev + 1)
      }
      void refresh()
    }
  }

  return {
    alerts,
    unreadCount,
    tradeUnreadCount,
    directMessageUnreadCount,
    refresh,
    handleMarkAsRead,
    handleDismissAlert,
    handleDismissAll,
  }
}

export const dispatchUserAlertsRefresh = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(USER_ALERTS_REFRESH_EVENT))
  }
}
