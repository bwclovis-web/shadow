"use server"

import { parseWithZod } from "@conform-to/zod"

import { getUserByName, updateUser } from "@/models/user.query"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { requireCSRF } from "@/utils/server/csrf.server"
import { UpdateProfileSchema } from "@/utils/validation/formValidationSchemas"

export type UpdateProfileActionState =
  | { success?: boolean; errors?: Record<string, string[]>; submission?: unknown }
  | null

export const updateProfileAction = async (
  _prevState: UpdateProfileActionState,
  formData: FormData
): Promise<UpdateProfileActionState> => {
  const request = new Request("http://localhost", { method: "POST" })
  await requireCSRF(request, formData)

  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })
  if (!session?.user) {
    return { errors: { general: ["You must be signed in to update your profile."] } }
  }

  const submission = parseWithZod(formData, { schema: UpdateProfileSchema })
  if (submission.status !== "success") {
    return { submission: submission.reply() }
  }

  const { username } = submission.value
  const userId = formData.get("userId") as string
  if (userId !== session.userId) {
    return { errors: { general: ["You can only update your own profile."] } }
  }

  const existingUser = await getUserByName(username)
  if (existingUser && existingUser.id !== userId) {
    return { errors: { username: ["Username is already taken"] } }
  }

  const { firstName, lastName, email } = submission.value
  await updateUser(userId, { firstName, lastName, username, email })
  return { success: true }
}
