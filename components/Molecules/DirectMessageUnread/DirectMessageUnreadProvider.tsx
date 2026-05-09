"use client"

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react"

const DirectMessageUnreadContext = createContext<number>(0)

export const useDirectMessageUnreadCount = (): number =>
  useContext(DirectMessageUnreadContext)

type DirectMessageUnreadProviderProps = {
  userId: string | null | undefined
  initialCount: number
  children: ReactNode
}

export const DirectMessageUnreadProvider = ({
  userId,
  initialCount,
  children,
}: DirectMessageUnreadProviderProps) => {
  const [count, setCount] = useState(initialCount)

  useEffect(() => {
    setCount(initialCount)
  }, [initialCount])

  useEffect(() => {
    if (!userId) return

    const poll = async () => {
      try {
        const response = await fetch("/api/messages?unreadCountOnly=1")
        if (response.ok) {
          const data: { unreadCount?: number } = await response.json()
          setCount(data.unreadCount ?? 0)
        }
      } catch {
        // ignore network errors; SSR value stays until next success
      }
    }

    void poll()
    const interval = setInterval(poll, 30_000)
    return () => clearInterval(interval)
  }, [userId])

  return (
    <DirectMessageUnreadContext.Provider value={count}>
      {children}
    </DirectMessageUnreadContext.Provider>
  )
}
