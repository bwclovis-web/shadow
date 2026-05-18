import { TraderFeedbackHelpfulness, type Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"

export type HelpfulnessVoteValue = "helpful" | "unhelpful"

export type HelpfulnessAggregate = {
  helpfulCount: number
  unhelpfulCount: number
  viewerVote: HelpfulnessVoteValue | null
}

const toHelpfulnessEnum = (
  value: HelpfulnessVoteValue
): TraderFeedbackHelpfulness =>
  value === "helpful"
    ? TraderFeedbackHelpfulness.helpful
    : TraderFeedbackHelpfulness.unhelpful

const fromHelpfulnessEnum = (
  value: TraderFeedbackHelpfulness
): HelpfulnessVoteValue =>
  value === TraderFeedbackHelpfulness.helpful ? "helpful" : "unhelpful"

const assertCanVoteOnFeedback = (
  feedback: { traderId: string; reviewerId: string },
  voterId: string
): void => {
  if (voterId === feedback.reviewerId) {
    throw new Error("You cannot vote on your own review.")
  }
  if (voterId === feedback.traderId) {
    throw new Error("You cannot vote on reviews for your profile.")
  }
}

const adjustCounters = (
  tx: Prisma.TransactionClient,
  feedbackId: string,
  delta: { helpful: number; unhelpful: number }
) =>
  tx.traderFeedback.update({
    where: { id: feedbackId },
    data: {
      helpfulCount: { increment: delta.helpful },
      unhelpfulCount: { increment: delta.unhelpful },
    },
    select: {
      helpfulCount: true,
      unhelpfulCount: true,
    },
  })

export const upsertHelpfulnessVote = async (
  feedbackId: string,
  voterId: string,
  value: HelpfulnessVoteValue
): Promise<HelpfulnessAggregate> => {
  const feedback = await prisma.traderFeedback.findUnique({
    where: { id: feedbackId },
    select: { id: true, traderId: true, reviewerId: true },
  })

  if (!feedback) {
    throw new Error("Review not found.")
  }

  assertCanVoteOnFeedback(feedback, voterId)

  const enumValue = toHelpfulnessEnum(value)

  return prisma.$transaction(async (tx) => {
    const existing = await tx.traderFeedbackHelpfulnessVote.findUnique({
      where: {
        feedbackId_voterId: { feedbackId, voterId },
      },
    })

    if (existing?.value === enumValue) {
      await tx.traderFeedbackHelpfulnessVote.delete({
        where: { id: existing.id },
      })
      const delta =
        enumValue === TraderFeedbackHelpfulness.helpful
          ? { helpful: -1, unhelpful: 0 }
          : { helpful: 0, unhelpful: -1 }
      const updated = await adjustCounters(tx, feedbackId, delta)
      return {
        helpfulCount: updated.helpfulCount,
        unhelpfulCount: updated.unhelpfulCount,
        viewerVote: null,
      }
    }

    if (existing) {
      const oldDelta =
        existing.value === TraderFeedbackHelpfulness.helpful
          ? { helpful: -1, unhelpful: 0 }
          : { helpful: 0, unhelpful: -1 }
      await adjustCounters(tx, feedbackId, oldDelta)
    }

    await tx.traderFeedbackHelpfulnessVote.upsert({
      where: {
        feedbackId_voterId: { feedbackId, voterId },
      },
      create: {
        feedbackId,
        voterId,
        value: enumValue,
      },
      update: { value: enumValue },
    })

    const newDelta =
      enumValue === TraderFeedbackHelpfulness.helpful
        ? { helpful: 1, unhelpful: 0 }
        : { helpful: 0, unhelpful: 1 }
    const updated = await adjustCounters(tx, feedbackId, newDelta)

    return {
      helpfulCount: updated.helpfulCount,
      unhelpfulCount: updated.unhelpfulCount,
      viewerVote: value,
    }
  })
}

export const clearHelpfulnessVote = async (
  feedbackId: string,
  voterId: string
): Promise<HelpfulnessAggregate> => {
  const feedback = await prisma.traderFeedback.findUnique({
    where: { id: feedbackId },
    select: { id: true, traderId: true, reviewerId: true },
  })

  if (!feedback) {
    throw new Error("Review not found.")
  }

  assertCanVoteOnFeedback(feedback, voterId)

  return prisma.$transaction(async (tx) => {
    const existing = await tx.traderFeedbackHelpfulnessVote.findUnique({
      where: {
        feedbackId_voterId: { feedbackId, voterId },
      },
    })

    if (!existing) {
      const row = await tx.traderFeedback.findUnique({
        where: { id: feedbackId },
        select: { helpfulCount: true, unhelpfulCount: true },
      })
      return {
        helpfulCount: row?.helpfulCount ?? 0,
        unhelpfulCount: row?.unhelpfulCount ?? 0,
        viewerVote: null,
      }
    }

    await tx.traderFeedbackHelpfulnessVote.delete({
      where: { id: existing.id },
    })

    const delta =
      existing.value === TraderFeedbackHelpfulness.helpful
        ? { helpful: -1, unhelpful: 0 }
        : { helpful: 0, unhelpful: -1 }
    const updated = await adjustCounters(tx, feedbackId, delta)

    return {
      helpfulCount: updated.helpfulCount,
      unhelpfulCount: updated.unhelpfulCount,
      viewerVote: null,
    }
  })
}

export const getHelpfulnessAggregatesForFeedbackIds = async (
  feedbackIds: string[],
  viewerId?: string | null
): Promise<Map<string, HelpfulnessAggregate>> => {
  const result = new Map<string, HelpfulnessAggregate>()
  if (feedbackIds.length === 0) return result

  const rows = await prisma.traderFeedback.findMany({
    where: { id: { in: feedbackIds } },
    select: {
      id: true,
      helpfulCount: true,
      unhelpfulCount: true,
    },
  })

  let viewerVotes: { feedbackId: string; value: TraderFeedbackHelpfulness }[] =
    []
  if (viewerId) {
    viewerVotes = await prisma.traderFeedbackHelpfulnessVote.findMany({
      where: {
        feedbackId: { in: feedbackIds },
        voterId: viewerId,
      },
      select: { feedbackId: true, value: true },
    })
  }

  const viewerVoteByFeedbackId = new Map(
    viewerVotes.map((v) => [v.feedbackId, fromHelpfulnessEnum(v.value)])
  )

  for (const row of rows) {
    result.set(row.id, {
      helpfulCount: row.helpfulCount,
      unhelpfulCount: row.unhelpfulCount,
      viewerVote: viewerVoteByFeedbackId.get(row.id) ?? null,
    })
  }

  return result
}
