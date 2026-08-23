import { redirect } from "next/navigation"

import { prisma } from "@/lib/db"
import { canParticipate } from "@/utils/membership/entitlements.server"

/** Redirect unpaid (non-grandfathered) users to subscribe for a participation page. */
export const redirectUnlessCanParticipate = async (
  userId: string,
  redirectPath: string
): Promise<void> => {
  const billing = await prisma.user.findUnique({
    where: { id: userId },
    select: { isEarlyAdopter: true, subscriptionStatus: true },
  })
  if (!billing || !canParticipate(billing)) {
    redirect(
      `/subscribe?tier=member&redirect=${encodeURIComponent(redirectPath)}`
    )
  }
}
