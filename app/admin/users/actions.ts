"use server"

import type { MembershipTier, UserRole } from "@prisma/client"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { redirect } from "next/navigation"

import {
  deleteUserSafely,
  issueStrike,
  softDeleteUser,
  updateUserMembershipTier,
  updateUserRole,
} from "@/models/admin.server"
import { adminResetTwoFactor } from "@/models/two-factor.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { requireCSRF, CSRFError } from "@/utils/server/csrf.server"

const VALID_ROLES: UserRole[] = ["user", "editor", "admin"]
const VALID_MEMBERSHIP_TIERS: MembershipTier[] = [
  "free",
  "premium",
  "collector",
]

const withCsrf = async <T,>(
  formData: FormData,
  run: () => Promise<T>
): Promise<T | { success: false; message: string }> => {
  try {
    const request = new Request("http://localhost", { method: "POST" })
    await requireCSRF(request, formData)
    return run()
  } catch (error) {
    if (error instanceof CSRFError) {
      return { success: false, message: error.message }
    }
    throw error
  }
}

export type DeleteUserActionState = {
  success: boolean
  message: string
} | null

export type UpdateRoleActionState = {
  success: boolean
  message: string
  userId?: string
  role?: UserRole
} | null

export type UpdateMembershipActionState = {
  success: boolean
  message: string
  userId?: string
  membershipTier?: MembershipTier
} | null

export type IssueStrikeActionState = {
  success: boolean
  message: string
  userId?: string
  strikeCount?: number
  isBanned?: boolean
} | null

export const deleteUserAction = async (
  _prevState: DeleteUserActionState,
  formData: FormData
): Promise<DeleteUserActionState> => {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!session?.user) {
    redirect("/sign-in?redirect=/admin/users")
  }

  if (session.user.role !== "admin") {
    return { success: false, message: "Unauthorized" }
  }

  const request = new Request("http://localhost", { method: "POST" })
  await requireCSRF(request, formData)

  const action = formData.get("action")
  const userId = formData.get("userId")

  if (typeof action !== "string" || typeof userId !== "string") {
    return { success: false, message: "Invalid request" }
  }

  if (action !== "delete" && action !== "soft-delete") {
    return { success: false, message: "Invalid action" }
  }

  const result =
    action === "delete"
      ? await deleteUserSafely(userId, session.user.id)
      : await softDeleteUser(userId, session.user.id)

  if (result.success) {
    redirect("/admin/users")
  }

  return result
}

export const updateUserRoleAction = async (
  _prevState: UpdateRoleActionState,
  formData: FormData
): Promise<UpdateRoleActionState> => {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!session?.user) {
    redirect("/sign-in?redirect=/admin/users")
  }

  if (session.user.role !== "admin") {
    return { success: false, message: "Unauthorized" }
  }

  return withCsrf(formData, async () => {
    const userId = formData.get("userId")
    const newRole = formData.get("newRole")

    if (typeof userId !== "string" || typeof newRole !== "string") {
      return { success: false, message: "Invalid request" }
    }

    if (!VALID_ROLES.includes(newRole as UserRole)) {
      return { success: false, message: "Invalid role" }
    }

    return updateUserRole(userId, newRole as UserRole, session.user.id)
  })
}

export const updateUserMembershipAction = async (
  _prevState: UpdateMembershipActionState,
  formData: FormData
): Promise<UpdateMembershipActionState> => {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!session?.user) {
    redirect("/sign-in?redirect=/admin/users")
  }

  if (session.user.role !== "admin") {
    return { success: false, message: "Unauthorized" }
  }

  return withCsrf(formData, async () => {
    const userId = formData.get("userId")
    const newTier = formData.get("newMembershipTier")

    if (typeof userId !== "string" || typeof newTier !== "string") {
      return { success: false, message: "Invalid request" }
    }

    if (!VALID_MEMBERSHIP_TIERS.includes(newTier as MembershipTier)) {
      return { success: false, message: "Invalid membership tier" }
    }

    const result = await updateUserMembershipTier(
      userId,
      newTier as MembershipTier,
      session.user.id
    )

    if (result.success) {
      return { ...result, userId }
    }

    return result
  })
}

export const issueStrikeAction = async (
  _prevState: IssueStrikeActionState,
  formData: FormData
): Promise<IssueStrikeActionState> => {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!session?.user) {
    redirect("/sign-in?redirect=/admin/users")
  }

  if (session.user.role !== "admin") {
    return { success: false, message: "Unauthorized" }
  }

  const request = new Request("http://localhost", { method: "POST" })
  await requireCSRF(request, formData)

  const userId = formData.get("userId")
  const reason = formData.get("reason")

  if (typeof userId !== "string") {
    return { success: false, message: "Invalid request" }
  }

  if (typeof reason !== "string") {
    return { success: false, message: "Invalid request" }
  }

  const result = await issueStrike(userId, reason, session.user.id)

  if (result.success) {
    return {
      ...result,
      userId,
    }
  }

  return result
}

export type ResetTwoFactorActionState = {
  success: boolean
  message: string
} | null

export const resetTwoFactorAction = async (
  _prevState: ResetTwoFactorActionState,
  formData: FormData
): Promise<ResetTwoFactorActionState> => {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!session?.user) {
    redirect("/sign-in?redirect=/admin/users")
  }

  if (session.user.role !== "admin") {
    return { success: false, message: "Unauthorized" }
  }

  const request = new Request("http://localhost", { method: "POST" })
  await requireCSRF(request, formData)

  const userId = formData.get("userId")
  if (typeof userId !== "string") {
    return { success: false, message: "Invalid request" }
  }

  const result = await adminResetTwoFactor(userId, session.user.id)
  if (result.success) {
    return { success: true, message: result.message }
  }
  return { success: false, message: result.error }
}
