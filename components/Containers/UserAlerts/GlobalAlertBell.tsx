"use client"

import { AlertBell } from "./AlertBell"
import { useUserAlertsContext } from "@/components/Molecules/UserAlertsProvider/UserAlertsProvider"

type GlobalAlertBellProps = {
  userId: string
}

export const GlobalAlertBell = ({ userId }: GlobalAlertBellProps) => {
  const ctx = useUserAlertsContext()

  if (!ctx) return null

  const { alerts, unreadCount, handleMarkAsRead, handleDismissAlert } = ctx

  return (
    <AlertBell
      unreadCount={unreadCount}
      userId={userId}
      alerts={alerts}
      onMarkAsRead={handleMarkAsRead}
      onDismissAlert={handleDismissAlert}
    />
  )
}
