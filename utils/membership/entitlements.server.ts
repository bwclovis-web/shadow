import type { MembershipTier } from "@prisma/client"

import { prisma } from "@/lib/db"
import { canSignupForFree } from "@/utils/server/user-limit.server"
import {
  COLLECTOR_ENTITLEMENTS,
  FREE_ENTITLEMENTS,
  MEMBERSHIP_BENEFITS,
  PREMIUM_ENTITLEMENTS,
  type DigitalEntitlement,
} from "@/utils/membership/benefits"

export type { DigitalEntitlement }
export { MEMBERSHIP_BENEFITS }

export const entitlementsForTier = (
  tier: MembershipTier
): DigitalEntitlement[] => {
  if (tier === "collector") return COLLECTOR_ENTITLEMENTS
  if (tier === "premium") return PREMIUM_ENTITLEMENTS
  return FREE_ENTITLEMENTS
}

/**
 * Resolve effective membership tier.
 * Trusts explicit membershipTier for paid users (Member = free, Premium, Collector).
 * Does not auto-upgrade paid Member accounts to Premium.
 */
export const resolveMembershipTier = (user: {
  membershipTier?: MembershipTier | null
  subscriptionStatus?: string | null
}): MembershipTier => {
  if (user.membershipTier === "collector" || user.membershipTier === "premium") {
    return user.membershipTier
  }
  if (user.membershipTier === "free") {
    return "free"
  }
  // Legacy rows: paid with null/missing tier → treat as premium once
  if (user.subscriptionStatus === "paid") return "premium"
  return "free"
}

export type ParticipationUser = {
  isEarlyAdopter?: boolean | null
  subscriptionStatus?: string | null
}

/** Paid subscriber or grandfathered early adopter may participate. */
export const canParticipate = (user: ParticipationUser): boolean =>
  user.isEarlyAdopter === true || user.subscriptionStatus === "paid"

/** True while total users are under FREE_USER_LIMIT (platform-wide free window). */
export const canUserParticipateNow = async (
  user: ParticipationUser
): Promise<boolean> => {
  if (canParticipate(user)) return true
  return canSignupForFree()
}

export const requireParticipation = async (
  userId: string
): Promise<{ ok: true } | { ok: false; reason: "unpaid" | "not_found" }> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isEarlyAdopter: true,
      subscriptionStatus: true,
    },
  })
  if (!user) return { ok: false, reason: "not_found" }
  if (!(await canUserParticipateNow(user))) {
    return { ok: false, reason: "unpaid" }
  }
  return { ok: true }
}

export const userHasEntitlement = async (
  userId: string,
  entitlement: DigitalEntitlement
): Promise<boolean> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      membershipTier: true,
      subscriptionStatus: true,
    },
  })
  if (!user) return false
  const tier = resolveMembershipTier(user)
  return entitlementsForTier(tier).includes(entitlement)
}

export const requireEntitlement = async (
  userId: string,
  entitlement: DigitalEntitlement
): Promise<{ ok: true; tier: MembershipTier } | { ok: false; tier: MembershipTier }> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { membershipTier: true, subscriptionStatus: true },
  })
  const tier = resolveMembershipTier(user ?? { membershipTier: "free" })
  if (!entitlementsForTier(tier).includes(entitlement)) {
    return { ok: false, tier }
  }
  return { ok: true, tier }
}

export const syncMembershipTierFromSubscription = async (params: {
  userId: string
  subscriptionStatus: "free" | "paid" | "cancelled"
  desiredTier?: MembershipTier
}) => {
  const tier: MembershipTier =
    params.desiredTier ??
    (params.subscriptionStatus === "paid" ? "free" : "free")
  return prisma.user.update({
    where: { id: params.userId },
    data: { membershipTier: tier },
  })
}
