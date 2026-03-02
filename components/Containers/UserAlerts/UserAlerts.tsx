"use client"

import { Link } from "next-view-transitions"
import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button/Button"
import VooDooDetails from "@/components/Atoms/VooDooDetails/VooDooDetails"
import { useCSRF } from "@/hooks/useCSRF"
import type { UserAlert, UserAlertPreferences } from "@/types/database"

import { AlertBell } from "./AlertBell"
import { AlertItem } from "./AlertItem"
import { AlertPreferences } from "./AlertPreferences"

interface UserAlertsProps {
  userId: string
  initialAlerts?: UserAlert[]
  initialPreferences?: UserAlertPreferences
  initialUnreadCount?: number
}

export const UserAlerts = ({
  userId,
  initialAlerts = [],
  initialPreferences,
  initialUnreadCount = 0,
}: UserAlertsProps) => {
  const t = useTranslations("alerts")
  const [alerts, setAlerts] = useState<UserAlert[]>(initialAlerts)
  const [preferences, setPreferences] = useState<UserAlertPreferences | null>(initialPreferences || null)
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const [isLoading, setIsLoading] = useState(false)
  const { addToHeaders } = useCSRF()
  const addToHeadersRef = useRef(addToHeaders)
  addToHeadersRef.current = addToHeaders

  // Load preferences on mount if not provided
  useEffect(() => {
    if (preferences !== null || !userId) return
    const loadPreferences = async () => {
      try {
        const response = await fetch(`/api/user-alerts/${userId}/preferences`, {
          headers: addToHeadersRef.current(),
        })
        if (response.ok) {
          const loadedPreferences = await response.json()
          setPreferences(loadedPreferences)
        }
      } catch (error) {
        console.error("Failed to load preferences:", error)
      }
    }
    loadPreferences()
  }, [userId, preferences])

  // Poll for new alerts every 30 seconds (ref avoids effect re-running when addToHeaders identity changes)
  useEffect(() => {
    const poll = async () => {
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
    }
    const interval = setInterval(poll, 30000)
    return () => clearInterval(interval)
  }, [userId])

  const handleMarkAsRead = async (alertId: string) => {
    try {
      const response = await fetch(`/api/user-alerts/${userId}/alert/${alertId}/read`, {
        method: "POST",
        headers: addToHeadersRef.current(),
      })

      if (response.ok) {
        setAlerts(prev => prev.map(alert => alert.id === alertId
              ? { ...alert, isRead: true, readAt: new Date() }
              : alert))
        setUnreadCount(prev => Math.max(0, prev - 1))
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
      }
    } catch (error) {
      console.error("Failed to dismiss alert:", error)
    }
  }

  const handleDismissAll = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/user-alerts/${userId}/dismiss-all`, {
        method: "POST",
        headers: addToHeaders(),
      })

      if (response.ok) {
        setAlerts([])
        setUnreadCount(0)
      }
    } catch (error) {
      console.error("Failed to dismiss all alerts:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePreferencesChange = async (newPreferences: Partial<UserAlertPreferences>): Promise<boolean> => {
    try {
      // Create an AbortController for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

      const response = await fetch(`/api/user-alerts/${userId}/preferences`, {
        method: "PUT",
        headers: addToHeadersRef.current({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(newPreferences),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        const updatedPreferences = await response.json()
        setPreferences(updatedPreferences)
        return true
      }
      
      console.error("Failed to update preferences:", response.status, response.statusText)
      return false
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.error("Request timeout: Failed to update preferences within 10 seconds")
      } else {
        console.error("Failed to update preferences:", error)
      }
      return false
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold mb-2  text-noir-gold">{t("heading")}</h2>
        <AlertBell
          unreadCount={unreadCount}
          userId={userId}
          alerts={alerts}
          onMarkAsRead={handleMarkAsRead}
          onDismissAlert={handleDismissAlert}
        />
      </div>

      <div className="noir-border p-4 relative">
        <VooDooDetails
          summary={`${t("heading")} ${
            unreadCount > 0 ? `(${unreadCount} new)` : ""
          }`}
          className="text-start text-noir-gold"
          name="user-alerts"
        >
          <div className="space-y-4 p-4">
            <div className="flex flex-wrap gap-2 justify-between items-center">
              <div className="text-sm text-noir-gold-100">
                {alerts.length} {alerts.length === 1 ? t("alert") : t("alerts")} •{" "}
                {unreadCount} {t("unread")}
              </div>
              <div className="flex gap-2">
                {alerts.length > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleDismissAll}
                    disabled={isLoading}
                  >
                    {isLoading ? t("dismissing") : t("dismissAll")}
                  </Button>
                )}
                <Link href="/the-exchange">
                  <Button variant="primary" size="sm">
                    {t("viewTradingPost")}
                  </Button>
                </Link>
              </div>
            </div>

            {/* Alert List */}
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-noir-gold text-lg">{t("noAlerts")}</p>
                <p className="text-sm mt-2 text-noir-gold-100">
                  {t("noAlertsDescription")}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map(alert => (
                  <AlertItem
                    key={alert.id}
                    alert={alert}
                    onMarkAsRead={() => handleMarkAsRead(alert.id)}
                    onDismiss={() => handleDismissAlert(alert.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </VooDooDetails>
        {preferences && (
          <div className="mt-6 pt-4 border-t border-noir-gold">
            <AlertPreferences
              preferences={preferences}
              onPreferencesChange={handlePreferencesChange}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default UserAlerts
