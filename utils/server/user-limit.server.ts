import { prisma } from "@/lib/db"

/**
 * Maximum number of users who can sign up for free (early adopters).
 * After this limit, signups require payment via Stripe.
 */
export const FREE_USER_LIMIT = 100

/**
 * Counts users who "count" toward the free signup limit. We use total user count
 * so that the limit is enforced regardless of isEarlyAdopter backfill (e.g. first 3
 * or 100 users ever get free signup; after that, redirect to subscribe).
 * For reporting, early adopters are still marked with isEarlyAdopter when they
 * sign up while under the limit.
 */
export const getCurrentUserCount = async (): Promise<number> =>
  prisma.user.count()

/**
 * Returns true if free signups are still available (current count < FREE_USER_LIMIT).
 * Use this in the signup action to gate signups and redirect to /subscribe when at limit.
 * Uses a bounded query (take FREE_USER_LIMIT) so it stays fast as the user table grows.
 */
export const canSignupForFree = async (): Promise<boolean> => {
  const slice = await prisma.user.findMany({
    take: FREE_USER_LIMIT,
    select: { id: true },
  })
  return slice.length < FREE_USER_LIMIT
}
