import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"

export interface TraderTradeStats {
  completedCount: number
  cancelledByTraderCount: number
  /** completed / (completed + cancelled-by-trader); null when denominator is 0 */
  tradeReliabilityPercent: number | null
}

const isMissingTableError = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021"

const emptyStats = (): TraderTradeStats => ({
  completedCount: 0,
  cancelledByTraderCount: 0,
  tradeReliabilityPercent: null,
})

/**
 * Trade reliability: completed / (completed + cancelled-by-this-trader).
 * "Cancelled by them" uses TradeEvent type `cancelled` with actorUserId = trader.
 */
export const getTraderTradeStats = async (
  traderId: string
): Promise<TraderTradeStats> => {
  try {
    const [completedCount, cancelledByTraderCount] = await Promise.all([
      prisma.trade.count({
        where: {
          status: "completed",
          OR: [{ initiatorId: traderId }, { counterpartyId: traderId }],
        },
      }),
      prisma.trade.count({
        where: {
          status: "cancelled",
          OR: [{ initiatorId: traderId }, { counterpartyId: traderId }],
          events: {
            some: {
              type: "cancelled",
              actorUserId: traderId,
            },
          },
        },
      }),
    ])

    const denominator = completedCount + cancelledByTraderCount
    const tradeReliabilityPercent =
      denominator > 0
        ? Math.round((completedCount / denominator) * 100)
        : null

    return {
      completedCount,
      cancelledByTraderCount,
      tradeReliabilityPercent,
    }
  } catch (error) {
    if (isMissingTableError(error)) {
      return emptyStats()
    }
    throw error
  }
}
