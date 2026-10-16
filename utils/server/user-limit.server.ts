import { revalidateTag, unstable_cache } from "next/cache"

import { prisma } from "@/lib/db"
import {
  computeSignupAvailability,
  type SignupAvailability,
} from "@/utils/membership/signup-availability"

/**
 * Maximum number of users who can sign up for free (early adopters).
 * After this limit, signups require payment via Stripe.
 */
export const FREE_USER_LIMIT = 100

const FREE_SIGNUP_WINDOW_TAG = "free-signup-window"
const FREE_SIGNUP_WINDOW_REVALIDATE_SECONDS = 300

/**
 * Counts users who "count" toward the free signup limit. We use total user count
 * so that the limit is enforced regardless of isEarlyAdopter backfill (e.g. first 3
 * or 100 users ever get free signup; after that, redirect to subscribe).
 * For reporting, early adopters are still marked with isEarlyAdopter when they
 * sign up while under the limit.
 */
export const getCurrentUserCount = async (): Promise<number> =>
  prisma.user.count()

const fetchSignupAvailability = async (): Promise<SignupAvailability> =>
  computeSignupAvailability(await getCurrentUserCount(), FREE_USER_LIMIT)

/**
 * Free founding-signup window state (spots left). Drives signup gating and the
 * join CTA wording across the site. Cached briefly; busted after each signup.
 */
export const getSignupAvailability = (): Promise<SignupAvailability> =>
  unstable_cache(fetchSignupAvailability, [FREE_SIGNUP_WINDOW_TAG], {
    revalidate: FREE_SIGNUP_WINDOW_REVALIDATE_SECONDS,
    tags: [FREE_SIGNUP_WINDOW_TAG],
  })()

/**
 * Returns true if free signups are still available (current count < FREE_USER_LIMIT).
 * Use this in the signup action to gate signups and redirect to /subscribe when at limit.
 */
export const canSignupForFree = async (): Promise<boolean> =>
  (await getSignupAvailability()).freeOpen

/** Call after a user is created so spots-left and CTA wording update immediately. */
export const revalidateSignupAvailability = (): void => {
  revalidateTag(FREE_SIGNUP_WINDOW_TAG, "max")
}
