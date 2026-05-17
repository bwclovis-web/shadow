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
  addToHeadersRef.current = addToHeaders

  useEffect(() => {
    setAlerts(initialAlerts)
    setUnreadCount(initialUnreadCount)
  }, [userId, initialAlerts, initialUnreadCount])

  const refresh = useCallback(async () => {
    if (!userId) return
    try {
      const response = await fetch(`/api/user-alerts/${userId}`, {
        headers: addToHeadersRef.current(),
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
    const wasUnread = alerts.find(a => a.id === alertId)?.isRead === false
    try {
      const response = await fetch(`/api/user-alerts/${userId}/alert/${alertId}/dismiss`, {
        method: "POST",
        headers: addToHeadersRef.current(),
      })

      if (response.ok) {
        setAlerts(prev => prev.filter(alert => alert.id !== alertId))
        if (wasUnread) {
          setUnreadCount(prev => Math.max(0, prev - 1))
        }
        dispatchUserAlertsRefresh()
      }
    } catch (error) {
      console.error("Failed to dismiss alert:", error)
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
