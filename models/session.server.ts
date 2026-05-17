/**
 * Session helpers for Next.js App Router.
 * Auth flows use utils/session-from-request.server and utils/security/session-manager.server directly.
 */

import { invalidateAllUserSessions } from "@/utils/security/session-manager.server"

/** Invalidate all sessions for a user (e.g. after password change). */
export const invalidateAllSessions = (userId: string): Promise<void> =>
  invalidateAllUserSessions(userId)
