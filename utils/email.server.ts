import { Resend } from "resend"

let resendClient: Resend | null = null
let missingConfigWarned = false
let invalidFromWarned = false

/** Resend requires `email@domain.com` or `Name <email@domain.com>`. */
export const isValidEmailFrom = (from: string | undefined): boolean => {
  const value = from?.trim()
  if (!value) return false
  if (/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)) return true
  return /^.+<[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>$/.test(value)
}

const warnInvalidEmailFrom = (from: string): void => {
  if (invalidFromWarned || process.env.NODE_ENV === "test") return
  invalidFromWarned = true
  console.warn(
    `[email] EMAIL_FROM is invalid for Resend (${JSON.stringify(from)}). ` +
      "Use `alerts@yourdomain.com` or `perfumer's hollow <alerts@yourdomain.com>`."
  )
}

const getResendClient = (): Resend | null => {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    if (!missingConfigWarned && process.env.NODE_ENV !== "test") {
      missingConfigWarned = true
      console.warn("[email] RESEND_API_KEY is not set; transactional emails are disabled")
    }
    return null
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey)
  }
  return resendClient
}

export const getAppBaseUrl = (): string => {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
  return fromEnv ?? "http://localhost:3000"
}

export const isSendableRecipientEmail = (
  email: string | null | undefined
): email is string => !!email && !email.startsWith("deleted_")

export type TransactionalEmailParams = {
  to: string
  subject: string
  text: string
  html?: string
}

export const sendTransactionalEmail = async (
  params: TransactionalEmailParams
): Promise<{ sent: boolean; id?: string }> => {
  const client = getResendClient()
  const from = process.env.EMAIL_FROM?.trim()
  if (!client || !from) {
    if (!missingConfigWarned && process.env.NODE_ENV !== "test") {
      missingConfigWarned = true
      console.warn("[email] RESEND_API_KEY or EMAIL_FROM is not set; transactional emails are disabled")
    }
    return { sent: false }
  }

  if (!isValidEmailFrom(from)) {
    warnInvalidEmailFrom(from)
    return { sent: false }
  }

  const { data, error } = await client.emails.send({
    from,
    to: params.to,
    subject: params.subject,
    text: params.text,
    ...(params.html ? { html: params.html } : {}),
  })

  if (error) {
    const detail = error.message
    if (process.env.NODE_ENV === "development") {
      console.error("[email] Resend API error:", detail)
    }
    throw new Error(detail)
  }

  if (process.env.NODE_ENV === "development") {
    console.log(`[email] Resend accepted message to ${params.to} (id: ${data?.id ?? "unknown"})`)
  }

  return { sent: true, id: data?.id }
}

/** Reset cached client (tests only). */
export const resetEmailClientForTests = (): void => {
  resendClient = null
  missingConfigWarned = false
  invalidFromWarned = false
}
