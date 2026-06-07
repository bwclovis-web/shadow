import {
  type ListingCondition,
  type PerfumeType,
  type TradePreference,
} from "@prisma/client"
import { prisma } from "@/lib/db"
import { updateScentProfileFromBehavior } from "@/models/scent-profile.server"
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
  getPausedAvailable,
  setPausedAvailable,
} from "./user-perfume-pause.server"
import { userPerfumeListingSelect, userPerfumeNestedPerfumeSelect } from "./user-perfume-listing-fields"


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
    // Get all user's entries for this perfume to calculate totals
    const existingEntries = await prisma.userPerfume.findMany({
      where: { userId, perfumeId },
      select: { amount: true, available: true },
    })

    // Calculate total owned (sum of all amount values > 0)
    const totalOwned = existingEntries.reduce((sum, entry) => {
      const amt = parseFloat(entry.amount?.replace(/[^0-9.]/g, "") || "0")
      return sum + (isNaN(amt) ? 0 : amt)
    }, 0)

    // Calculate total already destashed (sum of all available values)
    const totalDestashed = existingEntries.reduce((sum, entry) => {
      const avail = parseFloat(entry.available?.replace(/[^0-9.]/g, "") || "0")
      return sum + (isNaN(avail) ? 0 : avail)
    }, 0)

    // Parse the new destash amount
    const newDestashAmount = parseFloat(available?.replace(/[^0-9.]/g, "") || "0")

    // Validate: total destashed + new destash cannot exceed total owned
    if (totalOwned > 0 && (totalDestashed + newDestashAmount) > totalOwned) {
      const remainingAvailable = Math.max(0, totalOwned - totalDestashed)
      return {
        success: false,
        error: `Cannot destash ${available}. You only have ${remainingAvailable.toFixed(1)} ml remaining (${totalOwned} ml owned - ${totalDestashed.toFixed(1)} ml already destashed).`,
      }
    }

    const userPerfume = await prisma.userPerfume.create({
      data: {
        userId,
        perfumeId,
        amount: "0",
        available,
        tradePrice: tradePrice || null,
        tradePreference: (tradePreference === "trade" || tradePreference === "both" ? tradePreference : "cash") as TradePreference,
        tradeOnly: tradeOnly || false,
        ...listingMetadataToPrismaData(listingMeta),
      },
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

    try {
      await updateScentProfileFromBehavior(userId, {
        type: "collection",
        perfumeId,
      })
    } catch (error) {
      console.error("Error updating scent profile from behavior:", error)
      // Don't fail the operation if scent profile update fails
    }

    const availMl = parseFloat(available?.replace(/[^0-9.]/g, "") || "0")
    if (availMl > 0 && userPerfume.perfume) {
      const { notifyFollowersOfNewListing } = await import("@/models/follow-alerts.server")
      void notifyFollowersOfNewListing({
        actorUserId: userId,
        userPerfumeId: userPerfume.id,
        perfumeId,
        perfumeName: userPerfume.perfume.name,
        houseId: userPerfume.perfume.perfumeHouse?.id ?? null,
      }).catch(err => console.error("[follow-alerts] listing notify failed:", err))
    }

    return { success: true, userPerfume: { ...userPerfume, pausedAvailable: null } }
  } catch (error) {
    console.error("Error creating destash entry:", error)
    return { success: false, error: "Failed to create destash entry" }
  }
}

export const removeUserPerfume = async (userId: string, userPerfumeId: string) => {
  try {
    // Check if the user perfume exists and belongs to the user
    const existingPerfume = await prisma.userPerfume.findFirst({
      where: {
        id: userPerfumeId,
        userId,
      },
    })

    if (!existingPerfume) {
      return { success: false, error: "Perfume not found in your collection" }
    }

    if (existingPerfume.images?.length) {
      await deleteListingImagesFromR2(existingPerfume.images)
    }

    // Delete only this specific bottle (and its comments)
    await prisma.$transaction(async (transaction) => {
      await transaction.userPerfumeComment.deleteMany({
        where: { userPerfumeId },
      })

      await transaction.userPerfume.delete({
        where: { id: userPerfumeId },
      })
    })

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

  if (tradePrice !== undefined && tradePrice !== null) {
    updateData.tradePrice = tradePrice
  }

  if (tradePreference && typeof tradePreference === "string" && tradePreference.trim()) {
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

// Helper to update perfume in database
// Use the same select structure as getUserPerfumes for consistency
const updatePerfumeInDatabase = async (perfumeId: string, updateData: any) => await prisma.userPerfume.update({
    where: { id: perfumeId },
    data: updateData,
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

// Helper to parse amount strings (e.g., "50", "50ml", "full") to numeric value
// Returns null for "full" or unparseable values (treated as unlimited)
const parseAmountToNumber = (amount: string | null): number | null => {
  if (!amount || amount.toLowerCase() === "full") {
    return null // "full" means unlimited
  }
  // Remove common units and parse the number
  const numericValue = parseFloat(amount.replace(/[^0-9.]/g, ""))
  return isNaN(numericValue) ? null : numericValue
}

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

    // Check if the user owns this user perfume entry
    const existingPerfume = await prisma.userPerfume.findFirst({
      where: {
        id: userPerfumeId,
        userId,
      },
    })

    if (!existingPerfume) {
      return { success: false, error: "Perfume not found in your collection" }
    }

    const parseAvailMl = (value: string | null | undefined) =>
      parseFloat((value ?? "").replace(/[^0-9.]/g, "") || "0") || 0

    const pausedStoredRaw = await getPausedAvailable(existingPerfume.id, userId)
    const pausedStoredMl = parseAvailMl(pausedStoredRaw)
    const newDestashAmount = parseAmountToNumber(availableAmount) || 0
    const existingAvailableMl = parseAvailMl(existingPerfume.available)
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
      const perfume = await prisma.perfume.findUnique({
        where: { id: existingPerfume.perfumeId },
        select: { image: true },
      })
      const catalogImage = perfume?.image?.trim()
      if (catalogImage) {
        listingMeta = { ...listingMeta, images: [catalogImage] }
      }
    }

    const publishCheck = validateListingPublish(availableAmount, listingMeta, {
      resumingPausedListing: isResumingPausedListing,
    })
    if (!publishCheck.ok) {
      return { success: false, errorCode: publishCheck.errorCode }
    }

    // Get all user's entries for this perfume to calculate totals
    const allEntries = await prisma.userPerfume.findMany({
      where: { userId, perfumeId: existingPerfume.perfumeId },
      select: { id: true, amount: true, available: true },
    })

    // Calculate total owned (sum of all amount values > 0)
    const totalOwned = allEntries.reduce((sum, entry) => {
      const amt = parseFloat(entry.amount?.replace(/[^0-9.]/g, "") || "0")
      return sum + (isNaN(amt) ? 0 : amt)
    }, 0)

    // Calculate total already destashed EXCLUDING current entry (we're updating it)
    const totalDestashedOthers = allEntries
      .filter(entry => entry.id !== userPerfumeId)
      .reduce((sum, entry) => {
        const avail = parseFloat(entry.available?.replace(/[^0-9.]/g, "") || "0")
        return sum + (isNaN(avail) ? 0 : avail)
      }, 0)

    const isSoftPause = newDestashAmount <= 0 && existingAvailableMl > 0

    if (isSoftPause) {
      const pausedSnapshot = existingPerfume.available ?? availableAmount
      const pauseData: Record<string, unknown> = { available: "0" }
      if (tradePrice !== undefined && tradePrice !== null) {
        pauseData.tradePrice = tradePrice
      }
      if (tradePreference && typeof tradePreference === "string" && tradePreference.trim()) {
        pauseData.tradePreference = tradePreference
      }
      if (typeof tradeOnly === "boolean") {
        pauseData.tradeOnly = tradeOnly
      }
      const updatedPerfume = await updatePerfumeInDatabase(
        existingPerfume.id,
        pauseData
      )
      await setPausedAvailable(existingPerfume.id, userId, pausedSnapshot)
      return {
        success: true,
        userPerfume: { ...updatedPerfume, pausedAvailable: pausedSnapshot },
      }
    }

    // Validate: total destashed (others + new) cannot exceed total owned
    if (totalOwned > 0 && (totalDestashedOthers + newDestashAmount) > totalOwned) {
      const remainingAvailable = Math.max(0, totalOwned - totalDestashedOthers)
      return {
        success: false,
        error: `Cannot destash ${availableAmount}. You only have ${remainingAvailable.toFixed(1)} ml remaining.`,
      }
    }

    const isClearingPausedListing =
      newDestashAmount <= 0 && existingAvailableMl <= 0 && pausedStoredMl > 0

    const isHardUnpublish =
      newDestashAmount <= 0 && existingAvailableMl <= 0 && pausedStoredMl <= 0

    if ((isHardUnpublish || isClearingPausedListing) && existingPerfume.images?.length) {
      await deleteListingImagesFromR2(existingPerfume.images)
    }

    // Prepare update data
    const shouldApplyListingMeta =
      listing !== undefined ||
      (isResumingPausedListing && listingMeta.images.length > 0)

    const updateData = prepareUpdateData(
      availableAmount,
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

    // Update the perfume with new data
    const updatedPerfume = await updatePerfumeInDatabase(
      existingPerfume.id,
      updateData
    )

    const nextPausedAvailable =
      newDestashAmount > 0 || isClearingPausedListing ? null : pausedStoredRaw

    if (newDestashAmount > 0 || isClearingPausedListing) {
      await setPausedAvailable(existingPerfume.id, userId, null)
    }

    return {
      success: true,
      userPerfume: { ...updatedPerfume, pausedAvailable: nextPausedAvailable },
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

    const updateData: Record<string, unknown> = { amount: amount.trim() }
    if (type) updateData.type = type as PerfumeType
    if (price !== undefined) updateData.price = price.trim() || null
    if (placeOfPurchase !== undefined) updateData.placeOfPurchase = placeOfPurchase.trim() || null

    const updatedPerfume = await prisma.userPerfume.update({
      where: { id: userPerfumeId },
      data: updateData as Parameters<typeof prisma.userPerfume.update>[0]["data"],
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

    return { success: true, userPerfume: updatedPerfume }
  } catch (error) {
    console.error("Error updating perfume amount:", error)
    return { success: false, error: "Failed to update perfume amount" }
  }
}
