import { useState } from "react"
import { BsBell, BsX } from "react-icons/bs"

import { Button } from "~/components/Atoms/Button/Button"
import type { UserAlert } from "~/types/database"

import { AlertItem } from "./AlertItem"

interface AlertBellProps {
  unreadCount: number
  userId: string
  alerts: UserAlert[]
  onMarkAsRead: (alertId: string) => void
  onDismissAlert: (alertId: string) => void
}

export const AlertBell = ({
  unreadCount,
  userId,
  alerts,
  onMarkAsRead,
  onDismissAlert,
}: AlertBellProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const recentAlerts = alerts.slice(0, 5) // Show only 5 most recent

  return (
    <div className="relative text-noir-gold">
      {/* Bell Icon */}
      <Button
        variant="icon"
        size="lg"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 border-0"
        aria-label={`Notifications ${
          unreadCount > 0 ? `(${unreadCount} unread)` : ""
        }`}
      >
        <BsBell size={34} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
            role="button"
            tabIndex={0}
            onKeyDown={evt => {
              if (evt.key === "Enter" || evt.key === " ") {
                evt.preventDefault()
                setIsOpen(false)
              }
            }}
          />

          {/* Dropdown Content */}
          <div className="absolute right-0 top-full mt-2 w-80 bg-noir-light rounded-lg shadow-lg border border-noir-gold z-20 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between p-3 border-b border-noir-gray">
              <h3 className="font-semibold text-noir-gold">
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-2 text-sm text-noir-dark font-sans">
                    ({unreadCount} new)
                  </span>
                )}
              </h3>
              <Button
                variant="icon"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="p-1"
              >
                <BsX className="h-4 w-4 text-noir-dark" />
              </Button>
            </div>

            {/* Alert List */}
            <div className="max-h-64 overflow-y-auto">
              {recentAlerts.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <BsBell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {recentAlerts.map(alert => (
                    <div key={alert.id} className="p-3 hover:bg-gray-50">
                      <AlertItem
                        alert={alert}
                        onMarkAsRead={() => {
                          onMarkAsRead(alert.id)
                          if (!alert.isRead) {
                            // Close dropdown after marking as read if it was unread
                            setTimeout(() => setIsOpen(false), 1000)
                          }
                        }}
                        onDismiss={() => {
                          onDismissAlert(alert.id)
                          // Close dropdown after dismissing
                          setTimeout(() => setIsOpen(false), 500)
                        }}
                        compact={true}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {recentAlerts.length > 0 && (
              <div className="p-3 border-t border-gray-200 bg-gray-50">
                <p className="text-xs text-gray-600 text-center">
                  Showing {recentAlerts.length} of {alerts.length} alerts
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default AlertBell
