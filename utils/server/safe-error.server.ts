/**
 * Safe public API error responses — never leak stack traces or internal details.
 */

import { NextResponse } from "next/server"
import { randomUUID } from "crypto"

export const createCorrelationId = (): string =>
  `req_${randomUUID().replace(/-/g, "").slice(0, 16)}`

export type SafeErrorOptions = {
  status?: number
  publicMessage?: string
  correlationId?: string
  /** Logged server-side only */
  cause?: unknown
}

/**
 * Build a JSON error response safe for clients, with a correlation ID for support.
 */
export const safeJsonError = (
  options: SafeErrorOptions = {}
): NextResponse => {
  const {
    status = 500,
    publicMessage = "Something went wrong. Please try again later.",
    correlationId = createCorrelationId(),
    cause,
  } = options

  if (cause) {
    const msg = cause instanceof Error ? cause.message : String(cause)
    console.error(
      JSON.stringify({
        type: "api_error",
        correlationId,
        status,
        message: msg,
      })
    )
  }

  return NextResponse.json(
    {
      success: false,
      error: publicMessage,
      correlationId,
    },
    {
      status,
      headers: { "x-correlation-id": correlationId },
    }
  )
}
