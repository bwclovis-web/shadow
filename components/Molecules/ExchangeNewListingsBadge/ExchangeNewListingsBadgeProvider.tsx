"use client"

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"
import { usePathname } from "next/navigation"

import { EXCHANGE_LAST_SEEN_STORAGE_KEY } from "@/constants/exchange"

const ExchangeNewListingsBadgeContext = createContext(0)

export const useExchangeNewListingsBadgeCount = (): number =>
  useContext(ExchangeNewListingsBadgeContext)

const isExchangePath = (pathname: string) =>
  pathname === "/the-exchange" || pathname.startsWith("/the-exchange/")

const readLastSeenAt = (): string | null => {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem(EXCHANGE_LAST_SEEN_STORAGE_KEY)
  } catch {
    return null
  }
}

const writeLastSeenAt = (iso: string) => {
  try {
    localStorage.setItem(EXCHANGE_LAST_SEEN_STORAGE_KEY, iso)
  } catch {
    // ignore quota / private mode
  }
}

type ExchangeNewListingsBadgeProviderProps = {
  initialCount: number
  children: ReactNode
}

export const ExchangeNewListingsBadgeProvider = ({
  initialCount,
  children,
}: ExchangeNewListingsBadgeProviderProps) => {
  // Always match SSR on first paint; localStorage is read in effects only.
  const [count, setCount] = useState(initialCount)
  const pathname = usePathname()

  const markExchangeSeen = useCallback(() => {
    writeLastSeenAt(new Date().toISOString())
    setCount(0)
  }, [])

  const refreshCount = useCallback(async () => {
    const lastSeen = readLastSeenAt()
    if (!lastSeen) {
      setCount(initialCount)
      return
    }

    const since = new Date(lastSeen)
    if (Number.isNaN(since.getTime())) {
      try {
        localStorage.removeItem(EXCHANGE_LAST_SEEN_STORAGE_KEY)
      } catch {
        // ignore
      }
      setCount(initialCount)
      return
    }

    try {
      const response = await fetch(
        `/api/exchange/new-listings-count?since=${encodeURIComponent(lastSeen)}`
      )
      if (response.ok) {
        const data: { count?: number } = await response.json()
        setCount(data.count ?? 0)
      }
    } catch {
      // keep previous count on network error
    }
  }, [initialCount])

  useEffect(() => {
    setCount(initialCount)
  }, [initialCount])

  useEffect(() => {
    if (isExchangePath(pathname)) {
      markExchangeSeen()
      return
    }
    void refreshCount()
  }, [pathname, initialCount, markExchangeSeen, refreshCount])

  return (
    <ExchangeNewListingsBadgeContext.Provider value={count}>
      {children}
    </ExchangeNewListingsBadgeContext.Provider>
  )
}
