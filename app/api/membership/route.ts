import { NextRequest, NextResponse } from "next/server"

import { resolveMembershipTier, entitlementsForTier } from "@/utils/membership/entitlements.server"
import { MEMBERSHIP_BENEFITS } from "@/utils/membership/benefits"
import { authenticateUser } from "@/utils/server/auth.server"
import { prisma } from "@/lib/db"

export const GET = async (request: NextRequest) => {
  const auth = await authenticateUser(request, { requireParticipation: false })
  if (!auth.success) {
    return NextResponse.json({
      success: true,
      tier: "free",
      entitlements: entitlementsForTier("free"),
      benefits: MEMBERSHIP_BENEFITS,
    })
  }
  const user = await prisma.user.findUnique({
    where: { id: auth.user!.id },
    select: {
      membershipTier: true,
      subscriptionStatus: true,
      subscriptionId: true,
      subscriptionStartDate: true,
    },
  })
  const tier = resolveMembershipTier(user ?? { membershipTier: "free" })
  return NextResponse.json({
    success: true,
    tier,
    entitlements: entitlementsForTier(tier),
    subscriptionStatus: user?.subscriptionStatus ?? "free",
    subscriptionId: user?.subscriptionId ?? null,
    subscriptionStartDate: user?.subscriptionStartDate ?? null,
    benefits: MEMBERSHIP_BENEFITS,
  })
}
