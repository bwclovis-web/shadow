"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { BsBell, BsX } from "react-icons/bs"

import { Button } from "@/components/Atoms/Button/Button"
import type { UserAlert } from "@/types/database"

import { AlertItem } from "./AlertItem"

const RECENT_ALERTS_LIMIT = 5
const DROPDOWN_WIDTH = 320
const DROPDOWN_EXIT_MS = 180
const ACTION_CLOSE_DELAY_MS = 720
const ALERT_ROW_EXIT_MS = 220
const UNREAD_FEEDBACK_MS = 700

interface AlertBellProps {
  unreadCount: number
  userId: string
  alerts: UserAlert[]
  onMarkAsRead: (alertId: string) => void
  onDismissAlert: (alertId: string) => void
}

export const AlertBell = ({
  unreadCount,
  userId: _userId,
  alerts,
  onMarkAsRead,
  onDismissAlert,
}: AlertBellProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [renderDropdown, setRenderDropdown] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const [bellIsAnimating, setBellIsAnimating] = useState(false)
  const [badgeIsAnimating, setBadgeIsAnimating] = useState(false)
  const [leavingAlertIds, setLeavingAlertIds] = useState<string[]>([])
  const [recentlyReadAlertIds, setRecentlyReadAlertIds] = useState<string[]>([])
  const triggerRef = useRef<HTMLButtonElement>(null)
  const previousUnreadCountRef = useRef(unreadCount)

  const leavingSet = new Set(leavingAlertIds)
  const recentAlerts = alerts.slice(0, RECENT_ALERTS_LIMIT)
  const activeAlertCount = alerts.filter(alert => !leavingSet.has(alert.id)).length
  const activeRecentCount = recentAlerts.filter(alert => !leavingSet.has(alert.id)).length

  const close = useCallback(() => {
    setIsOpen(false)
    setIsClosing(true)
  }, [])

  const open = useCallback(() => {
    setRenderDropdown(true)
    setIsClosing(false)

    if (typeof window === "undefined") {
      setIsOpen(true)
      return
    }

    window.requestAnimationFrame(() => {
      setIsOpen(true)
    })
  }, [])

  const toggleDropdown = useCallback(() => {
    if (isOpen && !isClosing) {
      close()
      return
    }

    open()
  }, [close, isClosing, isOpen, open])

  useEffect(() => {
    if (!isClosing) return

    const timeoutId = window.setTimeout(() => {
      setRenderDropdown(false)
      setIsClosing(false)
    }, DROPDOWN_EXIT_MS)

    return () => window.clearTimeout(timeoutId)
  }, [isClosing])

  useEffect(() => {
    const previousUnreadCount = previousUnreadCountRef.current

    if (unreadCount > previousUnreadCount) {
      setBellIsAnimating(true)
      setBadgeIsAnimating(true)

      const timeoutId = window.setTimeout(() => {
        setBellIsAnimating(false)
        setBadgeIsAnimating(false)
      }, UNREAD_FEEDBACK_MS)

      previousUnreadCountRef.current = unreadCount
      return () => window.clearTimeout(timeoutId)
    }

    previousUnreadCountRef.current = unreadCount
  }, [unreadCount])

  useLayoutEffect(() => {
    if (!renderDropdown || !triggerRef.current) return
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
    const handleScroll = () => updatePosition()
    window.addEventListener("resize", handleResize)
    window.addEventListener("scroll", handleScroll, true)
    return () => {
      window.removeEventListener("resize", handleResize)
      window.removeEventListener("scroll", handleScroll, true)
    }
  }, [renderDropdown])

  useEffect(() => {
    if (!renderDropdown) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [close, renderDropdown])

  const handleMarkAlertAsRead = useCallback(
    (alert: UserAlert) => {
      if (alert.isRead) return

      let addedHighlight = false
      setRecentlyReadAlertIds(prev => {
        if (prev.includes(alert.id)) return prev
        addedHighlight = true
        return [...prev, alert.id]
      })

      if (!addedHighlight) return

      onMarkAsRead(alert.id)

      window.setTimeout(() => {
        setRecentlyReadAlertIds(prev => prev.filter(id => id !== alert.id))
      }, UNREAD_FEEDBACK_MS)

      window.setTimeout(() => {
        close()
      }, ACTION_CLOSE_DELAY_MS)
    },
    [close, onMarkAsRead]
  )

  const handleDismiss = useCallback(
    (alert: UserAlert) => {
      let isNewDismissal = false
      setLeavingAlertIds(prev => {
        if (prev.includes(alert.id)) return prev
        isNewDismissal = true
        return [...prev, alert.id]
      })

      if (!isNewDismissal) return

      onDismissAlert(alert.id)

      window.setTimeout(() => {
        setLeavingAlertIds(prev => prev.filter(id => id !== alert.id))
      }, ALERT_ROW_EXIT_MS)

      window.setTimeout(() => {
        close()
      }, ALERT_ROW_EXIT_MS + 60)
    },
    [close, onDismissAlert]
  )

  const dropdownContent =
    typeof document !== "undefined" &&
    renderDropdown &&
    createPortal(
      <>
        <div
          className={`fixed inset-0 z-40 transition-opacity duration-150 ${
            isOpen ? "opacity-100" : "opacity-0"
          }`}
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
          className={`fixed w-80 bg-noir-dark shadow-2xl shadow-noir-black rounded-lg border border-noir-gold z-50 max-h-96 overflow-y-auto origin-top-right transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
            isOpen
              ? "opacity-100 translate-y-0 scale-100"
              : "pointer-events-none opacity-0 -translate-y-2 scale-95"
          }`}
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            transformOrigin: "top right",
          }}
          role="dialog"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between p-3 border-b border-noir-gold-500/40">
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
              <BsX className="h-4 w-4 text-noir-dark bg-noir-gold-500" />
            </Button>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {recentAlerts.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <BsBell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-noir-gold-500">
                {recentAlerts.map(alert => (
                  <div key={alert.id}>
                    <AlertItem
                      alert={alert}
                      onMarkAsRead={() => handleMarkAlertAsRead(alert)}
                      onDismiss={() => handleDismiss(alert)}
                      compact={true}
                      isLeaving={leavingAlertIds.includes(alert.id)}
                      isReadTransitioning={recentlyReadAlertIds.includes(alert.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {activeRecentCount > 0 && (
            <div className="p-3 border-t border-noir-gold bg-noir-gold-100">
              <p className="text-xs text-noir-dark text-center">
                Showing {activeRecentCount} of {activeAlertCount} alerts
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
        onClick={toggleDropdown}
        className="relative p-2 border-0"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <BsBell
          size={34}
          className={bellIsAnimating ? "motion-safe:animate-bell-nudge" : undefined}
        />
        {unreadCount > 0 && (
          <span
            className={`absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center ${
              badgeIsAnimating ? "motion-safe:animate-badge-pop" : ""
            }`}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>
      {dropdownContent}
    </div>
  )
}
