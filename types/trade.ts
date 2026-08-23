import type { ListingCondition } from "@prisma/client"

import type { ExchangeUserPerfumeRow } from "@/app/the-exchange/exchange-types"
import type { UserPerfumeI } from "@/types"

/** Listing context for trade composer prefill (counterparty's bottle). */
export type TradeListingSeed = {
  userPerfumeId: string
  counterpartyId: string
  perfumeId?: string
  perfumeSlug?: string
  perfumeName: string
  perfumeHouse?: string
  perfumeImage?: string | null
  available: string
  type?: string | null
  price?: string | null
  tradePrice?: string | null
  tradePreference?: string | null
  tradeOnly?: boolean
  images?: string[]
  condition?: ListingCondition | null
  decantFormat?: "atomizer" | "vial" | "original" | null
  mlRemaining?: number | null
}

export type TradeComposerInit = {
  seed: TradeListingSeed
  counterpartyDisplayName: string
}

export const tradeListingSeedFromUserPerfumeI = (
  userPerfume: UserPerfumeI,
  counterpartyId: string
): TradeListingSeed => ({
  userPerfumeId: userPerfume.id,
  counterpartyId,
  perfumeId: userPerfume.perfumeId,
  perfumeName: userPerfume.perfume?.name ?? "Unknown Perfume",
  perfumeHouse: userPerfume.perfume?.perfumeHouse?.name,
  perfumeImage: userPerfume.perfume?.image ?? null,
  available: userPerfume.available ?? "0",
  type: userPerfume.type ?? null,
  price: userPerfume.price ?? null,
  tradePrice: userPerfume.tradePrice ?? null,
  tradePreference: userPerfume.tradePreference ?? null,
  tradeOnly: userPerfume.tradeOnly ?? false,
  images: userPerfume.images ?? [],
  condition: userPerfume.condition ?? null,
  decantFormat: userPerfume.decantFormat ?? null,
  mlRemaining: userPerfume.mlRemaining ?? null,
})

export const tradeListingSeedFromExchangeRow = (
  row: ExchangeUserPerfumeRow,
  perfumeMeta: { perfumeId: string; perfumeName: string; perfumeHouse?: string; perfumeImage?: string | null }
): TradeListingSeed => ({
  userPerfumeId: row.id,
  counterpartyId: row.userId,
  perfumeId: perfumeMeta.perfumeId,
  perfumeName: perfumeMeta.perfumeName,
  perfumeHouse: perfumeMeta.perfumeHouse,
  perfumeImage: perfumeMeta.perfumeImage ?? null,
  available: row.available,
  type: row.type,
  price: row.price,
  tradePrice: row.tradePrice,
  tradePreference: row.tradePreference,
  tradeOnly: row.tradeOnly,
  images: row.images ?? [],
  condition: row.condition,
  decantFormat: row.decantFormat,
  mlRemaining: row.mlRemaining,
})

export type TradeLineItemInput = {
  userPerfumeId: string
  role: "offered" | "requested"
}

export type TradeForClient = {
  id: string
  initiatorId: string
  counterpartyId: string
  status: string
  notes: string | null
  createdAt: string
  updatedAt: string
  lineItems: {
    id: string
    userPerfumeId: string
    role: string
    perfumeName: string
    perfumeId: string | null
    perfumeSlug: string | null
    perfumeImage: string | null
    mlSnapshot: number | null
    conditionSnapshot: ListingCondition | null
  }[]
  initiator: {
    id: string
    username: string | null
    firstName: string | null
    lastName: string | null
    avatarImage: string | null
  }
  counterparty: {
    id: string
    username: string | null
    firstName: string | null
    lastName: string | null
    avatarImage: string | null
  }
  /** Shared deal checklist derived from TradeEvents (same language as splits). */
  dealChecklist: {
    photosConfirmed: boolean
    trackingNumber: string | null
    shipped: boolean
    received: boolean
  }
}

export const isCashOnlyListing = (
  tradePreference?: string | null,
  tradeOnly?: boolean
): boolean =>
  !tradeOnly && (tradePreference === "cash" || tradePreference == null)

export const getTradeCtaLabelKey = (
  tradePreference?: string | null,
  tradeOnly?: boolean
): "proposeSwap" | "connectAboutBottle" => {
  if (isCashOnlyListing(tradePreference, tradeOnly)) return "connectAboutBottle"
  return "proposeSwap"
}
