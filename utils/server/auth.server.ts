import { getSessionFromRequest } from "@/utils/session-from-request.server"

export type AuthResult = {
  success: boolean
  error?: string
  status?: number
  user?: any
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

    return { success: true, user: session.user }
  } catch (error) {
    console.error("Authentication error:", error)
    return { success: false, error: "Authentication failed", status: 500 }
  }
}
