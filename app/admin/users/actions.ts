"use server"

import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { redirect } from "next/navigation"

import {
  deleteUserSafely,
  softDeleteUser,
} from "@/models/admin.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { requireCSRF } from "@/utils/server/csrf.server"

export type DeleteUserActionState = {
  success: boolean
  message: string
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
