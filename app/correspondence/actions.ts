"use server"

import { parseWithZod } from "@conform-to/zod"
import type { SubmissionResult } from "@conform-to/react"
import { headers } from "next/headers"

import {
  createAdminAlertsForPendingSubmission,
  createPendingSubmission,
} from "@/models/pending-submission.server"
import { getSiteContactEmail } from "@/lib/seo/site-contact"
import { validateRateLimit } from "@/utils/api-validation.server"
import { sendTransactionalEmail } from "@/utils/email.server"
import { requireCSRF } from "@/utils/server/csrf.server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getClientIdentifierFromHeaders } from "@/utils/server/request.server"
import {
  getTurnstileTokenFromFormData,
  verifyTurnstileToken,
} from "@/utils/security/turnstile.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import {
  ContactUsSchema,
  CreatePerfumeHouseSchema,
  CreatePerfumeSchema,
} from "@/utils/validation/formValidationSchemas"

const PENDING_SUBMISSION_WINDOW_MS = 60 * 60 * 1000
const PENDING_SUBMISSION_MAX_PER_HOUR = 20

const CONTACT_US_WINDOW_MS = 60 * 60 * 1000
const CONTACT_US_MAX_PER_HOUR = 5

export type ContactPendingFatal = { readonly _fatal: true; message: string }

export type ContactPendingActionState =
  | SubmissionResult
  | ContactPendingFatal
  | null

export type ContactUsActionState =
  | SubmissionResult
  | ContactPendingFatal
  | null

const rateLimitOrFatal = async (
  keyPrefix: string,
  max: number,
  windowMs: number
): Promise<ContactPendingFatal | null> => {
  const h = await headers()
  const clientId = getClientIdentifierFromHeaders(h)
  try {
    await validateRateLimit(`${keyPrefix}:${clientId}`, max, windowMs)
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

export const submitContactUsAction = async (
  _prev: ContactUsActionState,
  formData: FormData
): Promise<ContactUsActionState> => {
  // Honeypot: pretend success if bots fill the hidden field
  const honeypot = String(formData.get("website") ?? "").trim()
  if (honeypot) {
    return { status: "success", value: {} } as unknown as SubmissionResult
  }

  const rl = await rateLimitOrFatal(
    "contact-us",
    CONTACT_US_MAX_PER_HOUR,
    CONTACT_US_WINDOW_MS
  )
  if (rl) return rl

  const csrf = await csrfOrFatal(formData)
  if (csrf) return csrf

  const clientId = getClientIdentifierFromHeaders(await headers())
  const turnstile = await verifyTurnstileToken(
    getTurnstileTokenFromFormData(formData),
    clientId
  )
  if (!turnstile.ok) {
    return { _fatal: true, message: turnstile.error }
  }

  const submission = parseWithZod(formData, { schema: ContactUsSchema })
  if (submission.status !== "success") {
    return submission.reply()
  }

  const { name, email, subject, message } = submission.value
  const inbox = getSiteContactEmail()
  const emailSubject = subject?.trim()
    ? `[Contact] ${subject.trim()}`
    : `[Contact] Message from ${name}`

  const text = [
    `New contact form message from perfumer's hollow`,
    ``,
    `Name: ${name}`,
    `Email: ${email}`,
    subject?.trim() ? `Subject: ${subject.trim()}` : null,
    ``,
    `Message:`,
    message,
  ]
    .filter(line => line !== null)
    .join("\n")

  try {
    const result = await sendTransactionalEmail({
      to: inbox,
      subject: emailSubject,
      text,
      replyTo: email,
    })

    if (!result.sent) {
      return {
        _fatal: true,
        message: "Unable to send your message right now. Please try again later.",
      }
    }
  } catch {
    return {
      _fatal: true,
      message: "Unable to send your message right now. Please try again later.",
    }
  }

  return { status: "success", value: {} } as unknown as SubmissionResult
}

export const submitPendingPerfumeFromContactAction = async (
  _prev: ContactPendingActionState,
  formData: FormData
): Promise<ContactPendingActionState> => {
  const rl = await rateLimitOrFatal(
    "pending-submission",
    PENDING_SUBMISSION_MAX_PER_HOUR,
    PENDING_SUBMISSION_WINDOW_MS
  )
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
  const rl = await rateLimitOrFatal(
    "pending-submission",
    PENDING_SUBMISSION_MAX_PER_HOUR,
    PENDING_SUBMISSION_WINDOW_MS
  )
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
