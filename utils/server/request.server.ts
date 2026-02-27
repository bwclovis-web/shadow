/**
 * Server-side request utilities (e.g. client identifier for rate limiting).
 */

/**
 * Returns a stable identifier for the client (e.g. for rate limiting).
 * Uses X-Forwarded-For (first hop) or X-Real-IP when behind a proxy, otherwise "unknown".
 */
export const getClientIdentifier = (request: Request): string => {
  const forwarded = request.headers.get("x-forwarded-for")
  const first = forwarded?.split(",")[0]?.trim()
  if (first) return first
  const realIp = request.headers.get("x-real-ip")?.trim()
  if (realIp) return realIp
  return "unknown"
}
