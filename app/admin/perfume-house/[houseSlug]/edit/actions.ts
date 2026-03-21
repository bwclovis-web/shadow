"use server"

import { parseWithZod } from "@conform-to/zod"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { retryPerfumeHouseImageUpload, updatePerfumeHouse } from "@/models/house.server"
import { revalidateHouseDataCache } from "@/utils/server/revalidate-catalog-cache.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { requireCSRF } from "@/utils/server/csrf.server"
import { UpdatePerfumeHouseSchema } from "@/utils/validation/formValidationSchemas"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"

export type EditHouseActionState =
  | ReturnType<Awaited<ReturnType<typeof parseWithZod>>["reply"]>
  | { status: "error"; error: string }
  | null

export type RetryHouseImageActionState =
  | { status: "success"; message: string }
  | { status: "error"; error: string }
  | null

export const editHouseAction = async (
  _prevState: EditHouseActionState,
  formData: FormData
): Promise<EditHouseActionState> => {
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

  const submission = parseWithZod(formData, { schema: UpdatePerfumeHouseSchema })
  if (submission.status !== "success") {
    return submission.reply()
  }

  const houseIdEntry = formData.get("houseId")
  if (typeof houseIdEntry !== "string" || !houseIdEntry) {
    return {
      status: "error",
      error: "House ID is required",
      initialValue: submission.value,
    }
  }

  const res = await updatePerfumeHouse(houseIdEntry, formData)

  if (res.success && res.data) {
    const slug = res.data.slug
    revalidatePath("/houses")
    revalidatePath(`/houses/${slug}`)
    redirect(`/houses/${slug}`)
  }

  return {
    status: "error",
    error: res.error ?? "Failed to update perfume house",
    initialValue: submission.value,
  }
}

export const retryHouseImageAction = async (
  _prevState: RetryHouseImageActionState,
  formData: FormData
): Promise<RetryHouseImageActionState> => {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, { includeUser: true })

  if (!session?.user) {
    redirect("/sign-in?redirect=/admin")
  }
  const isAdmin = session.user.role === "admin" || session.user.role === "editor"
  if (!isAdmin) {
    redirect("/unauthorized")
  }

  const request = new Request("http://localhost", { method: "POST" })
  await requireCSRF(request, formData)

  const houseIdEntry = formData.get("houseId")
  if (typeof houseIdEntry !== "string" || !houseIdEntry) {
    return { status: "error", error: "House ID is required" }
  }

  const result = await retryPerfumeHouseImageUpload(houseIdEntry)
  if (!result.success) {
    return { status: "error", error: result.error ?? "Retry failed" }
  }

  revalidateHouseDataCache()
  return { status: "success", message: "Image upload retried successfully." }
}

