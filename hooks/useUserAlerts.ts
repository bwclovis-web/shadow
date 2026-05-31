"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { useCSRF } from "@/hooks/useCSRF"
import type { UserAlert } from "@/types/database"

export const USER_ALERTS_REFRESH_EVENT = "user-alerts-refresh"

type UseUserAlertsOptions = {
  userId: string
  initialAlerts?: UserAlert[]
  initialUnreadCount?: number
  pollIntervalMs?: number
  /** When true, skips polling (e.g. profile uses shared provider context). */
  disabled?: boolean
}

export const useUserAlerts = ({
  userId,
  initialAlerts = [],
  initialUnreadCount = 0,
  pollIntervalMs = 30_000,
  disabled = false,
}: UseUserAlertsOptions) => {
  const [alerts, setAlerts] = useState<UserAlert[]>(initialAlerts)
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const { addToHeaders } = useCSRF()
  const addToHeadersRef = useRef(addToHeaders)

  useEffect(() => {
    addToHeadersRef.current = addToHeaders
  }, [addToHeaders])

  // Only re-sync from SSR when the signed-in user changes — not when parent passes a new array reference.
  useEffect(() => {
    setAlerts(initialAlerts)
    setUnreadCount(initialUnreadCount)
    // initialAlerts / initialUnreadCount are tied to userId from the layout; omit them from deps to avoid resetting after dismiss.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: sync on user change only
  }, [userId])

  const refresh = useCallback(async () => {
    if (!userId) return
    try {
      const response = await fetch(`/api/user-alerts/${userId}`, {
        headers: addToHeadersRef.current(),
        cache: "no-store",
        credentials: "include",
      })
      if (response.ok) {
        const data = await response.json()
        setAlerts(data.alerts ?? [])
        setUnreadCount(data.unreadCount ?? 0)
      }
    } catch (error) {
      console.error("Failed to fetch alerts:", error)
    }
  }, [userId])

  useEffect(() => {
    if (!userId || disabled) return

    const onRefresh = () => {
      void refresh()
    }

    const interval = setInterval(refresh, pollIntervalMs)
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh()
    }

    window.addEventListener(USER_ALERTS_REFRESH_EVENT, onRefresh)
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      clearInterval(interval)
      window.removeEventListener(USER_ALERTS_REFRESH_EVENT, onRefresh)
      document.removeEventListener("visibilitychange", onVisibility)
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
