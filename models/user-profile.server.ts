import { MembershipTier, SubscriptionStatus } from "@prisma/client"
import { cache } from "react"
import { prisma } from "@/lib/db"
import { invalidateAllSessions } from "@/models/session.server"
import { assertValid, validationError } from "@/utils/errorHandling.patterns"
import {
  calculatePasswordStrength,
  hashPassword,
  validatePasswordComplexity,
  verifyPassword,
} from "@/utils/security/password-security.server"
import { allocateUniqueProfileSlug } from "@/utils/profile-slug.server"
import { generateUniqueUsername } from "@/utils/username-generator.server"
import { userPerfumeListingSelect } from "./user-perfume-listing-fields"
import { getUserByEmail } from "./user.query"

/** @deprecated Free signup is closed; kept for tests that expect the error type. */
export class FreeSignupLimitReachedError extends Error {
  override name = "FreeSignupLimitReachedError"
}

export interface CreateUserOptions {
  /** Subscription status for the new user. Defaults to 'free'. */
  subscriptionStatus?: SubscriptionStatus
  /** Paid tier for new subscribers. Defaults to free (Member entitlements). */
  membershipTier?: MembershipTier
  /** Grandfathered early adopters only; new paid signups should pass false. */
  isEarlyAdopter?: boolean
}

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
  const membershipTier = options?.membershipTier ?? MembershipTier.free
  const isEarlyAdopter = options?.isEarlyAdopter ?? false

  const email = data.get("email") as string
  const hashedPassword = await hashPassword(password)
  const username = await generateUniqueUsername()

  const profileSlug = await allocateUniqueProfileSlug(prisma, username, null)
  return prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      username,
      profileSlug,
      subscriptionStatus,
      membershipTier,
      isEarlyAdopter,
    },
  })
}

/** Public trader profile fields — never include email. */
const traderPublicSelect = {
  id: true,
  createdAt: true,
  firstName: true,
  lastName: true,
  username: true,
  traderAbout: true,
  avatarImage: true,
  region: true,
  instagramHandle: true,
  fragranticaUrl: true,
  redditUsername: true,
  lastActiveAt: true,
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
      ...userPerfumeListingSelect,
      perfume: {
        select: {
          id: true,
          name: true,
          slug: true,
          isPending: true,
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
      bottlePreference: true,
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
} as const

export const getPublicTraderById = cache(async (id: string) =>
  prisma.user.findUnique({
    where: { id },
    select: traderPublicSelect,
  })
)

/** @deprecated Use getPublicTraderById — kept as alias for existing imports. */
export const getTraderById = getPublicTraderById

export type SignInCustomerResult =
  | { kind: "not_found" }
  | { kind: "invalid_password"; user: NonNullable<Awaited<ReturnType<typeof getUserByEmail>>> }
  | { kind: "success"; user: NonNullable<Awaited<ReturnType<typeof getUserByEmail>>> }

export const signInCustomer = async (data: FormData): Promise<SignInCustomerResult> => {
  const password = data.get("password") as string
  const email = data.get("email") as string
  const user = await getUserByEmail(email)
  if (!user) {
    return { kind: "not_found" }
  }

  const isValidPassword = await verifyPassword(password, user.password)
  if (!isValidPassword) {
    return { kind: "invalid_password", user }
  }
  return { kind: "success", user }
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
