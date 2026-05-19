import type {
  DecantFormat,
  DecantSplitSlotStatus,
  DecantSplitStatus,
  ListingCondition,
} from "@prisma/client"

export type DecantSplitSlotForClient = {
  id: string
  ml: number
  status: DecantSplitSlotStatus
  claimantUserId: string | null
  claimantUsername: string | null
  claimedAt: string | null
  paidAt: string | null
  receivedAt: string | null
}

export type DecantSplitForClient = {
  id: string
  hostUserId: string
  hostUsername: string
  hostProfileSlug: string | null
  perfumeId: string
  perfumeName: string
  perfumeSlug: string
  perfumeImage: string | null
  sourceUserPerfumeId: string | null
  totalMl: number
  status: DecantSplitStatus
  priceHint: string | null
  notes: string | null
  decantFormat: DecantFormat | null
  condition: ListingCondition | null
  createdAt: string
  updatedAt: string
  shippedAt: string | null
  completedAt: string | null
  slots: DecantSplitSlotForClient[]
  viewerIsHost: boolean
  viewerClaimedSlotIds: string[]
}

export type PourableMlBudgetForClient = {
  ownedMl: number
  listedMl: number
  reservedMl: number
  remainingPourableMl: number
}

export type CreateDecantSplitInput = {
  hostUserId: string
  perfumeId: string
  sourceUserPerfumeId?: string | null
  totalMl: number
  slotMl: number[]
  priceHint?: string | null
  notes?: string | null
  decantFormat?: DecantFormat | null
  condition?: ListingCondition | null
}

export type OpenSplitChip = {
  splitId: string
  hostUserId: string
  perfumeId: string
  openSlotCount: number
  totalMl: number
}
