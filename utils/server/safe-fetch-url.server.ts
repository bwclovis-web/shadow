import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

/**
 * SSRF-safe URL validation and fetch helpers.
 * Blocks localhost, private/link-local/metadata IPs, unsafe protocols,
 * oversized responses, and unvalidated redirects.
 */

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024
const DEFAULT_TIMEOUT_MS = 15_000
const MAX_REDIRECTS = 5

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
])

const isPrivateOrReservedIpv4 = (ip: string): boolean => {
  const parts = ip.split(".").map(n => Number(n))
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true
  }
  const [a, b] = parts as [number, number, number, number]
  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a === 192 && b === 0 && parts[2] === 0) return true
  if (a >= 224) return true // multicast / reserved
  return false
}

const isPrivateOrReservedIpv6 = (ip: string): boolean => {
  const normalized = ip.toLowerCase()
  if (normalized === "::" || normalized === "::1") return true
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true // ULA
  if (normalized.startsWith("fe80")) return true // link-local
  if (normalized.startsWith("ff")) return true // multicast
  // IPv4-mapped IPv6
  const v4Mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (v4Mapped?.[1]) return isPrivateOrReservedIpv4(v4Mapped[1])
  return false
}

export const isBlockedIpAddress = (ip: string): boolean => {
  const version = isIP(ip)
  if (version === 4) return isPrivateOrReservedIpv4(ip)
  if (version === 6) return isPrivateOrReservedIpv6(ip)
  return true
}

export type SafeUrlValidationResult =
  | { ok: true; url: URL }
  | { ok: false; error: string }

export const validateSafeHttpUrl = async (
  rawUrl: string
): Promise<SafeUrlValidationResult> => {
  let url: URL
  try {
    url = new URL(rawUrl.trim())
  } catch {
    return { ok: false, error: "Invalid URL" }
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "URL must use http or https" }
  }

  if (url.username || url.password) {
    return { ok: false, error: "URLs with credentials are not allowed" }
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "")
  if (!hostname) {
    return { ok: false, error: "URL hostname is required" }
  }

  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost")) {
    return { ok: false, error: "Localhost URLs are not allowed" }
  }

  if (hostname === "metadata.google.internal" || hostname.endsWith(".internal")) {
    return { ok: false, error: "Internal hostnames are not allowed" }
  }

  const ipVersion = isIP(hostname)
  if (ipVersion) {
    if (isBlockedIpAddress(hostname)) {
      return { ok: false, error: "Private or reserved IP addresses are not allowed" }
    }
    return { ok: true, url }
  }

  try {
    const records = await lookup(hostname, { all: true, verbatim: true })
    if (!records.length) {
      return { ok: false, error: "Hostname could not be resolved" }
    }
    for (const record of records) {
      if (isBlockedIpAddress(record.address)) {
        return {
          ok: false,
          error: "Hostname resolves to a private or reserved IP address",
        }
      }
    }
  } catch {
    return { ok: false, error: "Hostname could not be resolved" }
  }

  return { ok: true, url }
}

export type SafeFetchOptions = {
  method?: string
  headers?: HeadersInit
  signal?: AbortSignal
  timeoutMs?: number
  maxBytes?: number
  /** When false, redirects are not followed (default: validate each hop). */
  followRedirects?: boolean
}

export type SafeFetchResult = {
  response: Response
  finalUrl: string
  body: ArrayBuffer
}

const readBodyWithLimit = async (
  res: Response,
  maxBytes: number
): Promise<ArrayBuffer> => {
  const contentLength = res.headers.get("content-length")
  if (contentLength) {
    const len = Number(contentLength)
    if (Number.isFinite(len) && len > maxBytes) {
      throw new Error(`Response exceeds maximum size of ${maxBytes} bytes`)
    }
  }

  if (!res.body) {
    return new ArrayBuffer(0)
  }

  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel()
        throw new Error(`Response exceeds maximum size of ${maxBytes} bytes`)
      }
      chunks.push(value)
    }
  }

  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged.buffer
}

/**
 * Fetch a remote URL after SSRF checks. Redirects are re-validated per hop.
 */
export const safeFetchUrl = async (
  rawUrl: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResult> => {
  const {
    method = "GET",
    headers,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxBytes = DEFAULT_MAX_BYTES,
    followRedirects = true,
  } = options

  let currentUrl = rawUrl.trim()
  let redirects = 0

  while (true) {
    const validated = await validateSafeHttpUrl(currentUrl)
    if (!validated.ok) {
      throw new Error(validated.error)
    }

    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), timeoutMs)
    const onAbort = () => ac.abort()
    signal?.addEventListener("abort", onAbort)

    try {
      const res = await fetch(validated.url.toString(), {
        method,
        headers,
        redirect: "manual",
        signal: ac.signal,
      })

      if (
        followRedirects &&
        [301, 302, 303, 307, 308].includes(res.status)
      ) {
        const location = res.headers.get("location")
        if (!location) {
          throw new Error("Redirect missing Location header")
        }
        redirects += 1
        if (redirects > MAX_REDIRECTS) {
          throw new Error("Too many redirects")
        }
        currentUrl = new URL(location, validated.url).toString()
        continue
      }

      const body = await readBodyWithLimit(res, maxBytes)
      return {
        response: new Response(body, {
          status: res.status,
          statusText: res.statusText,
          headers: res.headers,
        }),
        finalUrl: validated.url.toString(),
        body,
      }
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener("abort", onAbort)
    }
  }
}

export const safeFetchText = async (
  rawUrl: string,
  options: SafeFetchOptions = {}
): Promise<{ status: number; text: string; ok: boolean; finalUrl: string }> => {
  const { response, body, finalUrl } = await safeFetchUrl(rawUrl, options)
  const text = new TextDecoder("utf-8", { fatal: false }).decode(body)
  return {
    status: response.status,
    text,
    ok: response.ok,
    finalUrl,
  }
}
