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
const TradeAlertUnreadContext = createContext(0)
const DirectMessageUnreadContext = createContext(0)

export const useUserAlertsContext = (): UserAlertsContextValue =>
  useContext(UserAlertsContext)

export const useTradeAlertUnreadCount = (): number =>
  useContext(TradeAlertUnreadContext)

export const useDirectMessageUnreadCount = (): number =>
  useContext(DirectMessageUnreadContext)

export { dispatchUserAlertsRefresh }

type UserAlertsProviderProps = {
  userId: string | null | undefined
  initialAlerts?: Awaited<ReturnType<typeof getUserAlerts>>
  initialUnreadCount?: number
  initialTradeUnreadCount?: number
  initialDirectMessageUnreadCount?: number
  children: ReactNode
}

export const UserAlertsProvider = ({
  userId,
  initialAlerts = [],
  initialUnreadCount = 0,
  initialTradeUnreadCount = 0,
  initialDirectMessageUnreadCount = 0,
  children,
}: UserAlertsProviderProps) => {
  const value = useUserAlerts({
    userId: userId ?? "",
    initialAlerts: initialAlerts as UserAlert[],
    initialUnreadCount,
    initialTradeUnreadCount,
    initialDirectMessageUnreadCount,
  })

  if (!userId) {
    return <>{children}</>
  }

  return (
    <DirectMessageUnreadContext.Provider value={value.directMessageUnreadCount}>
      <TradeAlertUnreadContext.Provider value={value.tradeUnreadCount}>
        <UserAlertsContext.Provider value={value}>
          {children}
        </UserAlertsContext.Provider>
      </TradeAlertUnreadContext.Provider>
    </DirectMessageUnreadContext.Provider>
  )
}
