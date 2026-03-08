import { type PerfumeType, type TradePreference, SubscriptionStatus } from "@prisma/client"
import { cache } from "react"
import { prisma } from "@/lib/db"
import { updateScentProfileFromBehavior } from "@/models/scent-profile.server"
import { invalidateAllSessions } from "@/models/session.server"
import { assertValid, validationError } from "@/utils/errorHandling.patterns"
import {
  calculatePasswordStrength,
  hashPassword,
  validatePasswordComplexity,
  verifyPassword,
} from "@/utils/security/password-security.server"
import {
  FREE_USER_LIMIT,
  canSignupForFree,
} from "@/utils/server/user-limit.server"
import { generateUniqueUsername } from "@/utils/username-generator.server"

import { getUserByEmail, getUserByName } from "./user.query"

/** Thrown when free signup limit is reached during atomic create (race condition). */
export class FreeSignupLimitReachedError extends Error {
  override name = "FreeSignupLimitReachedError"
}

export interface CreateUserOptions {
  /** Subscription status for the new user. Defaults to 'free'. */
  subscriptionStatus?: SubscriptionStatus
  /** If true, user counts toward the free signup limit. If omitted, derived from count (free) or set false (paid). */
  isEarlyAdopter?: boolean
}

// Re-export query functions from user.query to maintain backwards compatibility
export {
  getAllUsers,
  getUserByEmail,
  getUserById,
  getUserByName,
} from "./user.query"

export const createUser = async (
  data: FormData,
  options?: CreateUserOptions
) => {
  const passwordRaw = data.get("password")
  assertValid(
    typeof passwordRaw === "string",
    "Password is required and must be a string",
    { field: "password" }
  )
  const password = passwordRaw as string

  // Validate password complexity
  const passwordValidation = validatePasswordComplexity(password)
  if (!passwordValidation.isValid) {
    throw validationError(
      `Password validation failed: ${passwordValidation.errors.join(", ")}`,
      { field: "password", errors: passwordValidation.errors }
    )
  }

  const subscriptionStatus = options?.subscriptionStatus ?? SubscriptionStatus.free
  let isEarlyAdopter: boolean
  if (options?.isEarlyAdopter !== undefined) {
    isEarlyAdopter = options.isEarlyAdopter
  } else if (subscriptionStatus === SubscriptionStatus.paid) {
    isEarlyAdopter = false
  } else {
    isEarlyAdopter = await canSignupForFree()
  }

  const email = data.get("email") as string
  const hashedPassword = await hashPassword(password)
  const username = await generateUniqueUsername()

  if (
    subscriptionStatus === SubscriptionStatus.free &&
    isEarlyAdopter === true
  ) {
    const user = await prisma.$transaction(async (tx) => {
      const count = await tx.user.count()
      if (count >= FREE_USER_LIMIT) {
        throw new FreeSignupLimitReachedError()
      }
      return tx.user.create({
        data: {
          email,
          password: hashedPassword,
          username,
          subscriptionStatus,
          isEarlyAdopter,
        },
      })
    })
    return user
  }

  return prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      username,
      subscriptionStatus,
      isEarlyAdopter,
    },
  })
}

export const getTraderById = cache(async (id: string) => {
  const trader = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      username: true,
      traderAbout: true,
      UserPerfume: {
        where: {
          available: {
            not: "0",
          },
        },
        select: {
          id: true,
          perfumeId: true,
          available: true,
          amount: true,
          price: true,
          placeOfPurchase: true,
          tradePrice: true,
          tradePreference: true,
          tradeOnly: true,
          type: true,
          perfume: {
            select: {
              id: true,
              name: true,
              slug: true,
              perfumeHouse: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
          comments: {
            where: {
              isPublic: true,
            },
            select: {
              id: true,
              userId: true,
              perfumeId: true,
              userPerfumeId: true,
              comment: true,
              isPublic: true,
              createdAt: true,
              updatedAt: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  username: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      },
      UserPerfumeWishlist: {
        where: {
          isPublic: true,
        },
        select: {
          id: true,
          perfumeId: true,
          isPublic: true,
          createdAt: true,
          perfume: {
            select: {
              id: true,
              name: true,
              slug: true,
              image: true,
              perfumeHouse: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  })
  return trader
})

export const signInCustomer = async (data: FormData) => {
  const password = data.get("password") as string
  const email = data.get("email") as string
  const user = await getUserByEmail(email)
  if (!user) {
    return null
  }

  // Use enhanced password verification
  const isValidPassword = await verifyPassword(password, user.password)
  if (!isValidPassword) {
    return null
  }
  return user
}

// Enhanced password change functionality
export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
) => {
  try {
    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    })

    if (!user) {
      return { success: false, error: "User not found" }
    }

    // Verify current password
    const isCurrentPasswordValid = await verifyPassword(
      currentPassword,
      user.password
    )
    if (!isCurrentPasswordValid) {
      return { success: false, error: "Current password is incorrect" }
    }

    // Validate new password complexity
    const passwordValidation = validatePasswordComplexity(newPassword)
    if (!passwordValidation.isValid) {
      return {
        success: false,
        error: `Password validation failed: ${passwordValidation.errors.join(", ")}`,
      }
    }

    // Check if new password is different from current
    if (currentPassword === newPassword) {
      return {
        success: false,
        error: "New password must be different from current password",
      }
    }

    // Hash and update password
    const hashedNewPassword = await hashPassword(newPassword)

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedNewPassword,
        updatedAt: new Date(),
      },
    })

    // Invalidate all user sessions after password change
    await invalidateAllSessions(userId)

    return {
      success: true,
      message:
        "Password changed successfully. All sessions have been invalidated for security.",
    }
  } catch (error) {
    console.error("Password change error:", error)
    return { success: false, error: "Failed to change password" }
  }
}

// Password strength check for frontend
export const checkPasswordStrength = (password: string) => calculatePasswordStrength(password)

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
      perfume: {
        select: {
          id: true,
          name: true,
          slug: true,
          image: true,
          description: true,
          perfumeHouse: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
      _count: {
        select: {
          comments: true,
        },
      },
    },
  })
  
  // Only fetch comments if specifically needed, or fetch separately
  return userPerfumes
}

// Helper function to find a user perfume
const findUserPerfume = async (userId: string, perfumeId: string) => prisma.userPerfume.findFirst({
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

interface HandleExistingPerfumeParams {
  existingPerfume: any
  amount?: string
  price?: string
  placeOfPurchase?: string
}

// Helper function to handle existing perfume update
const handleExistingPerfume = async ({
  existingPerfume,
  amount,
  price,
  placeOfPurchase,
}: HandleExistingPerfumeParams) => {
  // If the perfume exists and we need to update it
  const updateData: any = {}
  let shouldUpdate = false

  if (amount && existingPerfume.amount !== amount) {
    updateData.amount = amount
    shouldUpdate = true
  }

  if (price && existingPerfume.price !== price) {
    updateData.price = price
    shouldUpdate = true
  }

  if (placeOfPurchase && existingPerfume.placeOfPurchase !== placeOfPurchase) {
    updateData.placeOfPurchase = placeOfPurchase
    shouldUpdate = true
  }

  if (shouldUpdate) {
    const updatedPerfume = await prisma.userPerfume.update({
      where: { id: existingPerfume.id },
      data: updateData,
      include: { perfume: true },
    })
    return { success: true, userPerfume: updatedPerfume, updated: true }
  }

  return { success: false, error: "Perfume already in your collection" }
}

interface AddUserPerfumeParams {
  userId: string
  perfumeId: string
  amount?: string
  price?: string
  placeOfPurchase?: string
  type?: string
}

export const addUserPerfume = async ({
  userId,
  perfumeId,
  amount,
  price,
  placeOfPurchase,
  type: perfumeType,
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
}

export const createDestashEntry = async ({
  userId,
  perfumeId,
  available,
  tradePrice,
  tradePreference,
  tradeOnly,
}: CreateDestashParams) => {
  try {
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
        perfume: {
          select: {
            id: true,
            name: true,
            slug: true,
            image: true,
            description: true,
            perfumeHouse: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
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

    return { success: true, userPerfume }
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
  tradeOnly?: boolean | null
) => {
  const updateData: any = { available: availableAmount }

  if (tradePrice !== undefined && tradePrice !== null) {
    updateData.tradePrice = tradePrice
  }

  if (tradePreference && typeof tradePreference === 'string' && tradePreference.trim()) {
    updateData.tradePreference = tradePreference
  }

  if (typeof tradeOnly === 'boolean') {
    updateData.tradeOnly = tradeOnly
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
      perfume: {
        select: {
          id: true,
          name: true,
          slug: true,
          image: true,
          description: true,
          perfumeHouse: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
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
}) => {
  try {
    const {
      userId,
      userPerfumeId,
      availableAmount,
      tradePrice,
      tradePreference,
      tradeOnly,
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

    // Parse the new destash amount
    const newDestashAmount = parseAmountToNumber(availableAmount) || 0

    // Validate: total destashed (others + new) cannot exceed total owned
    if (totalOwned > 0 && (totalDestashedOthers + newDestashAmount) > totalOwned) {
      const remainingAvailable = Math.max(0, totalOwned - totalDestashedOthers)
      return {
        success: false,
        error: `Cannot destash ${availableAmount}. You only have ${remainingAvailable.toFixed(1)} ml remaining.`,
      }
    }

    // Prepare update data
    const updateData = prepareUpdateData(
      availableAmount,
      tradePrice,
      tradePreference,
      tradeOnly
    )

    // Update the perfume with new data
    const updatedPerfume = await updatePerfumeInDatabase(
      existingPerfume.id,
      updateData
    )

    return { success: true, userPerfume: updatedPerfume }
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
        perfume: {
          select: {
            id: true,
            name: true,
            slug: true,
            image: true,
            description: true,
            perfumeHouse: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
      },
    })

    return { success: true, userPerfume: updatedPerfume }
  } catch (error) {
    console.error("Error updating perfume amount:", error)
    return { success: false, error: "Failed to update perfume amount" }
  }
}

interface AddCommentParams {
  userId: string
  perfumeId: string
  comment: string
  isPublic?: boolean
  userPerfumeId: string
}

export const addPerfumeComment = async ({
  userId,
  perfumeId,
  comment,
  isPublic = false,
  userPerfumeId,
}: AddCommentParams) => {
  try {
    // Check if the user owns this perfume (only owners can comment)
    const existingPerfume = await findUserPerfume(userId, perfumeId)

    if (!existingPerfume) {
      return {
        success: false,
        error: "You can only comment on perfumes in your collection",
      }
    }

    // Create the comment
    const userComment = await prisma.userPerfumeComment.create({
      data: {
        userId,
        perfumeId,
        userPerfumeId, // Use the provided userPerfumeId
        comment,
        isPublic,
      },
      include: {
        perfume: true,
        userPerfume: true,
      },
    })

    return { success: true, userComment }
  } catch (error) {
     
    console.error("Error adding comment to perfume:", error)
    return { success: false, error: "Failed to add comment to perfume" }
  }
}

interface UpdateCommentParams {
  userId: string
  commentId: string
  comment?: string
  isPublic?: boolean
}

// Helper function to find a user's comment
const findUserComment = async (commentId: string) =>
  // Note: After running npx prisma generate, this will be available
  prisma.userPerfumeComment.findUnique({
    where: { id: commentId },
  })

// Helper function to perform the comment update
const performCommentUpdate = async (commentId: string, updateData: any) =>
  // Note: After running npx prisma generate, this will be available
  prisma.userPerfumeComment.update({
    where: { id: commentId },
    data: updateData,
    include: {
      perfume: true,
    },
  })

// Helper function to validate comment ownership
const validateCommentOwnership = (comment: any, userId: string) => {
  if (!comment) {
    return { isValid: false, error: "Comment not found" }
  }

  if (comment.userId !== userId) {
    return { isValid: false, error: "You can only update your own comments" }
  }

  return { isValid: true }
}

// Prepare update data for a comment
const prepareCommentUpdateData = (comment?: string, isPublic?: boolean) => {
  const updateData: any = {}

  if (comment !== undefined) {
    updateData.comment = comment
  }

  if (isPublic !== undefined) {
    updateData.isPublic = isPublic
  }

  return updateData
}

export const updatePerfumeComment = async ({
  userId,
  commentId,
  comment,
  isPublic,
}: UpdateCommentParams) => {
  try {
    // Find and validate the comment
    const existingComment = await findUserComment(commentId)
    const validation = validateCommentOwnership(existingComment, userId)

    if (!validation.isValid) {
      return { success: false, error: validation.error }
    }

    // Prepare and perform the update
    const updateData = prepareCommentUpdateData(comment, isPublic)
    const updatedComment = await performCommentUpdate(commentId, updateData)

    return { success: true, userComment: updatedComment }
  } catch (error) {
     
    console.error("Error updating perfume comment:", error)
    return { success: false, error: "Failed to update perfume comment" }
  }
}

export const deletePerfumeComment = async (userId: string, commentId: string) => {
  try {
    // Find the comment
    const existingComment = await findUserComment(commentId)
    const validation = validateCommentOwnership(existingComment, userId)

    if (!validation.isValid) {
      return { success: false, error: validation.error }
    }

    // Delete the comment
    await prisma.userPerfumeComment.delete({
      where: { id: commentId },
    })

    return { success: true }
  } catch (error) {
     
    console.error("Error deleting perfume comment:", error)
    return { success: false, error: "Failed to delete perfume comment" }
  }
}

export const getUserPerfumeComments = async (userId: string, perfumeId: string) => {
  try {
    // Find the user perfume first
    const existingPerfume = await findUserPerfume(userId, perfumeId)

    if (!existingPerfume) {
      return { success: false, error: "Perfume not found in your collection" }
    }

    // Get user's comments for a specific perfume
    const comments = await prisma.userPerfumeComment.findMany({
      where: {
        userPerfumeId: existingPerfume.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return { success: true, comments }
  } catch (error) {
     
    console.error("Error fetching user perfume comments:", error)
    return { success: false, error: "Failed to fetch comments" }
  }
}

// Get comments for a specific userPerfumeId (for when we know the exact destash)
export const getCommentsByUserPerfumeId = async (userPerfumeId: string) => {
  try {
    const comments = await prisma.userPerfumeComment.findMany({
      where: {
        userPerfumeId,
      },
      select: {
        id: true,
        userId: true,
        perfumeId: true,
        userPerfumeId: true,
        comment: true,
        isPublic: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return comments
  } catch (error) {
    console.error("Error fetching comments by userPerfumeId:", error)
    return []
  }
}

export const getPublicPerfumeComments = async (perfumeId: string) => {
  try {
    // Get all public comments for a specific perfume
    const comments = await prisma.userPerfumeComment.findMany({
      where: {
        perfumeId,
        isPublic: true,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
        userPerfume: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return { success: true, comments }
  } catch (error) {
     
    console.error("Error fetching public perfume comments:", error)
    return { success: false, error: "Failed to fetch public comments" }
  }
}
