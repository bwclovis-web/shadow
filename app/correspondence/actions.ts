"use server"

import { parseWithZod } from "@conform-to/zod"
import type { SubmissionResult } from "@conform-to/react"
import { headers } from "next/headers"

import {
  createAdminAlertsForPendingSubmission,
  createPendingSubmission,
} from "@/models/pending-submission.server"
import { validateRateLimit } from "@/utils/api-validation.server"
import { requireCSRF } from "@/utils/server/csrf.server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getClientIdentifierFromHeaders } from "@/utils/server/request.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import {
  CreatePerfumeHouseSchema,
  CreatePerfumeSchema,
} from "@/utils/validation/formValidationSchemas"

const PENDING_SUBMISSION_WINDOW_MS = 60 * 60 * 1000
const PENDING_SUBMISSION_MAX_PER_HOUR = 20

export type ContactPendingFatal = { readonly _fatal: true; message: string }

export type ContactPendingActionState =
  | SubmissionResult
  | ContactPendingFatal
  | null

const rateLimitOrFatal = async (): Promise<ContactPendingFatal | null> => {
  const h = await headers()
  const clientId = getClientIdentifierFromHeaders(h)
  try {
    validateRateLimit(
      `pending-submission:${clientId}`,
      PENDING_SUBMISSION_MAX_PER_HOUR,
      PENDING_SUBMISSION_WINDOW_MS
    )
  } catch (e) {
    if (e instanceof Response) {
      const data = (await e.json().catch(() => ({}))) as { error?: string }
      return {
        _fatal: true,
        message: data.error ?? "Too many submissions. Try again later.",
      }
    }
    throw e
  }
  return null
}

const csrfOrFatal = async (
  formData: FormData
): Promise<ContactPendingFatal | null> => {
  const request = new Request("http://localhost", { method: "POST" })
  try {
    await requireCSRF(request, formData)
  } catch {
    return { _fatal: true, message: "Invalid security token" }
  }
  return null
}

export const submitPendingPerfumeFromContactAction = async (
  _prev: ContactPendingActionState,
  formData: FormData
): Promise<ContactPendingActionState> => {
  const rl = await rateLimitOrFatal()
  if (rl) return rl

  const csrf = await csrfOrFatal(formData)
  if (csrf) return csrf

  const submission = parseWithZod(formData, { schema: CreatePerfumeSchema })
  if (submission.status !== "success") {
    return submission.reply()
  }

  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })
  const submittedBy = session?.user?.id

  const submissionData = { ...submission.value } as Record<string, unknown>
  const created = await createPendingSubmission(
    "perfume",
    submissionData,
    submittedBy
  )
  await createAdminAlertsForPendingSubmission(
    created.id,
    "perfume",
    submissionData
  )

  return { status: "success", value: {} } as unknown as SubmissionResult
}

export const submitPendingHouseFromContactAction = async (
  _prev: ContactPendingActionState,
  formData: FormData
): Promise<ContactPendingActionState> => {
  const rl = await rateLimitOrFatal()
  if (rl) return rl

  const csrf = await csrfOrFatal(formData)
  if (csrf) return csrf

  const submission = parseWithZod(formData, { schema: CreatePerfumeHouseSchema })
  if (submission.status !== "success") {
    return submission.reply()
  }

  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })
  const submittedBy = session?.user?.id

  const submissionData = { ...submission.value } as Record<string, unknown>
  const created = await createPendingSubmission(
    "perfume_house",
    submissionData,
    submittedBy
  )
  await createAdminAlertsForPendingSubmission(
    created.id,
    "perfume_house",
    submissionData
  )

  return { status: "success", value: {} } as unknown as SubmissionResult
}
