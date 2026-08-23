import type { MembershipTier } from "@prisma/client"

import { prisma } from "@/lib/db"
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

export const resolveMembershipTier = (user: {
  membershipTier?: MembershipTier | null
  subscriptionStatus?: string | null
}): MembershipTier => {
  if (user.membershipTier === "collector" || user.membershipTier === "premium") {
    return user.membershipTier
  }
  if (user.subscriptionStatus === "paid") return "premium"
  return "free"
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
    (params.subscriptionStatus === "paid" ? "premium" : "free")
  return prisma.user.update({
    where: { id: params.userId },
    data: { membershipTier: tier },
  })
}
