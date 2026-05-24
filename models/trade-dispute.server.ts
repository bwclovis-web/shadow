import type {
  DisputeCategory,
  DisputeResolutionOutcome,
  DisputeStatus,
  Prisma,
} from "@prisma/client"

import { prisma } from "@/lib/db"
import { issueStrike } from "@/models/admin.server"
import { adminVoidTrade } from "@/models/trade.server"
import { sendDisputeResolutionEmail } from "@/utils/alert-email.server"
import { DISPUTE_CATEGORIES } from "@/utils/dispute-constants"

export { DISPUTE_CATEGORIES } from "@/utils/dispute-constants"

export const DISPUTE_STATUSES: DisputeStatus[] = [
  "open",
  "underReview",
  "resolved",
  "closed",
]

export const DISPUTE_RESOLUTION_OUTCOMES: DisputeResolutionOutcome[] = [
  "noAction",
  "warningIssued",
  "strikeIssued",
  "tradeVoided",
]

const ACTIVE_DISPUTE_STATUSES: DisputeStatus[] = ["open", "underReview"]

const TERMINAL_TRADE_STATUSES = ["declined", "cancelled"] as const

const disputeInclude = {
  trade: {
    select: {
      id: true,
      status: true,
      initiatorId: true,
      counterpartyId: true,
      lineItems: {
        select: {
          id: true,
          role: true,
          perfumeName: true,
        },
      },
    },
  },
  initiatedBy: {
    select: {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
    },
  },
  otherParty: {
    select: {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      strikeCount: true,
      isBanned: true,
    },
  },
} satisfies Prisma.TradeDisputeInclude

export type TradeDisputeWithRelations = Prisma.TradeDisputeGetPayload<{
  include: typeof disputeInclude
}>

const createAuditLog = async (
  adminId: string,
  resourceId: string,
  details: Record<string, unknown>
) => {
  await prisma.securityAuditLog.create({
    data: {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      userId: adminId,
      action: "DATA_MODIFICATION",
      severity: "info",
      resource: "TradeDispute",
      resourceId,
      details: details as Prisma.InputJsonValue,
    },
  })
}

export const createTradeDispute = async ({
  initiatedByUserId,
  tradeId,
  category,
  description,
  images,
}: {
  initiatedByUserId: string
  tradeId: string
  category: DisputeCategory
  description?: string | null
  images?: string[]
}): Promise<{ success: boolean; message: string; disputeId?: string }> => {
  if (!DISPUTE_CATEGORIES.includes(category)) {
    return { success: false, message: "Invalid dispute category" }
  }

  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    select: { id: true, status: true, initiatorId: true, counterpartyId: true },
  })

  if (!trade) {
    return { success: false, message: "Trade not found" }
  }

  const isParticipant =
    trade.initiatorId === initiatedByUserId ||
    trade.counterpartyId === initiatedByUserId

  if (!isParticipant) {
    return { success: false, message: "You are not part of this trade" }
  }

  if (TERMINAL_TRADE_STATUSES.includes(trade.status as (typeof TERMINAL_TRADE_STATUSES)[number])) {
    return {
      success: false,
      message: "Disputes cannot be opened on declined or cancelled trades",
    }
  }

  const otherPartyUserId =
    trade.initiatorId === initiatedByUserId
      ? trade.counterpartyId
      : trade.initiatorId

  const existingActive = await prisma.tradeDispute.findFirst({
    where: {
      tradeId,
      status: { in: ACTIVE_DISPUTE_STATUSES },
    },
    select: { id: true },
  })

  if (existingActive) {
    return {
      success: false,
      message: "A dispute is already open for this trade",
    }
  }

  const dispute = await prisma.tradeDispute.create({
    data: {
      tradeId,
      initiatedByUserId,
      otherPartyUserId,
      category,
      description: description?.trim() || null,
      images: images ?? [],
      status: "open",
    },
  })

  return {
    success: true,
    message: "Dispute submitted. Our team will review it.",
    disputeId: dispute.id,
  }
}

export const getDisputeByIdForParticipant = async (
  disputeId: string,
  userId: string
): Promise<TradeDisputeWithRelations | null> => {
  return prisma.tradeDispute.findFirst({
    where: {
      id: disputeId,
      OR: [{ initiatedByUserId: userId }, { otherPartyUserId: userId }],
    },
    include: disputeInclude,
  })
}

export const getActiveDisputeTradeIds = async (
  userId: string,
  tradeIds: string[]
): Promise<string[]> => {
  if (tradeIds.length === 0) return []

  const disputes = await prisma.tradeDispute.findMany({
    where: {
      tradeId: { in: tradeIds },
      status: { in: ACTIVE_DISPUTE_STATUSES },
      OR: [{ initiatedByUserId: userId }, { otherPartyUserId: userId }],
    },
    select: { tradeId: true },
  })

  return disputes.map((d) => d.tradeId)
}

export const getActiveDisputeForTrade = async (
  tradeId: string,
  userId: string
): Promise<Pick<TradeDisputeWithRelations, "id" | "status" | "initiatedByUserId"> | null> => {
  return prisma.tradeDispute.findFirst({
    where: {
      tradeId,
      status: { in: ACTIVE_DISPUTE_STATUSES },
      OR: [{ initiatedByUserId: userId }, { otherPartyUserId: userId }],
    },
    select: {
      id: true,
      status: true,
      initiatedByUserId: true,
    },
  })
}

export const getDisputesForAdmin = async (
  statusFilter: DisputeStatus | "all" = "open"
) => {
  return prisma.tradeDispute.findMany({
    where: statusFilter === "all" ? undefined : { status: statusFilter },
    include: disputeInclude,
    orderBy: { createdAt: "desc" },
  })
}

export const getDisputesForUser = async (userId: string) => {
  return prisma.tradeDispute.findMany({
    where: {
      OR: [{ initiatedByUserId: userId }, { otherPartyUserId: userId }],
    },
    include: {
      trade: { select: { id: true, status: true } },
      initiatedBy: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
        },
      },
      otherParty: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })
}

export const markDisputeUnderReview = async (
  disputeId: string,
  adminId: string
): Promise<{ success: boolean; message: string }> => {
  const dispute = await prisma.tradeDispute.findUnique({
    where: { id: disputeId },
    select: { id: true, status: true },
  })

  if (!dispute) {
    return { success: false, message: "Dispute not found" }
  }

  if (dispute.status !== "open" && dispute.status !== "underReview") {
    return { success: false, message: "Dispute is no longer active" }
  }

  await prisma.tradeDispute.update({
    where: { id: disputeId },
    data: { status: "underReview" },
  })

  await createAuditLog(adminId, disputeId, {
    action: "Dispute marked under review",
    previousStatus: dispute.status,
    newStatus: "underReview",
  })

  return { success: true, message: "Dispute marked under review" }
}

export const saveDisputeAdminNotes = async (
  disputeId: string,
  adminNotes: string,
  adminId: string
): Promise<{ success: boolean; message: string }> => {
  const dispute = await prisma.tradeDispute.findUnique({
    where: { id: disputeId },
    select: { id: true },
  })

  if (!dispute) {
    return { success: false, message: "Dispute not found" }
  }

  await prisma.tradeDispute.update({
    where: { id: disputeId },
    data: { adminNotes: adminNotes.trim() || null },
  })

  await createAuditLog(adminId, disputeId, {
    action: "Dispute admin notes updated",
  })

  return { success: true, message: "Notes saved" }
}

const notifyPartiesOfResolution = async (
  dispute: TradeDisputeWithRelations,
  outcome: DisputeResolutionOutcome,
  publicSummary: string | null
) => {
  const parties = [dispute.initiatedBy, dispute.otherParty]
  await Promise.all(
    parties.map((user) =>
      sendDisputeResolutionEmail({
        user,
        disputeId: dispute.id,
        tradeId: dispute.tradeId,
        outcome,
        publicSummary,
      })
    )
  )
}

export const resolveDispute = async ({
  disputeId,
  adminId,
  resolutionOutcome,
  publicSummary,
  strikeTargetUserId,
}: {
  disputeId: string
  adminId: string
  resolutionOutcome: DisputeResolutionOutcome
  publicSummary?: string | null
  strikeTargetUserId?: string
}): Promise<{ success: boolean; message: string }> => {
  if (!DISPUTE_RESOLUTION_OUTCOMES.includes(resolutionOutcome)) {
    return { success: false, message: "Invalid resolution outcome" }
  }

  const dispute = await prisma.tradeDispute.findUnique({
    where: { id: disputeId },
    include: disputeInclude,
  })

  if (!dispute) {
    return { success: false, message: "Dispute not found" }
  }

  if (dispute.status === "resolved" || dispute.status === "closed") {
    return { success: false, message: "Dispute is already closed" }
  }

  const trimmedSummary = publicSummary?.trim() || null
  const strikeUserId = strikeTargetUserId ?? dispute.otherPartyUserId

  if (resolutionOutcome === "strikeIssued") {
    const reason = `Trade dispute (${dispute.category}, #${dispute.id.slice(-8)})${trimmedSummary ? ` — ${trimmedSummary}` : ""}`
    const strikeResult = await issueStrike(strikeUserId, reason, adminId)
    if (!strikeResult.success) {
      return strikeResult
    }
  }

  if (resolutionOutcome === "warningIssued") {
    await createAuditLog(adminId, disputeId, {
      action: "Warning issued from dispute resolution",
      strikeTargetUserId: strikeUserId,
    })
  }

  if (resolutionOutcome === "tradeVoided") {
    try {
      await adminVoidTrade(dispute.tradeId, adminId, disputeId)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to void trade"
      return { success: false, message }
    }
  }

  await prisma.tradeDispute.update({
    where: { id: disputeId },
    data: {
      status: "resolved",
      resolutionOutcome,
      publicSummary: trimmedSummary,
      resolvedAt: new Date(),
      resolvedByAdminId: adminId,
    },
  })

  await createAuditLog(adminId, disputeId, {
    action: "Dispute resolved",
    resolutionOutcome,
    publicSummary: trimmedSummary,
  })

  const updated = await prisma.tradeDispute.findUnique({
    where: { id: disputeId },
    include: disputeInclude,
  })

  if (updated) {
    void notifyPartiesOfResolution(updated, resolutionOutcome, trimmedSummary)
  }

  return { success: true, message: "Dispute resolved and parties notified" }
}

export const withdrawDispute = async (
  disputeId: string,
  userId: string
): Promise<{ success: boolean; message: string }> => {
  const dispute = await prisma.tradeDispute.findFirst({
    where: { id: disputeId, initiatedByUserId: userId },
    select: { id: true, status: true },
  })

  if (!dispute) {
    return { success: false, message: "Dispute not found" }
  }

  if (dispute.status !== "open") {
    return {
      success: false,
      message: "Only open disputes can be withdrawn",
    }
  }

  await prisma.tradeDispute.update({
    where: { id: disputeId },
    data: { status: "closed" },
  })

  return { success: true, message: "Dispute withdrawn" }
}

export const buildStrikeReasonFromDispute = ({
  category,
  description,
  disputeId,
}: {
  category: DisputeCategory
  description: string | null
  disputeId: string
}): string => {
  const detail = description?.trim() ? ` — ${description.trim()}` : ""
  return `Trade dispute (${category}, #${disputeId.slice(-8)})${detail}`
}
