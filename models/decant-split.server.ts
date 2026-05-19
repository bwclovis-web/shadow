import {
  type DecantFormat,
  type DecantSplitStatus,
  type ListingCondition,
  type Prisma,
} from "@prisma/client"

import { prisma } from "@/lib/db"
import {
  ACTIVE_DECANT_SPLIT_STATUSES,
  computePourableMlBudget,
  sumListedMlForPerfume,
  sumOwnedMlForPerfume,
} from "@/lib/decant-split-ml"
import {
  createUserAlert,
  dispatchPushForUserAlert,
  getUserAlertPreferences,
} from "@/models/user-alerts.server"
import type {
  CreateDecantSplitInput,
  DecantSplitForClient,
  OpenSplitChip,
  PourableMlBudgetForClient,
} from "@/types/decant-split"
import type { AlertType } from "@/types/database"
import { sendSplitEventEmail } from "@/utils/alert-email.server"
import { getUserDisplayName } from "@/utils/user"

const splitInclude = {
  host: {
    select: {
      id: true,
      username: true,
      profileSlug: true,
      firstName: true,
      lastName: true,
    },
  },
  perfume: {
    select: {
      id: true,
      name: true,
      slug: true,
      image: true,
    },
  },
  slots: {
    orderBy: { ml: "asc" as const },
    include: {
      claimant: {
        select: { id: true, username: true },
      },
    },
  },
} satisfies Prisma.DecantSplitInclude

type SplitWithRelations = Prisma.DecantSplitGetPayload<{ include: typeof splitInclude }>

const serializeSlot = (slot: SplitWithRelations["slots"][number]) => ({
  id: slot.id,
  ml: slot.ml,
  status: slot.status,
  claimantUserId: slot.claimantUserId,
  claimantUsername: slot.claimant?.username ?? null,
  claimedAt: slot.claimedAt?.toISOString() ?? null,
  paidAt: slot.paidAt?.toISOString() ?? null,
  receivedAt: slot.receivedAt?.toISOString() ?? null,
})

const serializeSplit = (
  split: SplitWithRelations,
  viewerUserId?: string | null
): DecantSplitForClient => ({
  id: split.id,
  hostUserId: split.hostUserId,
  hostUsername: split.host.username,
  hostProfileSlug: split.host.profileSlug,
  perfumeId: split.perfumeId,
  perfumeName: split.perfume.name,
  perfumeSlug: split.perfume.slug,
  perfumeImage: split.perfume.image,
  sourceUserPerfumeId: split.sourceUserPerfumeId,
  totalMl: split.totalMl,
  status: split.status,
  priceHint: split.priceHint,
  notes: split.notes,
  decantFormat: split.decantFormat,
  condition: split.condition,
  createdAt: split.createdAt.toISOString(),
  updatedAt: split.updatedAt.toISOString(),
  shippedAt: split.shippedAt?.toISOString() ?? null,
  completedAt: split.completedAt?.toISOString() ?? null,
  slots: split.slots.map(serializeSlot),
  viewerIsHost: viewerUserId != null && split.hostUserId === viewerUserId,
  viewerClaimedSlotIds:
    viewerUserId == null
      ? []
      : split.slots
          .filter(s => s.claimantUserId === viewerUserId)
          .map(s => s.id),
})

const appendSplitEvent = async (
  tx: Prisma.TransactionClient,
  splitId: string,
  type: string,
  actorUserId: string,
  metadata?: Record<string, unknown>
) => {
  await tx.decantSplitEvent.create({
    data: {
      splitId,
      type,
      actorUserId,
      metadata: metadata as Prisma.InputJsonValue,
    },
  })
}

const getReservedMlForPerfume = async (
  userId: string,
  perfumeId: string,
  excludeSplitId?: string
): Promise<number> => {
  const splits = await prisma.decantSplit.findMany({
    where: {
      hostUserId: userId,
      perfumeId,
      status: { in: ACTIVE_DECANT_SPLIT_STATUSES },
      ...(excludeSplitId ? { id: { not: excludeSplitId } } : {}),
    },
    select: { totalMl: true },
  })
  return splits.reduce((sum, s) => sum + s.totalMl, 0)
}

export const getPourableMlBudget = async (
  userId: string,
  perfumeId: string
): Promise<PourableMlBudgetForClient> => {
  const rows = await prisma.userPerfume.findMany({
    where: { userId, perfumeId },
    select: { id: true, perfumeId: true, amount: true, available: true },
  })

  const ownedMl = sumOwnedMlForPerfume(rows)
  const listedMl = sumListedMlForPerfume(rows)
  const reservedMl = await getReservedMlForPerfume(userId, perfumeId)

  return computePourableMlBudget({ ownedMl, listedMl, reservedMl })
}

const validateSourceUserPerfume = async (
  hostUserId: string,
  perfumeId: string,
  sourceUserPerfumeId: string | null | undefined
) => {
  if (!sourceUserPerfumeId) return
  const row = await prisma.userPerfume.findFirst({
    where: { id: sourceUserPerfumeId, userId: hostUserId, perfumeId },
    select: { id: true },
  })
  if (!row) {
    throw new Error("Source bottle not found for this perfume")
  }
}

const maybeAdvanceSplitToFilling = async (
  tx: Prisma.TransactionClient,
  splitId: string
) => {
  const openCount = await tx.decantSplitSlot.count({
    where: { splitId, status: "open" },
  })
  if (openCount === 0) {
    await tx.decantSplit.updateMany({
      where: { id: splitId, status: "open" },
      data: { status: "filling" },
    })
  }
}

const tryCompleteSplit = async (tx: Prisma.TransactionClient, splitId: string) => {
  const pending = await tx.decantSplitSlot.count({
    where: {
      splitId,
      status: { in: ["open", "claimed", "paid"] },
    },
  })
  if (pending > 0) return

  await tx.decantSplit.updateMany({
    where: { id: splitId, status: "shipped" },
    data: { status: "completed", completedAt: new Date() },
  })
}

const notifySplitParticipants = async (params: {
  split: SplitWithRelations
  alertType: AlertType
  title: string
  message: string
  recipientUserIds: string[]
  actorUserId: string
  metadata?: Record<string, unknown>
}) => {
  const baseMetadata = {
    splitId: params.split.id,
    perfumeId: params.split.perfumeId,
    actorUserId: params.actorUserId,
    ...params.metadata,
  }

  for (const userId of params.recipientUserIds) {
    await createUserAlert(
      userId,
      params.split.perfumeId,
      params.alertType,
      params.title,
      params.message,
      baseMetadata
    )
    dispatchPushForUserAlert({
      userId,
      alertType: params.alertType,
      title: params.title,
      message: params.message,
      metadata: baseMetadata,
    })

    const [user, preferences] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          username: true,
          profileSlug: true,
        },
      }),
      getUserAlertPreferences(userId),
    ])

    if (user) {
      void sendSplitEventEmail({
        user,
        preferences,
        alertType: params.alertType,
        title: params.title,
        message: params.message,
      }).catch(err => console.error("[email] split event email failed:", err))
    }
  }
}

export const createDecantSplit = async (
  input: CreateDecantSplitInput
): Promise<DecantSplitForClient> => {
  const { hostUserId, perfumeId, totalMl, slotMl } = input

  if (slotMl.length < 1) {
    throw new Error("At least one slot is required")
  }
  if (slotMl.some(ml => ml <= 0)) {
    throw new Error("Each slot must be greater than 0 ml")
  }
  const slotSum = slotMl.reduce((a, b) => a + b, 0)
  if (Math.abs(slotSum - totalMl) > 0.01) {
    throw new Error("Slot volumes must sum to total ml")
  }
  if (totalMl <= 0) {
    throw new Error("Total ml must be greater than 0")
  }

  await validateSourceUserPerfume(
    hostUserId,
    perfumeId,
    input.sourceUserPerfumeId
  )

  const budget = await getPourableMlBudget(hostUserId, perfumeId)
  if (totalMl > budget.remainingPourableMl + 0.01) {
    throw new Error(
      `Cannot split ${totalMl} ml. Only ${budget.remainingPourableMl.toFixed(1)} ml available to pour (${budget.ownedMl} owned − ${budget.listedMl} listed − ${budget.reservedMl} reserved in active splits).`
    )
  }

  const split = await prisma.$transaction(async tx => {
    const created = await tx.decantSplit.create({
      data: {
        hostUserId,
        perfumeId,
        sourceUserPerfumeId: input.sourceUserPerfumeId ?? null,
        totalMl,
        status: "open",
        priceHint: input.priceHint ?? null,
        notes: input.notes ?? null,
        decantFormat: input.decantFormat ?? null,
        condition: input.condition ?? null,
        slots: {
          create: slotMl.map(ml => ({ ml, status: "open" })),
        },
      },
      include: splitInclude,
    })

    await appendSplitEvent(tx, created.id, "created", hostUserId, {
      totalMl,
      slotCount: slotMl.length,
    })

    return created
  })

  return serializeSplit(split, hostUserId)
}

export const getDecantSplitById = async (
  splitId: string,
  viewerUserId?: string | null
): Promise<DecantSplitForClient | null> => {
  const split = await prisma.decantSplit.findUnique({
    where: { id: splitId },
    include: splitInclude,
  })
  if (!split) return null
  return serializeSplit(split, viewerUserId)
}

export const listMyDecantSplits = async (userId: string) => {
  const [hosted, claimedSlots] = await Promise.all([
    prisma.decantSplit.findMany({
      where: { hostUserId: userId },
      include: splitInclude,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.decantSplit.findMany({
      where: {
        slots: { some: { claimantUserId: userId } },
        hostUserId: { not: userId },
      },
      include: splitInclude,
      orderBy: { updatedAt: "desc" },
    }),
  ])

  return {
    hosted: hosted.map(s => serializeSplit(s, userId)),
    participating: claimedSlots.map(s => serializeSplit(s, userId)),
  }
}

export const claimDecantSplitSlot = async (
  splitId: string,
  slotId: string,
  claimantUserId: string
): Promise<DecantSplitForClient> => {
  const split = await prisma.$transaction(async tx => {
    const existing = await tx.decantSplit.findUnique({
      where: { id: splitId },
      include: splitInclude,
    })
    if (!existing) throw new Error("Split not found")
    if (existing.hostUserId === claimantUserId) {
      throw new Error("Host cannot claim a slot on their own split")
    }
    if (!["open", "filling"].includes(existing.status)) {
      throw new Error("This split is no longer accepting claims")
    }

    const slot = existing.slots.find(s => s.id === slotId)
    if (!slot) throw new Error("Slot not found")
    if (slot.status !== "open") throw new Error("Slot is no longer available")

    const existingClaim = existing.slots.find(
      s => s.claimantUserId === claimantUserId && s.status !== "open"
    )
    if (existingClaim) {
      throw new Error("You already have a slot on this split")
    }

    await tx.decantSplitSlot.update({
      where: { id: slotId },
      data: {
        status: "claimed",
        claimantUserId,
        claimedAt: new Date(),
      },
    })

    await appendSplitEvent(tx, splitId, "slot_claimed", claimantUserId, { slotId })

    await maybeAdvanceSplitToFilling(tx, splitId)

    return tx.decantSplit.findUniqueOrThrow({
      where: { id: splitId },
      include: splitInclude,
    })
  })

  const hostName = getUserDisplayName(split.host)
  void notifySplitParticipants({
    split,
    alertType: "split_slot_claimed",
    title: `New slot claim on your ${split.perfume.name} split`,
    message: `A trader claimed a ${split.slots.find(s => s.id === slotId)?.ml ?? ""} ml slot.`,
    recipientUserIds: [split.hostUserId],
    actorUserId: claimantUserId,
    metadata: { slotId },
  }).catch(err => console.error("[decant-split] claim notify failed:", err))

  return serializeSplit(split, claimantUserId)
}

export const markDecantSplitSlotPaid = async (
  splitId: string,
  slotId: string,
  hostUserId: string
): Promise<DecantSplitForClient> => {
  const split = await prisma.$transaction(async tx => {
    const existing = await tx.decantSplit.findUnique({
      where: { id: splitId },
      include: splitInclude,
    })
    if (!existing) throw new Error("Split not found")
    if (existing.hostUserId !== hostUserId) {
      throw new Error("Only the host can mark slots as paid")
    }

    const slot = existing.slots.find(s => s.id === slotId)
    if (!slot) throw new Error("Slot not found")
    if (slot.status !== "claimed") {
      throw new Error("Slot must be claimed before marking paid")
    }

    await tx.decantSplitSlot.update({
      where: { id: slotId },
      data: { status: "paid", paidAt: new Date() },
    })

    await appendSplitEvent(tx, splitId, "slot_paid", hostUserId, { slotId })

    return tx.decantSplit.findUniqueOrThrow({
      where: { id: splitId },
      include: splitInclude,
    })
  })

  return serializeSplit(split, hostUserId)
}

export const markDecantSplitShipped = async (
  splitId: string,
  hostUserId: string
): Promise<DecantSplitForClient> => {
  const split = await prisma.$transaction(async tx => {
    const existing = await tx.decantSplit.findUnique({
      where: { id: splitId },
      include: splitInclude,
    })
    if (!existing) throw new Error("Split not found")
    if (existing.hostUserId !== hostUserId) {
      throw new Error("Only the host can mark the split as shipped")
    }
    if (!["open", "filling"].includes(existing.status)) {
      throw new Error("Split cannot be shipped in its current state")
    }

    const unclaimed = existing.slots.filter(s => s.status === "open").length
    if (unclaimed > 0) {
      throw new Error("Cannot ship while open slots remain")
    }

    await tx.decantSplit.update({
      where: { id: splitId },
      data: { status: "shipped", shippedAt: new Date() },
    })

    await appendSplitEvent(tx, splitId, "shipped", hostUserId)

    return tx.decantSplit.findUniqueOrThrow({
      where: { id: splitId },
      include: splitInclude,
    })
  })

  const claimantIds = [
    ...new Set(
      split.slots
        .map(s => s.claimantUserId)
        .filter((id): id is string => id != null)
    ),
  ]

  const hostName = getUserDisplayName(split.host)
  void notifySplitParticipants({
    split,
    alertType: "split_shipped",
    title: `${hostName} shipped your ${split.perfume.name} split`,
    message: "Confirm when you receive your decant.",
    recipientUserIds: claimantIds,
    actorUserId: hostUserId,
  }).catch(err => console.error("[decant-split] ship notify failed:", err))

  return serializeSplit(split, hostUserId)
}

export const confirmDecantSplitSlotReceived = async (
  splitId: string,
  slotId: string,
  claimantUserId: string
): Promise<DecantSplitForClient> => {
  const { split, notifyHost } = await prisma.$transaction(async tx => {
    const existing = await tx.decantSplit.findUnique({
      where: { id: splitId },
      include: splitInclude,
    })
    if (!existing) throw new Error("Split not found")
    if (existing.status !== "shipped") {
      throw new Error("Split must be shipped before confirming receipt")
    }

    const slot = existing.slots.find(s => s.id === slotId)
    if (!slot) throw new Error("Slot not found")
    if (slot.claimantUserId !== claimantUserId) {
      throw new Error("Not authorized to confirm this slot")
    }
    if (!["claimed", "paid"].includes(slot.status)) {
      throw new Error("Slot cannot be confirmed in its current state")
    }

    await tx.decantSplitSlot.update({
      where: { id: slotId },
      data: { status: "received", receivedAt: new Date() },
    })

    await appendSplitEvent(tx, splitId, "slot_received", claimantUserId, { slotId })

    await tryCompleteSplit(tx, splitId)

    const updated = await tx.decantSplit.findUniqueOrThrow({
      where: { id: splitId },
      include: splitInclude,
    })

    return {
      split: updated,
      notifyHost: updated.status === "completed",
    }
  })

  if (notifyHost) {
    const claimantName = getUserDisplayName(
      split.slots.find(s => s.id === slotId)?.claimant ?? split.host
    )
    void notifySplitParticipants({
      split,
      alertType: "split_completed",
      title: `Split completed: ${split.perfume.name}`,
      message: "All claimants confirmed receipt.",
      recipientUserIds: [split.hostUserId],
      actorUserId: claimantUserId,
    }).catch(err => console.error("[decant-split] complete notify failed:", err))
  }

  return serializeSplit(split, claimantUserId)
}

export const cancelDecantSplit = async (
  splitId: string,
  hostUserId: string
): Promise<DecantSplitForClient> => {
  const split = await prisma.$transaction(async tx => {
    const existing = await tx.decantSplit.findUnique({
      where: { id: splitId },
      include: splitInclude,
    })
    if (!existing) throw new Error("Split not found")
    if (existing.hostUserId !== hostUserId) {
      throw new Error("Only the host can cancel this split")
    }
    if (!["open", "filling"].includes(existing.status)) {
      throw new Error("Split cannot be cancelled in its current state")
    }

    const claimed = existing.slots.some(s => s.status !== "open")
    if (claimed) {
      throw new Error("Cannot cancel after slots have been claimed")
    }

    await tx.decantSplitSlot.updateMany({
      where: { splitId, status: "open" },
      data: { status: "released" },
    })

    await tx.decantSplit.update({
      where: { id: splitId },
      data: { status: "cancelled" },
    })

    await appendSplitEvent(tx, splitId, "cancelled", hostUserId)

    return tx.decantSplit.findUniqueOrThrow({
      where: { id: splitId },
      include: splitInclude,
    })
  })

  return serializeSplit(split, hostUserId)
}

export const listOpenSplitChipsForPerfumes = async (
  perfumeIds: string[]
): Promise<OpenSplitChip[]> => {
  if (perfumeIds.length === 0) return []

  const splits = await prisma.decantSplit.findMany({
    where: {
      perfumeId: { in: perfumeIds },
      status: { in: ["open", "filling"] as DecantSplitStatus[] },
    },
    select: {
      id: true,
      hostUserId: true,
      perfumeId: true,
      totalMl: true,
      slots: {
        where: { status: "open" },
        select: { id: true },
      },
    },
  })

  return splits
    .filter(s => s.slots.length > 0)
    .map(s => ({
      splitId: s.id,
      hostUserId: s.hostUserId,
      perfumeId: s.perfumeId,
      openSlotCount: s.slots.length,
      totalMl: s.totalMl,
    }))
}

export const countCompletedSplitsAsHost = async (hostUserId: string): Promise<number> =>
  prisma.decantSplit.count({
    where: { hostUserId, status: "completed" },
  })
