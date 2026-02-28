"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { BsBell, BsX } from "react-icons/bs"

import { Button } from "@/components/Atoms/Button/Button"
import type { UserAlert } from "@/types/database"

import { AlertItem } from "./AlertItem"

const RECENT_ALERTS_LIMIT = 5
const DROPDOWN_WIDTH = 320

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
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)

  const recentAlerts = alerts.slice(0, RECENT_ALERTS_LIMIT)

  const close = () => setIsOpen(false)

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return
    const updatePosition = () => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        setDropdownPosition({
          top: rect.bottom + 8,
          left: rect.right - DROPDOWN_WIDTH,
        })
      }
    }
    updatePosition()
    const handleResize = () => updatePosition()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [isOpen])

  const dropdownContent =
    typeof document !== "undefined" &&
    isOpen &&
    createPortal(
      <>
        <div
          className="fixed inset-0 z-40"
          onClick={close}
          onKeyDown={evt => {
            if (evt.key === "Enter" || evt.key === " ") {
              evt.preventDefault()
              close()
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Close notifications"
        />
        <div
          className="fixed w-80 bg-noir-light rounded-lg shadow-lg border border-noir-gold z-50 max-h-96 overflow-y-auto"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
          }}
          role="dialog"
          aria-label="Notifications"
        >
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
              onClick={close}
              className="p-1"
              aria-label="Close"
            >
              <BsX className="h-4 w-4 text-noir-dark" />
            </Button>
          </div>

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
                          setTimeout(close, 1000)
                        }
                      }}
                      onDismiss={() => {
                        onDismissAlert(alert.id)
                        setTimeout(close, 500)
                      }}
                      compact={true}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {recentAlerts.length > 0 && (
            <div className="p-3 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-600 text-center">
                Showing {recentAlerts.length} of {alerts.length} alerts
              </p>
            </div>
          )}
        </div>
      </>,
      document.body
    )

  return (
    <div className="relative text-noir-gold">
      <Button
        ref={triggerRef}
        variant="icon"
        size="lg"
        onClick={() => setIsOpen(prev => !prev)}
        className="relative p-2 border-0"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <BsBell size={34} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>
      {dropdownContent}
    </div>
  )
}

export default AlertBell
