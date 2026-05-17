"use client"

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react"

import { USER_ALERTS_REFRESH_EVENT } from "@/hooks/useUserAlerts"

const TradeAlertUnreadContext = createContext<number>(0)

export const useTradeAlertUnreadCount = (): number =>
  useContext(TradeAlertUnreadContext)

type TradeAlertUnreadProviderProps = {
  userId: string | null | undefined
  initialCount: number
  children: ReactNode
}

export const TradeAlertUnreadProvider = ({
  userId,
  initialCount,
  children,
}: TradeAlertUnreadProviderProps) => {
  const [count, setCount] = useState(initialCount)

  useEffect(() => {
    setCount(initialCount)
  }, [initialCount])

  useEffect(() => {
    if (!userId) return

    const poll = async () => {
      try {
        const response = await fetch(`/api/user-alerts/${userId}`)
        if (response.ok) {
          const data: { tradeUnreadCount?: number } = await response.json()
          setCount(data.tradeUnreadCount ?? 0)
        }
      } catch {
        // keep last known count
      }
    }

    void poll()
    const interval = setInterval(poll, 30_000)
    const onRefresh = () => void poll()
    window.addEventListener(USER_ALERTS_REFRESH_EVENT, onRefresh)
    return () => {
      clearInterval(interval)
      window.removeEventListener(USER_ALERTS_REFRESH_EVENT, onRefresh)
    }
  }, [userId])

  return (
    <TradeAlertUnreadContext.Provider value={count}>
      {children}
    </TradeAlertUnreadContext.Provider>
  )
}
