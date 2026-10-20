import type { DecantFormat, ListingCondition } from "@prisma/client"

import type { UserPerfumeI } from "@/types"

/** Listing fields for a brand-new destash (never copy another listing’s metadata). */
export const CLEAN_DESTASH_LISTING_FIELDS = {
  available: "0",
  tradePrice: null as string | null,
  tradePreference: "cash" as const,
  tradeOnly: false,
  images: [] as string[],
  condition: null as ListingCondition | null,
  decantFormat: null as DecantFormat | null,
}

export type DestashListingSubmitPayload = {
  amount: string
  tradePreference: "cash" | "trade" | "both"
  tradeOnly: boolean
  /** Always included for create/edit; empty string clears stored price. */
  tradePrice: string
  images: string[]
  /** Empty string clears condition. */
  condition: string
  /** Empty string clears decant format. */
  decantFormat: string
}

export const toDestashListingSubmitPayload = (data: {
  amount: string
  price: string
  tradePreference: "cash" | "trade" | "both"
  tradeOnly: boolean
  images: string[]
  condition: ListingCondition | null
  decantFormat: DecantFormat | null
}): DestashListingSubmitPayload => ({
  amount: data.amount,
  tradePreference: data.tradePreference,
  tradeOnly: data.tradeOnly,
  tradePrice: data.price,
  images: data.images,
  condition: data.condition ?? "",
  decantFormat: data.decantFormat ?? "",
})

export const appendDestashListingFields = (
  formData: FormData,
  payload: DestashListingSubmitPayload
) => {
  formData.append("tradePreference", payload.tradePreference)
  formData.append("tradeOnly", payload.tradeOnly.toString())
  // Present even when empty so the server can clear (omit = leave unchanged).
  formData.append("tradePrice", payload.tradePrice)
  formData.append("images", JSON.stringify(payload.images))
  formData.append("condition", payload.condition)
  formData.append("decantFormat", payload.decantFormat)
}

/** Identity + owned amount for create UX; listing fields stay clean. */
export const buildCleanCreateUserPerfume = (params: {
  perfumeId: string
  perfumeName: string
  perfume?: UserPerfumeI["perfume"]
  ownedAmountHint?: string
  /** Stable draft id segment (e.g. source bottle id) so create rails remount per bottle. */
  draftKey?: string
}): UserPerfumeI =>
  ({
    id: `create-${params.draftKey ?? params.perfumeId}`,
    userId: "",
    perfumeId: params.perfumeId,
    perfume: params.perfume ?? {
      id: params.perfumeId,
      name: params.perfumeName,
    },
    amount: params.ownedAmountHint ?? "0",
    ...CLEAN_DESTASH_LISTING_FIELDS,
  }) as UserPerfumeI

export type DestashApiResult = {
  ok: boolean
  status: number
  success: boolean
  userPerfume?: UserPerfumeI
  error?: string
  errorCode?: string
  malformed: boolean
  networkError: boolean
}

export const parseDestashApiResponse = async (
  res: Response
): Promise<DestashApiResult> => {
  let data: unknown = null
  let malformed = false
  try {
    const text = await res.text()
    if (text.trim()) {
      try {
        data = JSON.parse(text) as unknown
      } catch {
        malformed = true
        data = null
      }
    }
  } catch {
    malformed = true
  }

  const record =
    data && typeof data === "object" ? (data as Record<string, unknown>) : null
  const success = record?.success === true
  const userPerfume =
    record?.userPerfume && typeof record.userPerfume === "object"
      ? (record.userPerfume as UserPerfumeI)
      : undefined

  return {
    ok: res.ok,
    status: res.status,
    success,
    userPerfume,
    error: typeof record?.error === "string" ? record.error : undefined,
    errorCode:
      typeof record?.errorCode === "string" ? record.errorCode : undefined,
    malformed: malformed || (!res.ok && !record),
    networkError: false,
  }
}

export const mergeListingIntoCollection = (
  prev: UserPerfumeI[],
  updated: UserPerfumeI
): UserPerfumeI[] => {
  const index = prev.findIndex(up => up.id === updated.id)
  if (index >= 0) {
    const next = [...prev]
    next[index] = { ...prev[index], ...updated }
    return next
  }
  return [...prev, updated]
}
