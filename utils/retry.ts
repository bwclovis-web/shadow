/**
 * Retry utility for transient failures (network, 5xx, etc.)
 */

export interface RetryOptions {
  maxRetries?: number
  initialDelayMs?: number
  maxDelayMs?: number
  backoffMultiplier?: number
  retryable?: (error: unknown) => boolean
  onRetry?: (error: unknown, attempt: number, nextDelay: number) => void
  onMaxRetriesReached?: (error: unknown, attempts: number) => void
}

export const retryPresets = {
  standard: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  } satisfies RetryOptions,
  aggressive: {
    maxRetries: 5,
    initialDelayMs: 500,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
  } satisfies RetryOptions,
  none: {
    maxRetries: 0,
  } satisfies RetryOptions,
} as const

const defaultRetryable = (error: unknown): boolean => {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    if (msg.includes("network") || msg.includes("fetch") || msg.includes("econnreset")) return true
  }
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: number }).status
    if (typeof status === "number" && status >= 500 && status < 600) return true
  }
  return false
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    retryable = defaultRetryable,
    onRetry,
    onMaxRetriesReached,
  } = options

  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt === maxRetries || !retryable(error)) {
        onMaxRetriesReached?.(error, attempt + 1)
        throw error
      }
      const delay = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt),
        maxDelayMs
      )
      onRetry?.(error, attempt + 1, delay)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw lastError
}
