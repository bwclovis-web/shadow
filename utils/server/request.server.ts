/**
 * Server-side request utilities (e.g. client identifier for rate limiting).
 */

/**
 * Returns a stable identifier for the client (e.g. for rate limiting).
 * Uses X-Forwarded-For (first hop) or X-Real-IP when behind a proxy, otherwise "unknown".
 */
export const getClientIdentifierFromHeaders = (h: Headers): string => {
  const forwarded = h.get("x-forwarded-for")
  const first = forwarded?.split(",")[0]?.trim()
  if (first) return first
  const realIp = h.get("x-real-ip")?.trim()
  if (realIp) return realIp
  return "unknown"
}

export const getClientIdentifier = (request: Request): string =>
  getClientIdentifierFromHeaders(request.headers)
