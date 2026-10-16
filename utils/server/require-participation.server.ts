import { redirect } from "next/navigation"

import {
  type ParticipationUser,
  requireParticipationForUser,
} from "@/utils/membership/entitlements.server"

/** Redirect unpaid (non-grandfathered) users to subscribe for a participation page. */
export const redirectUnlessCanParticipate = async (
  user: ParticipationUser,
  redirectPath: string
): Promise<void> => {
  const participation = await requireParticipationForUser(user)
  if (!participation.ok) {
    redirect(
      `/subscribe?tier=member&redirect=${encodeURIComponent(redirectPath)}`
    )
  }
}
