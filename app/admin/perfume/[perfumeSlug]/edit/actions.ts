"use server"

import { parseWithZod } from "@conform-to/zod"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { updatePerfume } from "@/models/perfume.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { requireCSRF } from "@/utils/server/csrf.server"
import { UpdatePerfumeSchema } from "@/utils/validation/formValidationSchemas"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"

export type EditPerfumeActionState =
  | ReturnType<Awaited<ReturnType<typeof parseWithZod>>["reply"]>
  | { status: "error"; error: string; initialValue?: Record<string, unknown> }
  | null

export const editPerfumeAction = async (
  _prevState: EditPerfumeActionState,
  formData: FormData
): Promise<EditPerfumeActionState> => {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!session?.user) {
    redirect("/sign-in?redirect=/admin")
  }

  const isAdmin = session.user.role === "admin" || session.user.role === "editor"
  if (!isAdmin) {
    redirect("/unauthorized")
  }

  const request = new Request("http://localhost", { method: "POST" })
  await requireCSRF(request, formData)

  const submission = parseWithZod(formData, { schema: UpdatePerfumeSchema })
  if (submission.status !== "success") {
    return submission.reply()
  }

  const perfumeIdEntry = formData.get("perfumeId")
  if (typeof perfumeIdEntry !== "string" || !perfumeIdEntry) {
    return {
      status: "error",
      error: "Perfume ID is required",
      initialValue: submission.value,
    }
  }

  const res = await updatePerfume(perfumeIdEntry, formData)

  if (res.success && res.data) {
    const slug = res.data.slug
    revalidatePath(`/perfume/${slug}`)
    redirect(`/perfume/${slug}`)
  }

  return {
    status: "error",
    error: res.error ?? "Failed to update perfume",
    initialValue: submission.value,
  }
}
