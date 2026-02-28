"use server"

import { parseWithZod } from "@conform-to/zod"
import { redirect } from "next/navigation"

import { createPerfumeHouse } from "@/models/house.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { requireCSRF } from "@/utils/server/csrf.server"
import { CreatePerfumeHouseSchema } from "@/utils/validation/formValidationSchemas"

import { cookies } from "next/headers"

export type CreateHouseActionState =
  | ReturnType<ReturnType<typeof parseWithZod>["reply"]>
  | { status: "error"; error: string }
  | null

const getCookieHeader = async (): Promise<string> => {
  const store = await cookies()
  return store
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ")
}

export const createHouseAction = async (
  _prevState: CreateHouseActionState,
  formData: FormData
): Promise<CreateHouseActionState> => {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!session?.user) {
    redirect("/sign-in?redirect=/admin/create-house")
  }

  const isAdmin = session.user.role === "admin" || session.user.role === "editor"
  if (!isAdmin) {
    redirect("/unauthorized")
  }

  const request = new Request("http://localhost", { method: "POST" })
  await requireCSRF(request, formData)

  const submission = parseWithZod(formData, { schema: CreatePerfumeHouseSchema })
  if (submission.status !== "success") {
    return submission.reply()
  }

  const res = await createPerfumeHouse(formData)
  if (res.success) {
    redirect("/houses")
  }

  return {
    status: "error",
    error: res.error ?? "Failed to create perfume house",
    initialValue: submission.value,
  }
}
