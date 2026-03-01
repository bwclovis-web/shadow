import { NextResponse } from "next/server"

import type { AuthResult } from "@/utils/server/auth.server"
import { authenticateUser } from "@/utils/server/auth.server"

export type RequireAdminOrEditorResult =
  | { allowed: true; user: NonNullable<AuthResult["user"]> }
  | { allowed: false; response: NextResponse }

const MUTATION_RESPONSE = { success: false, message: "Unauthorized" } as const

/**
 * Require an authenticated user with admin or editor role for API routes.
 * Returns a NextResponse for 401/403 so the route can return it directly.
 * Use in mutation API routes (POST/DELETE) that modify data.
 */
export const requireAdminOrEditorApi = async (
  request: Request
): Promise<RequireAdminOrEditorResult> => {
  const auth = await authenticateUser(request)

  if (!auth.success || !auth.user) {
    const status = auth.status ?? 401
    return {
      allowed: false,
      response: NextResponse.json(
        status === 401 ? { success: false, message: "Authentication required" } : MUTATION_RESPONSE,
        { status }
      ),
    }
  }

  const role = auth.user.role
  if (role !== "admin" && role !== "editor") {
    return {
      allowed: false,
      response: NextResponse.json(MUTATION_RESPONSE, { status: 403 }),
    }
  }

  return { allowed: true, user: auth.user }
}
