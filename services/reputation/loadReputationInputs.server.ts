import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"

import type { ReputationMessageStatsInput } from "./computeReputation"
import { computeTraderReputationV1 } from "./computeReputation"
import type { TraderReputationV1 } from "./types"
import { FAST_RESPONDER_MAX_THREADS } from "./v1-constants"
import { getTraderTradeStats } from "./tradeStats.server"
import { getTraderFeedbackSummary } from "@/models/traderFeedback.server"

type MessageRow = {
  senderId: string
  recipientId: string
  createdAt: Date
}

const isMissingTableError = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021"

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2
  }
  return sorted[mid]!
}

type ThreadReplySample = {
  partnerId: string
  hours: number
  lastInboundAt: Date
}

/**
 * Median hours from first inbound contact to trader's first reply per counterparty,
 * limited to the last {@link FAST_RESPONDER_MAX_THREADS} conversation partners by
 * most recent inbound message. See docs/reputation-v1-spec.md.
 */
export function computeReplyStatsFromMessages(
  traderId: string,
  messages: MessageRow[]
): ReputationMessageStatsInput {
  const relevant = messages.filter(
    (m) => m.senderId === traderId || m.recipientId === traderId
  )
  const byPartner = new Map<string, MessageRow[]>()

  for (const m of relevant) {
    const partner = m.senderId === traderId ? m.recipientId : m.senderId
    const list = byPartner.get(partner)
    if (list) list.push(m)
    else byPartner.set(partner, [m])
  }

  const threadSamples: ThreadReplySample[] = []

  for (const [partnerId, rows] of byPartner) {
    const chronological = [...rows].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    )
    const firstInboundIdx = chronological.findIndex((m) => m.recipientId === traderId)
    if (firstInboundIdx < 0) continue
    const inbound = chronological[firstInboundIdx]!
    const afterInbound = chronological.slice(firstInboundIdx + 1)
    const reply = afterInbound.find(
      (m) => m.senderId === traderId && m.recipientId === partnerId
    )
    if (!reply) continue
    const hours =
      (reply.createdAt.getTime() - inbound.createdAt.getTime()) / (1000 * 60 * 60)
    if (hours >= 0 && Number.isFinite(hours)) {
      threadSamples.push({
        partnerId,
        hours,
        lastInboundAt: inbound.createdAt,
      })
    }
  }

  const recentThreads = [...threadSamples]
    .sort((a, b) => b.lastInboundAt.getTime() - a.lastInboundAt.getTime())
    .slice(0, FAST_RESPONDER_MAX_THREADS)

  const deltasHours = recentThreads.map((t) => t.hours).sort((a, b) => a - b)

  return {
    medianFirstReplyHours: median(deltasHours),
    replySampleCount: deltasHours.length,
  }
}

export async function loadTraderMessageReplyStats(
  traderId: string
): Promise<ReputationMessageStatsInput> {
  try {
    const messages = await prisma.traderContactMessage.findMany({
      where: {
        OR: [{ senderId: traderId }, { recipientId: traderId }],
      },
      select: {
        senderId: true,
        recipientId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    })
    return computeReplyStatsFromMessages(traderId, messages)
  } catch (error) {
    if (isMissingTableError(error)) {
      return { medianFirstReplyHours: null, replySampleCount: 0 }
    }
    throw error
  }
}

/**
 * Batch reputation for many traders: one message query, grouped processing.
 */
export async function loadTraderReputationsForUserIds(
  userIds: string[]
): Promise<Map<string, TraderReputationV1>> {
  const unique = [...new Set(userIds)].filter(Boolean)
  const result = new Map<string, TraderReputationV1>()

  if (unique.length === 0) return result

  const [summaries, tradeStatsList] = await Promise.all([
    Promise.all(unique.map((id) => getTraderFeedbackSummary(id))),
    Promise.all(unique.map((id) => getTraderTradeStats(id))),
  ])

  let messages: MessageRow[] = []
  try {
    messages = await prisma.traderContactMessage.findMany({
      where: {
        OR: [
          { senderId: { in: unique } },
          { recipientId: { in: unique } },
        ],
      },
      select: {
        senderId: true,
        recipientId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    })
  } catch (error) {
    if (!isMissingTableError(error)) throw error
  }

  const messagesByTrader = new Map<string, MessageRow[]>()
  for (const m of messages) {
    if (unique.includes(m.senderId)) {
      const list = messagesByTrader.get(m.senderId)
      if (list) list.push(m)
      else messagesByTrader.set(m.senderId, [m])
    }
    if (unique.includes(m.recipientId)) {
      const list = messagesByTrader.get(m.recipientId)
      if (list) list.push(m)
      else messagesByTrader.set(m.recipientId, [m])
    }
  }

  for (let i = 0; i < unique.length; i++) {
    const id = unique[i]!
    const summary = summaries[i]!
    const tradeStats = tradeStatsList[i]!
    const combinedMessages = messagesByTrader.get(id) ?? []
    const messageStats = computeReplyStatsFromMessages(id, combinedMessages)
    result.set(
      id,
      computeTraderReputationV1({
        feedback: {
          traderId: summary.traderId,
          averageRating: summary.averageRating,
          totalReviews: summary.totalReviews,
        },
        messageStats,
        tradeStats,
      })
    )
  }

  return result
}
