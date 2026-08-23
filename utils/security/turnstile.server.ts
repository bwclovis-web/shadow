/**
 * Cloudflare Turnstile server verification.
 * When TURNSTILE_SECRET_KEY is unset, verification is skipped (local/dev).
 * When set, a valid cf-turnstile-response token is required.
 */

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify"

export const isTurnstileConfigured = (): boolean =>
  Boolean(process.env.TURNSTILE_SECRET_KEY?.trim())

export const getTurnstileSiteKey = (): string | null => {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()
  return key || null
}

export type TurnstileVerifyResult =
  | { ok: true }
  | { ok: false; error: string }

export const verifyTurnstileToken = async (
  token: string | null | undefined,
  remoteIp?: string | null
): Promise<TurnstileVerifyResult> => {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim()
  if (!secret) {
    return { ok: true }
  }

  const trimmed = typeof token === "string" ? token.trim() : ""
  if (!trimmed) {
    return { ok: false, error: "Please complete the security check." }
  }

  try {
    const body = new URLSearchParams()
    body.set("secret", secret)
    body.set("response", trimmed)
    if (remoteIp) body.set("remoteip", remoteIp)

    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    })
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] }
    if (!data.success) {
      return { ok: false, error: "Security check failed. Please try again." }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: "Security check unavailable. Please try again." }
  }
}

/** Read token from FormData (widget field name) or header. */
export const getTurnstileTokenFromFormData = (formData: FormData): string | null => {
  const fromField = formData.get("cf-turnstile-response")
  if (typeof fromField === "string" && fromField.trim()) return fromField.trim()
  return null
}
