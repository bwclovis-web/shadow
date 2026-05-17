"use client"

import { createContext, type ReactNode, useContext } from "react"

import {
  dispatchUserAlertsRefresh,
  useUserAlerts,
} from "@/hooks/useUserAlerts"
import { getUserAlerts } from "@/models/user-alerts.server"
import type { UserAlert } from "@/types/database"

type UserAlertsContextValue = ReturnType<typeof useUserAlerts> | null

const UserAlertsContext = createContext<UserAlertsContextValue>(null)

export const useUserAlertsContext = (): UserAlertsContextValue =>
  useContext(UserAlertsContext)

export { dispatchUserAlertsRefresh }

type UserAlertsProviderProps = {
  userId: string | null | undefined
  initialAlerts?: Awaited<ReturnType<typeof getUserAlerts>>
  initialUnreadCount?: number
  children: ReactNode
}

export const UserAlertsProvider = ({
  userId,
  initialAlerts = [],
  initialUnreadCount = 0,
  children,
}: UserAlertsProviderProps) => {
  const value = useUserAlerts({
    userId: userId ?? "",
    initialAlerts: initialAlerts as UserAlert[],
    initialUnreadCount,
  })

  if (!userId) {
    return <>{children}</>
  }

  return (
    <UserAlertsContext.Provider value={value}>{children}</UserAlertsContext.Provider>
  )
}
