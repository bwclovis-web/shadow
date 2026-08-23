import { redirect } from "next/navigation"

import { requireParticipation } from "@/utils/membership/entitlements.server"

/** Redirect unpaid (non-grandfathered) users to subscribe for a participation page. */
export const redirectUnlessCanParticipate = async (
  userId: string,
  redirectPath: string
): Promise<void> => {
  const participation = await requireParticipation(userId)
  if (!participation.ok) {
    redirect(
      `/subscribe?tier=member&redirect=${encodeURIComponent(redirectPath)}`
    )
  }
}
