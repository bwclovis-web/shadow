import type { TradeForClient } from "@/types/trade"
import { getTraderDisplayName } from "@/utils/user"

export const getOtherTrader = (
  trade: TradeForClient,
  currentUserId: string
) =>
  trade.initiatorId === currentUserId ? trade.counterparty : trade.initiator

export const getOtherTraderName = (
  trade: TradeForClient,
  currentUserId: string
): string => getTraderDisplayName(getOtherTrader(trade, currentUserId))

const getCreatedAtTime = (trade: TradeForClient): number =>
  new Date(trade.createdAt).getTime()

const isOnOrAfterDay = (trade: TradeForClient, value: string): boolean => {
  const start = new Date(`${value}T00:00:00`)
  if (Number.isNaN(start.getTime())) return true
  return getCreatedAtTime(trade) >= start.getTime()
}

const isOnOrBeforeDay = (trade: TradeForClient, value: string): boolean => {
  const end = new Date(`${value}T23:59:59.999`)
  if (Number.isNaN(end.getTime())) return true
  return getCreatedAtTime(trade) <= end.getTime()
}

export const TRADE_DATE_FILTERS = {
  dateFrom: {
    predicate: (trade: TradeForClient, value: string) =>
      !value || isOnOrAfterDay(trade, value),
  },
  dateTo: {
    predicate: (trade: TradeForClient, value: string) =>
      !value || isOnOrBeforeDay(trade, value),
  },
} as const

export const filterTrades = (
  trades: TradeForClient[],
  userId: string,
  searchQuery: string,
  customFilterValues: Record<string, string>
): TradeForClient[] => {
  let filtered = [...trades]

  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    filtered = filtered.filter((trade) =>
      getOtherTraderName(trade, userId).toLowerCase().includes(q)
    )
  }

  for (const [key, config] of Object.entries(TRADE_DATE_FILTERS)) {
    const value = customFilterValues[key] ?? ""
    if (value) {
      filtered = filtered.filter((trade) => config.predicate(trade, value))
    }
  }

  return filtered
}
