import type { User, UserRole } from "@prisma/client"

import { requireParticipation } from "@/utils/membership/entitlements.server"
import { getSessionFromRequest } from "@/utils/session-from-request.server"

/** Authenticated user shape (subset of Prisma User returned by auth; no password) */
export type AuthUser = Pick<
  User,
  "id" | "email" | "firstName" | "lastName" | "username" | "role"
>

export type AuthResult = {
  success: boolean
  error?: string
  status?: number
  code?: string
  user?: AuthUser
}

export type AuthenticateUserOptions = {
  /**
   * When true (default), require paid membership or grandfathered early adopter.
   * Set false for log-out, membership status, and other auth-only endpoints.
   */
  requireParticipation?: boolean
}

export const authenticateUser = async (
  request: Request,
  options: AuthenticateUserOptions = {}
): Promise<AuthResult> => {
  const requirePaid = options.requireParticipation !== false
  try {
    const session = await getSessionFromRequest(request, { includeUser: true })

    if (!session) {
      return { success: false, error: "User not authenticated", status: 401 }
    }

    if (!session.user) {
      return { success: false, error: "User not found", status: 401 }
    }

    const u = session.user
    const user: AuthUser = {
      id: u.id,
      email: u.email,
      firstName: u.firstName ?? null,
      lastName: u.lastName ?? null,
      username: u.username ?? "",
      role: u.role as UserRole,
    }

    if (requirePaid) {
      const participation = await requireParticipation(user.id)
      if (!participation.ok) {
        return {
          success: false,
          error: "Active membership required to participate",
          status: 403,
          code: "subscription_required",
        }
      }
    }

    return { success: true, user }
  } catch (error) {
    console.error("Authentication error:", error)
    return { success: false, error: "Authentication failed", status: 500 }
  }
}

/** Explicit alias: auth + participation (same as authenticateUser default). */
export const authenticateParticipatingUser = (
  request: Request
): Promise<AuthResult> => authenticateUser(request, { requireParticipation: true })
