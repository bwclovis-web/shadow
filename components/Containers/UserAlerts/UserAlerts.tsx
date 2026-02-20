import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"

import { Button } from "~/components/Atoms/Button/Button"
import VooDooDetails from "~/components/Atoms/VooDooDetails/VooDooDetails"
import { useCSRF } from "~/hooks/useCSRF"
import type { UserAlert, UserAlertPreferences } from "~/types/database"

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
  const { t } = useTranslation()
  const [alerts, setAlerts] = useState<UserAlert[]>(initialAlerts)
  const [preferences, setPreferences] = useState<UserAlertPreferences | null>(initialPreferences || null)
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const [isLoading, setIsLoading] = useState(false)
  const { addToHeaders } = useCSRF()

  // Load preferences on mount if not provided
  useEffect(() => {
    if (!preferences && userId) {
      const loadPreferences = async () => {
        try {
          const response = await fetch(`/api/user-alerts/${userId}/preferences`, {
            headers: addToHeaders(),
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
    }
    // Only run when userId or initialPreferences change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, initialPreferences])

  // Real-time updates using polling (you could replace this with WebSocket/SSE later)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/user-alerts/${userId}`, {
          headers: addToHeaders(),
        })
        if (response.ok) {
          const data = await response.json()
          setAlerts(data.alerts || [])
          setUnreadCount(data.unreadCount || 0)
        }
      } catch (error) {
        console.error("Failed to fetch alerts:", error)
      }
    }, 30000) // Poll every 30 seconds

    return () => clearInterval(interval)
  }, [userId, addToHeaders])

  const handleMarkAsRead = async (alertId: string) => {
    try {
      const response = await fetch(`/api/user-alerts/${userId}/alert/${alertId}/read`, {
        method: "POST",
        headers: addToHeaders(),
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
    try {
      const response = await fetch(`/api/user-alerts/${userId}/alert/${alertId}/dismiss`, {
        method: "POST",
        headers: addToHeaders(),
      })

      if (response.ok) {
        setAlerts(prev => prev.filter(alert => alert.id !== alertId))
        setUnreadCount(prev => {
          const alert = alerts.find(a => a.id === alertId)
          return alert && !alert.isRead ? Math.max(0, prev - 1) : prev
        })
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
        headers: addToHeaders({
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
        <h2 className="text-2xl font-bold mb-2  text-noir-gold">{t("alerts.heading")}</h2>
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
          summary={`${t("alerts.heading", "My Alerts")} ${
            unreadCount > 0 ? `(${unreadCount} new)` : ""
          }`}
          className="text-start text-noir-gold"
          name="user-alerts"
        >
          <div className="space-y-4 p-4">
            <div className="flex flex-wrap gap-2 justify-between items-center">
              <div className="text-sm text-noir-gold-100">
                {alerts.length} {alerts.length === 1 ? t("alerts.alert", "alert") : t("alerts.alerts", "alerts")} •{" "}
                {unreadCount} {t("alerts.unread", "unread")}
              </div>
              <div className="flex gap-2">
                {alerts.length > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleDismissAll}
                    disabled={isLoading}
                  >
                    {isLoading ? t("alerts.dismissing", "Dismissing...") : t("alerts.dismissAll", "Dismiss All")}
                  </Button>
                )}
                <Link to="/the-exchange">
                  <Button variant="primary" size="sm">
                    {t("alerts.viewTradingPost", "View Trading Post")}
                  </Button>
                </Link>
              </div>
            </div>

            {/* Alert List */}
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-noir-gold text-lg">{t("alerts.noAlerts", "No alerts at the moment.")}</p>
                <p className="text-sm mt-2 text-noir-gold-100">
                  {t(
                    "alerts.noAlertsDescription",
                    "You'll receive alerts when items from your wishlist become available or when someone shows interest in your decants."
                  )}
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
