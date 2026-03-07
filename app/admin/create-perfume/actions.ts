"use server"

import { parseWithZod } from "@conform-to/zod"
import { redirect } from "next/navigation"

import { createPerfume } from "@/models/perfume.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { requireCSRF } from "@/utils/server/csrf.server"
import { CreatePerfumeSchema } from "@/utils/validation/formValidationSchemas"

/** Next.js redirect() throws; re-throw so the redirect is performed. */
const isRedirectError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "digest" in error &&
  String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")

export type CreatePerfumeActionState =
  | ReturnType<Awaited<ReturnType<typeof parseWithZod>>["reply"]>
  | { status: "error"; error: string; initialValue?: Record<string, unknown> }
  | null

export const createPerfumeAction = async (
  _prevState: CreatePerfumeActionState,
  formData: FormData
): Promise<CreatePerfumeActionState> => {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!session?.user) {
    redirect("/sign-in?redirect=/admin/create-perfume")
  }

  const isAdmin =
    session.user.role === "admin" || session.user.role === "editor"
  if (!isAdmin) {
    redirect("/unauthorized")
  }

  const request = new Request("http://localhost", { method: "POST" })
  await requireCSRF(request, formData)

  const submission = parseWithZod(formData, { schema: CreatePerfumeSchema })
  if (submission.status !== "success") {
    return submission.reply()
  }

  try {
    const newPerfume = await createPerfume(formData)
    redirect(`/perfume/${newPerfume.slug}`)
  } catch (error) {
    if (isRedirectError(error)) throw error
    return {
      status: "error",
      error:
        error instanceof Error
          ? error.message
          : "An error occurred while creating the perfume",
      initialValue: submission.value,
    }
  }
}
