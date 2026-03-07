import type { User, UserRole } from "@prisma/client"

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
  user?: AuthUser
}

export const authenticateUser = async (request: Request): Promise<AuthResult> => {
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
      username: u.username ?? null,
      role: u.role as UserRole,
    }
    return { success: true, user }
  } catch (error) {
    console.error("Authentication error:", error)
    return { success: false, error: "Authentication failed", status: 500 }
  }
}
