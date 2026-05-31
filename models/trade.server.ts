import { type Prisma, type TradeStatus, TradeLineItemRole } from "@prisma/client"

import { prisma } from "@/lib/db"
import { createContactMessage } from "@/models/contactMessage.server"
import { touchUserLastActive } from "@/models/user-activity.server"
import {
  createUserAlert,
  dispatchPushForUserAlert,
  getUserAlertPreferences,
} from "@/models/user-alerts.server"
import { sendTradeEventEmail } from "@/utils/alert-email.server"
import type { TradeForClient, TradeLineItemInput } from "@/types/trade"
import type { AlertType } from "@/types/database"
import { getAlertsTranslator } from "@/lib/i18n/alerts-translator.server"
import { getUserDisplayName } from "@/utils/user"

const ACTIVE_TRADE_STATUSES: TradeStatus[] = [
  "draft",
  "pending",
  "accepted",
  "shipped",
  "received",
]

const TERMINAL_TRADE_STATUSES: TradeStatus[] = [
  "completed",
  "declined",
  "cancelled",
]

const tradeInclude = {
  lineItems: {
    include: {
      userPerfume: {
        select: {
          perfume: {
            select: { id: true, slug: true, image: true },
          },
        },
      },
    },
  },
  initiator: {
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      avatarImage: true,
    },
  },
  counterparty: {
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      avatarImage: true,
    },
  },
} satisfies Prisma.TradeInclude

type TradeWithRelations = Prisma.TradeGetPayload<{ include: typeof tradeInclude }>

const parseMlSnapshot = (
  available: string,
  mlRemaining: number | null | undefined
): number | null => {
  if (mlRemaining != null && Number.isFinite(mlRemaining)) return mlRemaining
  const n = Number.parseFloat(String(available).trim())
  return Number.isFinite(n) ? n : null
}

const serializeTrade = (trade: TradeWithRelations): TradeForClient => ({
  id: trade.id,
  initiatorId: trade.initiatorId,
  counterpartyId: trade.counterpartyId,
  status: trade.status,
  notes: trade.notes,
  createdAt: trade.createdAt.toISOString(),
  updatedAt: trade.updatedAt.toISOString(),
  lineItems: trade.lineItems.map(li => ({
    id: li.id,
    userPerfumeId: li.userPerfumeId,
    role: li.role,
    perfumeName: li.perfumeName,
    perfumeId: li.userPerfume?.perfume?.id ?? null,
    perfumeSlug: li.userPerfume?.perfume?.slug ?? null,
    perfumeImage: li.userPerfume?.perfume?.image ?? null,
    mlSnapshot: li.mlSnapshot,
    conditionSnapshot: li.conditionSnapshot,
  })),
  initiator: trade.initiator,
  counterparty: trade.counterparty,
})

const TRANSITION_MAP: Record<
  string,
  { from: TradeStatus[]; to: TradeStatus; eventType: string; alertType?: AlertType }
> = {
  submit: { from: ["draft"], to: "pending", eventType: "submitted", alertType: "trade_received" },
  accept: { from: ["pending"], to: "accepted", eventType: "accepted", alertType: "trade_accepted" },
  decline: { from: ["pending"], to: "declined", eventType: "declined", alertType: "trade_cancelled" },
  ship: { from: ["accepted"], to: "shipped", eventType: "shipped", alertType: "trade_shipped" },
  receive: { from: ["shipped"], to: "received", eventType: "received" },
  complete: { from: ["received"], to: "completed", eventType: "completed", alertType: "trade_completed" },
  cancel: {
    from: ["draft", "pending", "accepted"],
    to: "cancelled",
    eventType: "cancelled",
    alertType: "trade_cancelled",
  },
}

const getAlertRecipientForTransition = (
  action: string,
  trade: TradeWithRelations,
  actorUserId: string
): string | null => {
  if (action === "submit") return trade.counterpartyId
  if (action === "accept" || action === "decline") {
    return actorUserId === trade.counterpartyId ? trade.initiatorId : trade.counterpartyId
  }
  if (action === "ship" || action === "receive" || action === "complete" || action === "cancel") {
    return actorUserId === trade.initiatorId ? trade.counterpartyId : trade.initiatorId
  }
  return null
}

const appendTradeEvent = async (
  tx: Prisma.TransactionClient,
  tradeId: string,
  action: string,
  actorUserId: string,
  metadata?: Record<string, unknown>
) => {
  const rule = TRANSITION_MAP[action]
  if (!rule) throw new Error("Invalid transition")

  await tx.tradeEvent.create({
    data: {
      tradeId,
      type: rule.eventType,
      actorUserId,
      metadata: metadata as Prisma.InputJsonValue,
    },
  })
}

const sendTradeAlert = async (
  trade: TradeWithRelations,
  action: string,
  actorUserId: string
) => {
  const rule = TRANSITION_MAP[action]
  if (!rule?.alertType) return

  const recipientId = getAlertRecipientForTransition(action, trade, actorUserId)
  if (!recipientId) return

  const actor =
    actorUserId === trade.initiator.id ? trade.initiator : trade.counterparty
  const actorName = getUserDisplayName(actor)
  const requested = trade.lineItems.find(li => li.role === TradeLineItemRole.requested)
  const perfumeLabel = requested?.perfumeName ?? "a listing"
  const t = await getAlertsTranslator()

  const titles: Partial<Record<AlertType, string>> = {
    trade_received: t("titles.trade_received", { actorName }),
    trade_accepted: t("titles.trade_accepted", { actorName }),
    trade_shipped: t("titles.trade_shipped", { actorName }),
    trade_completed: t("titles.trade_completed", { actorName }),
    trade_cancelled:
      action === "decline"
        ? t("titles.trade_cancelled_declined", { actorName })
        : t("titles.trade_cancelled_cancelled", { actorName }),
  }

  const title = titles[rule.alertType] ?? t("titles.trade_update_fallback", { actorName })
  const message = `Regarding ${perfumeLabel}`

  const metadata = { tradeId: trade.id, action, actorUserId, senderId: actorUserId }
  await createUserAlert(recipientId, null, rule.alertType, title, message, metadata)
  dispatchPushForUserAlert({
    userId: recipientId,
    alertType: rule.alertType,
    title,
    message,
    metadata,
  })

  const [recipient, preferences] = await Promise.all([
    prisma.user.findUnique({
      where: { id: recipientId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        username: true,
        profileSlug: true,
      },
    }),
    getUserAlertPreferences(recipientId),
  ])

  if (recipient) {
    try {
      await sendTradeEventEmail({
        user: recipient,
        preferences,
        alertType: rule.alertType,
        title,
        message,
        actorUserId,
      })
    } catch (err) {
      console.error("[email] Failed to send trade event email:", err)
    }
  }

  if (rule.alertType === "trade_completed") {
    const { notifyFollowersOfCompletedTrade } = await import("@/models/follow-alerts.server")
    void notifyFollowersOfCompletedTrade({
      tradeId: trade.id,
      initiatorId: trade.initiatorId,
      counterpartyId: trade.counterpartyId,
      perfumeLabel,
    }).catch(err => console.error("[follow-alerts] trade notify failed:", err))
  }
}

const sendTradeAlertWithFallback = async (
  trade: TradeWithRelations,
  action: string,
  actorUserId: string
) => {
  try {
    await sendTradeAlert(trade, action, actorUserId)
  } catch (error) {
    console.error("trade alert failed, falling back to new_trader_message:", error)
    if (action !== "submit") return

    const actor =
      actorUserId === trade.initiator.id ? trade.initiator : trade.counterparty
    const actorName = getUserDisplayName(actor)
    const requested = trade.lineItems.find(li => li.role === TradeLineItemRole.requested)
    const perfumeLabel = requested?.perfumeName ?? "a listing"

    await createUserAlert(
      trade.counterpartyId,
      null,
      "new_trader_message",
      `New message from ${actorName}`,
      `Trade offer: ${perfumeLabel}`,
      { tradeId: trade.id, senderId: actorUserId }
    )
  }
}

const notifyTradeSubmittedInThread = async (
  trade: TradeWithRelations,
  initiatorId: string,
  notes?: string
) => {
  const requested = trade.lineItems.find(li => li.role === TradeLineItemRole.requested)
  const perfumeLabel = requested?.perfumeName ?? "this listing"
  const body =
    notes?.trim() ||
    `I'd like to propose a trade for ${perfumeLabel}. Open our conversation to review the offer details.`

  await createContactMessage({
    senderId: initiatorId,
    recipientId: trade.counterpartyId,
    subject: `Trade offer: ${perfumeLabel}`,
    message: body,
    tradeId: trade.id,
  })
}

const validateLineItems = async (
  initiatorId: string,
  counterpartyId: string,
  lineItems: TradeLineItemInput[]
) => {
  const requested = lineItems.filter(li => li.role === "requested")
  const offered = lineItems.filter(li => li.role === "offered")

  if (requested.length < 1) {
    throw new Error("At least one requested listing is required")
  }

  const ids = lineItems.map(li => li.userPerfumeId)
  const listings = await prisma.userPerfume.findMany({
    where: { id: { in: ids } },
    include: {
      perfume: { select: { name: true } },
    },
  })

  if (listings.length !== ids.length) {
    throw new Error("One or more listings were not found")
  }

  const byId = new Map(listings.map(l => [l.id, l]))

  for (const item of requested) {
    const listing = byId.get(item.userPerfumeId)
    if (!listing) throw new Error("Requested listing not found")
    if (listing.userId !== counterpartyId) {
      throw new Error("Requested listing does not belong to the counterparty")
    }
    if (listing.available === "0") {
      throw new Error("Requested listing is no longer available")
    }
  }

  for (const item of offered) {
    const listing = byId.get(item.userPerfumeId)
    if (!listing) throw new Error("Offered listing not found")
    if (listing.userId !== initiatorId) {
      throw new Error("Offered listing does not belong to you")
    }
    if (listing.available === "0") {
      throw new Error("Offered listing is no longer available")
    }
  }

  return { listings, byId, requested, offered }
}

const assertNoDuplicateActiveTrade = async (
  initiatorId: string,
  counterpartyId: string,
  requestedUserPerfumeIds: string[]
) => {
  const existing = await prisma.trade.findFirst({
    where: {
      initiatorId,
      counterpartyId,
      status: { in: ACTIVE_TRADE_STATUSES },
      lineItems: {
        some: {
          userPerfumeId: { in: requestedUserPerfumeIds },
          role: TradeLineItemRole.requested,
        },
      },
    },
    select: { id: true },
  })
  if (existing) {
    throw new Error("You already have an active trade for this listing with this trader")
  }
}

export type CreateTradeInput = {
  initiatorId: string
  counterpartyId: string
  notes?: string
  lineItems: TradeLineItemInput[]
  submit?: boolean
}

export const createTrade = async (input: CreateTradeInput): Promise<TradeForClient> => {
  const { initiatorId, counterpartyId, notes, lineItems, submit } = input

  if (initiatorId === counterpartyId) {
    throw new Error("Cannot create a exchange with yourself")
  }

  const [initiator, counterparty] = await Promise.all([
    prisma.user.findUnique({ where: { id: initiatorId }, select: { id: true, isBanned: true } }),
    prisma.user.findUnique({ where: { id: counterpartyId }, select: { id: true, isBanned: true } }),
  ])

  if (!initiator || !counterparty) {
    throw new Error("Trader not found")
  }
  if (initiator.isBanned || counterparty.isBanned) {
    throw new Error("Cannot exchange with a suspended account")
  }

  const { byId, requested } = await validateLineItems(initiatorId, counterpartyId, lineItems)

  await assertNoDuplicateActiveTrade(
    initiatorId,
    counterpartyId,
    requested.map(r => r.userPerfumeId)
  )

  const trade = await prisma.$transaction(async tx => {
    const created = await tx.trade.create({
      data: {
        initiatorId,
        counterpartyId,
        status: "draft",
        notes: notes ?? null,
        lineItems: {
          create: lineItems.map(item => {
            const listing = byId.get(item.userPerfumeId)!
            return {
              userPerfumeId: item.userPerfumeId,
              role: item.role as TradeLineItemRole,
              perfumeName: listing.perfume.name,
              mlSnapshot: parseMlSnapshot(listing.available, listing.mlRemaining),
              conditionSnapshot: listing.condition,
            }
          }),
        },
      },
      include: tradeInclude,
    })

    await tx.tradeEvent.create({
      data: {
        tradeId: created.id,
        type: "created",
        actorUserId: initiatorId,
        metadata: { submit: Boolean(submit) },
      },
    })

    if (submit) {
      const pending = await tx.trade.update({
        where: { id: created.id },
        data: { status: "pending" },
        include: tradeInclude,
      })
      await appendTradeEvent(tx, pending.id, "submit", initiatorId)
      return pending
    }

    return created
  })

  if (submit) {
    await sendTradeAlertWithFallback(trade, "submit", initiatorId)
    await notifyTradeSubmittedInThread(trade, initiatorId, notes)
  }

  void touchUserLastActive(initiatorId)

  return serializeTrade(trade)
}

export type TransitionTradeInput = {
  tradeId: string
  actorUserId: string
  action: keyof typeof TRANSITION_MAP
  metadata?: Record<string, unknown>
}

export const transitionTrade = async (
  input: TransitionTradeInput
): Promise<TradeForClient> => {
  const { tradeId, actorUserId, action, metadata } = input
  const rule = TRANSITION_MAP[action]
  if (!rule) throw new Error("Invalid transition")

  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    include: tradeInclude,
  })

  if (!trade) throw new Error("Trade not found")

  const isParticipant =
    actorUserId === trade.initiatorId || actorUserId === trade.counterpartyId
  if (!isParticipant) throw new Error("Not authorized for this trade")

  if (action === "accept" || action === "decline") {
    if (actorUserId !== trade.counterpartyId) {
      throw new Error("Only the counterparty can accept or decline this offer")
    }
  }

  if (action === "submit" && actorUserId !== trade.initiatorId) {
    throw new Error("Only the initiator can submit this trade")
  }

  if (!rule.from.includes(trade.status)) {
    throw new Error(`Cannot ${action} a trade in status ${trade.status}`)
  }

  const updated = await prisma.$transaction(async tx => {
    const next = await tx.trade.update({
      where: { id: tradeId },
      data: { status: rule.to },
      include: tradeInclude,
    })

    await appendTradeEvent(tx, next.id, action, actorUserId, metadata)

    return next
  })

  await sendTradeAlertWithFallback(updated, action, actorUserId)

  void touchUserLastActive(actorUserId)

  return serializeTrade(updated)
}

const ADMIN_VOIDABLE_STATUSES: TradeStatus[] = [
  "draft",
  "pending",
  "accepted",
  "shipped",
  "received",
  "completed",
]

export const adminVoidTrade = async (
  tradeId: string,
  adminUserId: string,
  disputeId?: string
): Promise<TradeForClient> => {
  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    include: tradeInclude,
  })

  if (!trade) throw new Error("Trade not found")

  if (trade.status === "cancelled" || trade.status === "declined") {
    return serializeTrade(trade)
  }

  if (!ADMIN_VOIDABLE_STATUSES.includes(trade.status)) {
    throw new Error(`Cannot void trade in status ${trade.status}`)
  }

  const metadata: Record<string, unknown> = {
    adminVoid: true,
    adminUserId,
    ...(disputeId ? { disputeId } : {}),
  }

  const updated = await prisma.$transaction(async tx => {
    const next = await tx.trade.update({
      where: { id: tradeId },
      data: { status: "cancelled" },
      include: tradeInclude,
    })

    await tx.tradeEvent.create({
      data: {
        tradeId,
        type: "admin_voided",
        actorUserId: adminUserId,
        metadata: metadata as Prisma.InputJsonValue,
      },
    })

    return next
  })

  return serializeTrade(updated)
}

export const getTradeByIdForParticipant = async (
  tradeId: string,
  userId: string
): Promise<TradeForClient | null> => getTradeByIdForViewer(tradeId, userId)

export const getTradeByIdForViewer = async (
  tradeId: string,
  viewerId: string,
  options?: { viewerRole?: string }
): Promise<TradeForClient | null> => {
  const isAdmin = options?.viewerRole === "admin"
  const trade = await prisma.trade.findFirst({
    where: isAdmin
      ? { id: tradeId }
      : {
          id: tradeId,
          OR: [{ initiatorId: viewerId }, { counterpartyId: viewerId }],
        },
    include: tradeInclude,
  })
  return trade ? serializeTrade(trade) : null
}

export const getActiveTradesForThread = async (
  userId: string,
  otherUserId: string
): Promise<TradeForClient[]> => {
  const trades = await prisma.trade.findMany({
    where: {
      status: { in: ACTIVE_TRADE_STATUSES },
      OR: [
        { initiatorId: userId, counterpartyId: otherUserId },
        { initiatorId: otherUserId, counterpartyId: userId },
      ],
    },
    include: tradeInclude,
    orderBy: { updatedAt: "desc" },
  })
  return trades.map(serializeTrade)
}

type GetTradesForUserProfileOptions = {
  limit?: number | null
}

export const getTradesForUserProfile = async (
  profileUserId: string,
  viewerId: string | null,
  mode: "active" | "history",
  options: GetTradesForUserProfileOptions = {}
): Promise<TradeForClient[]> => {
  const { limit = 50 } = options
  if (mode === "active" && !viewerId) return []

  if (mode === "history" && !viewerId) return []

  const statuses =
    mode === "active" ? ACTIVE_TRADE_STATUSES : TERMINAL_TRADE_STATUSES

  const participantWhere: Prisma.TradeWhereInput =
    viewerId === profileUserId
      ? {
          OR: [
            { initiatorId: profileUserId },
            { counterpartyId: profileUserId },
          ],
        }
      : {
          OR: [
            {
              initiatorId: profileUserId,
              counterpartyId: viewerId as string,
            },
            {
              initiatorId: viewerId as string,
              counterpartyId: profileUserId,
            },
          ],
        }

  const trades = await prisma.trade.findMany({
    where: {
      status: { in: statuses },
      ...participantWhere,
    },
    include: tradeInclude,
    orderBy: { updatedAt: "desc" },
    ...(limit != null ? { take: limit } : {}),
  })

  return trades.map(serializeTrade)
}

export const getInitiatorOfferableListings = async (initiatorId: string) => {
  return prisma.userPerfume.findMany({
    where: {
      userId: initiatorId,
      available: { not: "0" },
    },
    select: {
      id: true,
      userId: true,
      perfumeId: true,
      available: true,
      amount: true,
      price: true,
      tradePrice: true,
      tradePreference: true,
      tradeOnly: true,
      type: true,
      images: true,
      condition: true,
      decantFormat: true,
      mlRemaining: true,
      perfume: {
        select: {
          id: true,
          name: true,
          slug: true,
          image: true,
          perfumeHouse: {
            select: { id: true, name: true, slug: true },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  })
}

export const getActiveTradeFlagsByOtherUserId = async (
  userId: string
): Promise<Record<string, boolean>> => {
  const trades = await prisma.trade.findMany({
    where: {
      status: { in: ACTIVE_TRADE_STATUSES },
      OR: [{ initiatorId: userId }, { counterpartyId: userId }],
    },
    select: { initiatorId: true, counterpartyId: true },
  })

  const flags: Record<string, boolean> = {}
  for (const t of trades) {
    const other = t.initiatorId === userId ? t.counterpartyId : t.initiatorId
    flags[other] = true
  }
  return flags
}
