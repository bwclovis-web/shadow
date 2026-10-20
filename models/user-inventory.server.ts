import {
  type ListingCondition,
  type PerfumeType,
  type Prisma,
  type TradePreference,
} from "@prisma/client"
import { prisma } from "@/lib/db"
import {
  canAcceptAllocationMl,
  classifyStoredOwnedAmount,
} from "@/lib/decant-split-ml"
import { parseMl } from "@/lib/user-inventory"
import {
  AllocationValidationError,
  allocationErrorFromAccept,
  LISTING_ALLOCATION_ERROR_CODES,
} from "@/lib/listing-allocation-errors"
import { updateScentProfileFromBehavior } from "@/models/scent-profile.server"
import {
  budgetFromFragrancePool,
  commitmentsExceedOwned,
  withFragrancePoolTransaction,
  type FragrancePoolTx,
} from "@/models/fragrance-pool-lock.server"
import {
  type ListingMetadataInput,
  deleteListingImagesFromR2,
  emptyListingMetadata,
  listingMetadataToPrismaData,
  validateListingPublish,
} from "./listing-metadata.server"
import {
  attachPausedAvailable,
  fetchPausedAvailableByUser,
  setPausedAvailable,
} from "./user-perfume-pause.server"
import { userPerfumeListingSelect, userPerfumeNestedPerfumeSelect } from "./user-perfume-listing-fields"

const userPerfumeDetailSelect = {
  id: true,
  userId: true,
  perfumeId: true,
  amount: true,
  available: true,
  price: true,
  placeOfPurchase: true,
  tradePrice: true,
  tradePreference: true,
  tradeOnly: true,
  type: true,
  createdAt: true,
  ...userPerfumeListingSelect,
  perfume: {
    select: userPerfumeNestedPerfumeSelect,
  },
  _count: {
    select: {
      comments: true,
    },
  },
} as const

const toAllocationFailure = (error: unknown) => {
  if (error instanceof AllocationValidationError) {
    return {
      success: false as const,
      errorCode: error.errorCode,
      error: error.message,
    }
  }
  return null
}


export const getUserPerfumes = async (userId: string) => {
  const userPerfumes = await prisma.userPerfume.findMany({
    where: { userId },
    select: {
      id: true,
      userId: true,
      perfumeId: true,
      amount: true,
      available: true,
      price: true,
      placeOfPurchase: true,
      tradePrice: true,
      tradePreference: true,
      tradeOnly: true,
      type: true,
      createdAt: true,
      ...userPerfumeListingSelect,
      perfume: {
        select: userPerfumeNestedPerfumeSelect,
      },
      _count: {
        select: {
          comments: true,
        },
      },
    },
  })

  const pauseById = await fetchPausedAvailableByUser(userId)
  return attachPausedAvailable(userPerfumes, pauseById)
}

/**
 * Perfume IDs the user tracks in My Scents (non–destash-only row) or active destash (available ml > 0).
 * Used to omit those from recommendations.
 */
export const getUserCollectionOrDestashPerfumeIds = async (
  userId: string
): Promise<Set<string>> => {
  const rows = await prisma.userPerfume.findMany({
    where: { userId },
    select: { perfumeId: true, amount: true, available: true },
  })
  const out = new Set<string>()
  for (const r of rows) {
    const inCollection = r.amount !== "0"
    const availNum = parseFloat(
      (r.available ?? "").replace(/[^0-9.]/g, "") || "0"
    )
    const inDestash = availNum > 0
    if (inCollection || inDestash) out.add(r.perfumeId)
  }
  return out
}

// Helper function to find a user perfume
export const findUserPerfume = async (userId: string, perfumeId: string) => prisma.userPerfume.findFirst({
    where: { userId, perfumeId },
  })

// Get a user perfume by its ID
export const getUserPerfumeById = async (userPerfumeId: string) => {
  const userPerfume = await prisma.userPerfume.findUnique({
  where: { id: userPerfumeId },
  select: {
    id: true,
    perfumeId: true,
    userId: true,
    available: true,
    
  },
})
  return userPerfume
}

interface AddUserPerfumeParams {
  userId: string
  perfumeId: string
  amount?: string
  price?: string
  placeOfPurchase?: string
  type?: string
  condition?: ListingCondition
  tradePreference?: TradePreference
}

export const addUserPerfume = async ({
  userId,
  perfumeId,
  amount,
  price,
  placeOfPurchase,
  type: perfumeType,
  condition,
  tradePreference,
}: AddUserPerfumeParams) => {
  try {
    // Always create a new UserPerfume record to allow multiple decants of the same perfume
    // This enables customers to create several decants of the same perfume
    const userPerfume = await prisma.userPerfume.create({
      data: {
        userId,
        perfumeId,
        amount: amount || "full", // Use provided amount or default to 'full'
        price,
        placeOfPurchase,
        ...(perfumeType && { type: perfumeType as PerfumeType }),
        ...(condition && { condition }),
        ...(tradePreference && { tradePreference }),
      },
      include: {
        perfume: true,
      },
    })

    try {
      await updateScentProfileFromBehavior(userId, {
        type: "collection",
        perfumeId,
      })
    } catch (error) {
      console.error("Error updating scent profile from behavior:", error)
      // Don't fail the operation if scent profile update fails
    }

    return { success: true, userPerfume }
  } catch (error) {
     
    console.error("Error adding perfume to user collection:", error)
    return { success: false, error: "Failed to add perfume to collection" }
  }
}

interface CreateDestashParams {
  userId: string
  perfumeId: string
  available: string
  tradePrice?: string
  tradePreference?: string
  tradeOnly?: boolean
  listing?: ListingMetadataInput
}

export const createDestashEntry = async ({
  userId,
  perfumeId,
  available,
  tradePrice,
  tradePreference,
  tradeOnly,
  listing,
}: CreateDestashParams) => {
  try {
    const listingMeta = listing ?? {
      images: [],
      condition: null,
      decantFormat: null,
    }
    const publishCheck = validateListingPublish(available, listingMeta)
    if (!publishCheck.ok) {
      return { success: false, errorCode: publishCheck.errorCode }
    }

    let userPerfume
    try {
      userPerfume = await withFragrancePoolTransaction(
        userId,
        perfumeId,
        async (tx, pool) => {
          const budget = budgetFromFragrancePool(pool)
          const accept = canAcceptAllocationMl(budget, available)
          if (!accept.ok) {
            const failure = allocationErrorFromAccept(accept)
            throw new AllocationValidationError(failure.errorCode, failure.error)
          }

          const availableStr = String(accept.ml)
          return tx.userPerfume.create({
            data: {
              userId,
              perfumeId,
              amount: "0",
              available: availableStr,
              tradePrice: tradePrice || null,
              tradePreference: (tradePreference === "trade" ||
              tradePreference === "both"
                ? tradePreference
                : "cash") as TradePreference,
              tradeOnly: tradeOnly || false,
              ...listingMetadataToPrismaData(listingMeta),
            },
            select: userPerfumeDetailSelect,
          })
        }
      )
    } catch (error) {
      const allocationFailure = toAllocationFailure(error)
      if (allocationFailure) return allocationFailure
      throw error
    }

    try {
      await updateScentProfileFromBehavior(userId, {
        type: "collection",
        perfumeId,
      })
    } catch (error) {
      console.error("Error updating scent profile from behavior:", error)
    }

    // Alerts only after a successful committed write (never inside retry loop).
    if (parseMl(userPerfume.available) > 0 && userPerfume.perfume) {
      const { notifyFollowersOfNewListing } = await import(
        "@/models/follow-alerts.server"
      )
      void notifyFollowersOfNewListing({
        actorUserId: userId,
        userPerfumeId: userPerfume.id,
        perfumeId,
        perfumeName: userPerfume.perfume.name,
        houseId: userPerfume.perfume.perfumeHouse?.id ?? null,
      }).catch(err => console.error("[follow-alerts] listing notify failed:", err))
    }

    return {
      success: true,
      userPerfume: { ...userPerfume, pausedAvailable: null },
    }
  } catch (error) {
    console.error("Error creating destash entry:", error)
    return { success: false, error: "Failed to create destash entry" }
  }
}

export const removeUserPerfume = async (userId: string, userPerfumeId: string) => {
  try {
    const existingPerfume = await prisma.userPerfume.findFirst({
      where: {
        id: userPerfumeId,
        userId,
      },
    })

    if (!existingPerfume) {
      return { success: false, error: "Perfume not found in your collection" }
    }

    const perfumeId = existingPerfume.perfumeId
    const imagesToDelete = existingPerfume.images?.length
      ? [...existingPerfume.images]
      : []

    try {
      await withFragrancePoolTransaction(userId, perfumeId, async (tx, pool) => {
        const row = pool.rows.find(r => r.id === userPerfumeId)
        if (!row) {
          throw new AllocationValidationError(
            LISTING_ALLOCATION_ERROR_CODES.wouldInvalidateAllocations,
            "Perfume not found in your collection"
          )
        }

        const sourceInUse = pool.splits.some(
          s =>
            s.sourceUserPerfumeId === userPerfumeId &&
            (s.status === "open" ||
              s.status === "filling" ||
              s.status === "shipped")
        )
        if (sourceInUse) {
          throw new AllocationValidationError(
            LISTING_ALLOCATION_ERROR_CODES.sourceBottleInUse
          )
        }

        const remainingRows = pool.rows.filter(r => r.id !== userPerfumeId)
        const simulatedBudget = budgetFromFragrancePool({
          ...pool,
          rows: remainingRows,
        })
        if (commitmentsExceedOwned(simulatedBudget)) {
          throw new AllocationValidationError(
            LISTING_ALLOCATION_ERROR_CODES.wouldInvalidateAllocations
          )
        }

        await tx.userPerfumeComment.deleteMany({
          where: { userPerfumeId },
        })
        await tx.userPerfume.delete({
          where: { id: userPerfumeId },
        })
      })
    } catch (error) {
      const allocationFailure = toAllocationFailure(error)
      if (allocationFailure) return allocationFailure
      throw error
    }

    if (imagesToDelete.length) {
      await deleteListingImagesFromR2(imagesToDelete)
    }

    return { success: true }
  } catch (error) {
    console.error("Error removing perfume from user collection:", error)
    return {
      success: false,
      error: "Failed to remove perfume from collection",
    }
  }
}

const prepareUpdateData = (
  availableAmount: string,
  tradePrice?: string | null,
  tradePreference?: string | null,
  tradeOnly?: boolean | null,
  listing?: ListingMetadataInput
) => {
  const updateData: Record<string, unknown> = { available: availableAmount }

  // Present (including "") means set/clear; omit (undefined/null) leaves unchanged.
  if (tradePrice !== undefined && tradePrice !== null) {
    updateData.tradePrice = tradePrice.trim() === "" ? null : tradePrice.trim()
  }

  if (
    tradePreference &&
    typeof tradePreference === "string" &&
    tradePreference.trim()
  ) {
    updateData.tradePreference = tradePreference
  }

  if (typeof tradeOnly === "boolean") {
    updateData.tradeOnly = tradeOnly
  }

  if (listing) {
    Object.assign(updateData, listingMetadataToPrismaData(listing))
  }

  return updateData
}

const updatePerfumeInTx = async (
  tx: FragrancePoolTx,
  perfumeId: string,
  updateData: Prisma.UserPerfumeUpdateInput
) =>
  tx.userPerfume.update({
    where: { id: perfumeId },
    data: updateData,
    select: userPerfumeDetailSelect,
  })

export const updateAvailableAmount = async (params: {
  userId: string
  userPerfumeId: string
  availableAmount: string
  tradePrice?: string
  tradePreference?: string
  tradeOnly?: boolean
  listing?: ListingMetadataInput
  resumePaused?: boolean
}) => {
  try {
    const {
      userId,
      userPerfumeId,
      availableAmount,
      tradePrice,
      tradePreference,
      tradeOnly,
      listing,
      resumePaused = false,
    } = params

    const existingPerfume = await prisma.userPerfume.findFirst({
      where: {
        id: userPerfumeId,
        userId,
      },
    })

    if (!existingPerfume) {
      return { success: false, error: "Perfume not found in your collection" }
    }

    const perfumeId = existingPerfume.perfumeId
    let imagesToDelete: string[] = []

    let result: {
      userPerfume: Awaited<ReturnType<typeof updatePerfumeInTx>>
      pausedAvailable: string | null
    }

    try {
      result = await withFragrancePoolTransaction(
        userId,
        perfumeId,
        async (tx, pool) => {
          const lockedRow = pool.rows.find(r => r.id === userPerfumeId)
          if (!lockedRow) {
            throw new AllocationValidationError(
              LISTING_ALLOCATION_ERROR_CODES.wouldInvalidateAllocations,
              "Perfume not found in your collection"
            )
          }

          const pausedStoredRaw = lockedRow.pausedAvailable ?? null
          const pausedStoredMl = parseMl(pausedStoredRaw)
          const existingAvailableMl = parseMl(lockedRow.available)

          const budget = budgetFromFragrancePool(pool, userPerfumeId)
          const accept = canAcceptAllocationMl(budget, availableAmount)
          if (!accept.ok) {
            const failure = allocationErrorFromAccept(accept)
            throw new AllocationValidationError(failure.errorCode, failure.error)
          }

          const newDestashAmount = accept.ml
          const availableStr = String(newDestashAmount)
          const isResumingPausedListing =
            newDestashAmount > 0 &&
            existingAvailableMl <= 0 &&
            (pausedStoredMl > 0 || resumePaused)

          let listingMeta: ListingMetadataInput = listing ?? {
            images: existingPerfume.images ?? [],
            condition: existingPerfume.condition ?? null,
            decantFormat: existingPerfume.decantFormat ?? null,
          }

          if (isResumingPausedListing && listingMeta.images.length === 0) {
            const perfume = await tx.perfume.findUnique({
              where: { id: perfumeId },
              select: { image: true },
            })
            const catalogImage = perfume?.image?.trim()
            if (catalogImage) {
              listingMeta = { ...listingMeta, images: [catalogImage] }
            }
          }

          const publishCheck = validateListingPublish(availableStr, listingMeta, {
            resumingPausedListing: isResumingPausedListing,
          })
          if (!publishCheck.ok) {
            const publishErr = new Error("LISTING_PUBLISH_REJECTED") as Error & {
              errorCode: string
            }
            publishErr.errorCode = publishCheck.errorCode
            throw publishErr
          }

          const isSoftPause = newDestashAmount <= 0 && existingAvailableMl > 0
          if (isSoftPause) {
            const pausedSnapshot =
              lockedRow.available ?? existingPerfume.available ?? availableStr
            const pauseData: Prisma.UserPerfumeUpdateInput = { available: "0" }
            if (tradePrice !== undefined && tradePrice !== null) {
              pauseData.tradePrice =
                tradePrice.trim() === "" ? null : tradePrice.trim()
            }
            if (
              tradePreference &&
              typeof tradePreference === "string" &&
              tradePreference.trim()
            ) {
              pauseData.tradePreference = tradePreference as TradePreference
            }
            if (typeof tradeOnly === "boolean") {
              pauseData.tradeOnly = tradeOnly
            }
            const updatedPerfume = await updatePerfumeInTx(
              tx,
              existingPerfume.id,
              pauseData
            )
            await setPausedAvailable(
              existingPerfume.id,
              userId,
              pausedSnapshot,
              tx
            )
            return {
              userPerfume: updatedPerfume,
              pausedAvailable: pausedSnapshot,
            }
          }

          const isClearingPausedListing =
            newDestashAmount <= 0 &&
            existingAvailableMl <= 0 &&
            pausedStoredMl > 0

          const isHardUnpublish =
            newDestashAmount <= 0 &&
            existingAvailableMl <= 0 &&
            pausedStoredMl <= 0

          if (
            (isHardUnpublish || isClearingPausedListing) &&
            existingPerfume.images?.length
          ) {
            imagesToDelete = [...existingPerfume.images]
          }

          const shouldApplyListingMeta =
            listing !== undefined ||
            (isResumingPausedListing && listingMeta.images.length > 0)

          const updateData = prepareUpdateData(
            availableStr,
            tradePrice,
            tradePreference,
            tradeOnly,
            isHardUnpublish || isClearingPausedListing
              ? emptyListingMetadata()
              : shouldApplyListingMeta
                ? listingMeta
                : undefined
          )

          if (isClearingPausedListing) {
            updateData.available = "0"
          }

          const updatedPerfume = await updatePerfumeInTx(
            tx,
            existingPerfume.id,
            updateData as Prisma.UserPerfumeUpdateInput
          )

          const nextPausedAvailable =
            newDestashAmount > 0 || isClearingPausedListing
              ? null
              : pausedStoredRaw

          if (newDestashAmount > 0 || isClearingPausedListing) {
            await setPausedAvailable(existingPerfume.id, userId, null, tx)
          }

          return {
            userPerfume: updatedPerfume,
            pausedAvailable: nextPausedAvailable,
          }
        }
      )
    } catch (error) {
      const allocationFailure = toAllocationFailure(error)
      if (allocationFailure) return allocationFailure
      if (
        error instanceof Error &&
        error.message === "LISTING_PUBLISH_REJECTED" &&
        "errorCode" in error
      ) {
        return {
          success: false as const,
          errorCode: (error as Error & { errorCode: string }).errorCode,
        }
      }
      throw error
    }

    if (imagesToDelete.length) {
      await deleteListingImagesFromR2(imagesToDelete)
    }

    return {
      success: true,
      userPerfume: {
        ...result.userPerfume,
        pausedAvailable: result.pausedAvailable,
      },
    }
  } catch (error) {
    console.error("Error updating available amount:", error)
    return { success: false, error: "Failed to update available amount" }
  }
}

export const updateUserPerfumeAmount = async ({
  userId,
  userPerfumeId,
  amount,
  type,
  price,
  placeOfPurchase,
}: {
  userId: string
  userPerfumeId: string
  amount: string
  type?: string
  price?: string
  placeOfPurchase?: string
}) => {
  try {
    const existingPerfume = await prisma.userPerfume.findFirst({
      where: { id: userPerfumeId, userId },
    })

    if (!existingPerfume) {
      return { success: false, error: "Perfume not found in your collection" }
    }

    if (!amount.trim()) {
      return { success: false, error: "Amount is required" }
    }

    const trimmedAmount = amount.trim()
    const perfumeId = existingPerfume.perfumeId

    let updatedPerfume
    try {
      updatedPerfume = await withFragrancePoolTransaction(
        userId,
        perfumeId,
        async (tx, pool) => {
          const simulatedRows = pool.rows.map(r =>
            r.id === userPerfumeId ? { ...r, amount: trimmedAmount } : r
          )
          const simulatedBudget = budgetFromFragrancePool({
            ...pool,
            rows: simulatedRows,
          })
          if (commitmentsExceedOwned(simulatedBudget)) {
            const classified = classifyStoredOwnedAmount(trimmedAmount)
            throw new AllocationValidationError(
              classified.status === "unknown"
                ? LISTING_ALLOCATION_ERROR_CODES.ownershipUnknown
                : LISTING_ALLOCATION_ERROR_CODES.wouldInvalidateAllocations
            )
          }

          const updateData: Record<string, unknown> = { amount: trimmedAmount }
          if (type) updateData.type = type as PerfumeType
          if (price !== undefined) updateData.price = price.trim() || null
          if (placeOfPurchase !== undefined) {
            updateData.placeOfPurchase = placeOfPurchase.trim() || null
          }

          return tx.userPerfume.update({
            where: { id: userPerfumeId },
            data: updateData as Prisma.UserPerfumeUpdateInput,
            select: {
              id: true,
              userId: true,
              perfumeId: true,
              amount: true,
              available: true,
              price: true,
              placeOfPurchase: true,
              tradePrice: true,
              tradePreference: true,
              tradeOnly: true,
              type: true,
              createdAt: true,
              ...userPerfumeListingSelect,
              perfume: {
                select: userPerfumeNestedPerfumeSelect,
              },
            },
          })
        }
      )
    } catch (error) {
      const allocationFailure = toAllocationFailure(error)
      if (allocationFailure) return allocationFailure
      throw error
    }

    return { success: true, userPerfume: updatedPerfume }
  } catch (error) {
    console.error("Error updating perfume amount:", error)
    return { success: false, error: "Failed to update perfume amount" }
  }
}
