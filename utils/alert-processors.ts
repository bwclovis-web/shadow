import {
  checkDecantInterestAlerts,
  checkWishlistAvailabilityAlerts,
} from "@/models/user-alerts.server"

type AlertCheck<T> = () => Promise<T>

const runAlertCheck = async <T>(check: AlertCheck<T>): Promise<T> => {
  try {
    return await check()
  } catch {
    return [] as T
  }
}

/**
 * Process alerts when a perfume becomes available for trade.
 * Call when a user adds a perfume to their available items.
 */
export const processWishlistAvailabilityAlerts = async (
  perfumeId: string,
  decantingUserId?: string
) =>
  runAlertCheck(() => checkWishlistAvailabilityAlerts(perfumeId, decantingUserId))

/**
 * Process alerts when someone adds a perfume to their PUBLIC wishlist.
 * Call when a user adds a perfume to their wishlist. Only sends if the wishlist item is public.
 */
export const processDecantInterestAlerts = async (
  perfumeId: string,
  interestedUserId: string,
  isPublicWishlist = false
) =>
  runAlertCheck(() =>
    checkDecantInterestAlerts(perfumeId, interestedUserId, isPublicWishlist)
  )

type PerfumeAlertResult = {
  wishlistAlerts: Awaited<ReturnType<typeof processWishlistAvailabilityAlerts>>
  decantAlerts: Awaited<ReturnType<typeof processDecantInterestAlerts>>
  totalAlerts: number
}

/**
 * Process all pending alerts for a perfume (wishlist availability + decant interest).
 * Use when a perfume's availability changes and you have a trigger user.
 */
export const processAllAlertsForPerfume = async (
  perfumeId: string,
  triggerUserId?: string,
  isPublicWishlist = false
): Promise<PerfumeAlertResult> => {
  const empty: PerfumeAlertResult = {
    wishlistAlerts: [],
    decantAlerts: [],
    totalAlerts: 0,
  }
  try {
    const [wishlistAlerts, decantAlerts] = await Promise.all([
      processWishlistAvailabilityAlerts(perfumeId, triggerUserId),
      triggerUserId
        ? processDecantInterestAlerts(perfumeId, triggerUserId, isPublicWishlist)
        : Promise.resolve([]),
    ])
    return {
      wishlistAlerts,
      decantAlerts,
      totalAlerts: wishlistAlerts.length + decantAlerts.length,
    }
  } catch {
    return empty
  }
}

type BulkAlertResult = {
  successful: Awaited<ReturnType<typeof processWishlistAvailabilityAlerts>>
  failed: unknown[]
  totalProcessed: number
}

/**
 * Process wishlist availability alerts for multiple perfumes.
 * Uses Promise.allSettled so one failure does not block others.
 */
export const processBulkAlerts = async (
  perfumeIds: string[]
): Promise<BulkAlertResult> => {
  if (perfumeIds.length === 0) {
    return { successful: [], failed: [], totalProcessed: 0 }
  }
  try {
    const results = await Promise.allSettled(
      perfumeIds.map((id) => processWishlistAvailabilityAlerts(id))
    )
    const successful = results
      .filter(
        (r): r is PromiseFulfilledResult<BulkAlertResult["successful"]> =>
          r.status === "fulfilled"
      )
      .flatMap((r) => r.value)
    const failed = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => r.reason)
    return {
      successful,
      failed,
      totalProcessed: perfumeIds.length,
    }
  } catch (err) {
    return {
      successful: [],
      failed: [err],
      totalProcessed: 0,
    }
  }
}

/**
 * Email notification placeholders for when email service integration is added.
 * Suggested: SendGrid, Mailgun, AWS SES, or Postmark.
 */
export const sendWishlistAlertEmail = async (
  _userEmail: string,
  _perfumeName: string,
  _availableTraders: Array<{ userId: string; displayName: string }>
): Promise<void> => {
  // Not implemented
}

export const sendDecantInterestAlertEmail = async (
  _userEmail: string,
  _perfumeName: string,
  _interestedUserName: string
): Promise<void> => {
  // Not implemented
}
