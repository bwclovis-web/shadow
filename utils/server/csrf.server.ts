/**
 * CSRF validation for server-side requests (double-submit pattern).
 * Compares the _csrf cookie with the token in x-csrf-token header or form _csrf.
 * Uses timing-safe comparison; fails closed with 403 on missing or mismatch.
 */

import { randomBytes } from "node:crypto"
import { timingSafeEqual as nodeTimingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"

export const CSRF_COOKIE_NAME = "_csrf" as const
export const CSRF_HEADER_NAME = "x-csrf-token" as const

/** Generate a cryptographically random token for double-submit CSRF. */
export const generateCsrfToken = (): string => randomBytes(32).toString("hex")

export class CSRFError extends Error {
  readonly statusCode = 403

  constructor(message = "Invalid security token") {
    super(message)
    this.name = "CSRFError"
    Object.setPrototypeOf(this, CSRFError.prototype)
  }
}

const getCsrfCookieFromRequest = async (request: Request): Promise<string | null> => {
  const cookieHeader = request.headers.get("cookie")
  if (cookieHeader) {
    const match = cookieHeader
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(`${CSRF_COOKIE_NAME}=`))
    if (match) {
      const value = match.slice(CSRF_COOKIE_NAME.length + 1).trim()
      if (value) return value
    }
  }

  // Fallback for server actions that use synthetic Request objects.
  const cookieStore = await cookies()
  return cookieStore.get(CSRF_COOKIE_NAME)?.value?.trim() || null
}

/** FormData or a parsed wrapper that exposes get(key) for CSRF token lookup */
type CSRFFormDataLike = FormData | { get(key: string): string | File | null }

const getCsrfTokenFromRequest = (request: Request, formData?: CSRFFormDataLike): string | null => {
  const header = request.headers.get(CSRF_HEADER_NAME)?.trim()
  if (header) return header
  const formToken = formData?.get(CSRF_COOKIE_NAME)
  if (formToken != null && typeof formToken === "string") {
    const trimmed = formToken.trim()
    return trimmed || null
  }
  return null
}

/**
 * Timing-safe comparison of two strings.
 * Uses fixed-time comparison to avoid leaking length or content via timing.
 */
const timingSafeEqual = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a, "utf8")
  const bufB = Buffer.from(b, "utf8")
  if (bufA.length !== bufB.length) {
    // Consume same time as a successful compare to avoid length leak
    nodeTimingSafeEqual(bufA, bufA)
    return false
  }
  return nodeTimingSafeEqual(bufA, bufB)
}

/**
 * Validates CSRF using double-submit: cookie value must match header or form token.
 * Call at the start of mutation handlers (server actions or API routes).
 * @throws CSRFError with statusCode 403 when cookie or token is missing or mismatch
 */
export const requireCSRF = async (
  request: Request,
  formData?: CSRFFormDataLike
): Promise<void> => {
  const cookieToken = await getCsrfCookieFromRequest(request)
  const submittedToken = getCsrfTokenFromRequest(request, formData)

  if (!cookieToken || !submittedToken) {
    throw new CSRFError("Invalid security token")
  }

  if (!timingSafeEqual(cookieToken, submittedToken)) {
    throw new CSRFError("Invalid security token")
  }
}
