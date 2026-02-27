/**
 * Correlation ID Utilities
 *
 * This module provides utilities for generating and managing correlation IDs
 * for distributed tracing and error tracking. Correlation IDs help track a
 * single user request across multiple services, database calls, and logs.
 *
 * Usage:
 * - Correlation IDs are automatically generated for each request in entry.server.tsx
 * - Use getCorrelationId() anywhere in your server code to retrieve the current ID
 * - All error logs automatically include the correlation ID
 */

import { AsyncLocalStorage } from "async_hooks"

// AsyncLocalStorage provides a way to store data that persists across
// asynchronous operations within the same request context
const correlationIdStorage = new AsyncLocalStorage<string>()

/**
 * Generate a unique correlation ID
 * Format: timestamp_randomString (e.g., "1730390400000_k3j5h7n2m")
 */
export const generateCorrelationId = (): string => {
  const randomPart = Math.random().toString(36).slice(2, 11)
  return `${Date.now()}_${randomPart}`
}

/**
 * Set the correlation ID for the current async context
 * This should be called at the start of request handling
 * Note: For proper async context isolation, prefer using withCorrelationId() or runWithCorrelationId()
 */
export const setCorrelationId = (id: string): void => {
  correlationIdStorage.enterWith(id)
}

/**
 * Get the correlation ID for the current async context
 * Returns undefined if no correlation ID has been set
 */
export const getCorrelationId = (): string | undefined =>
  correlationIdStorage.getStore()

/**
 * Run a function with a specific correlation ID
 * This creates a proper async context that will be maintained across all async operations
 *
 * Usage:
 * ```typescript
 * await runWithCorrelationId(correlationId, async () => {
 *   // Your code here
 *   // getCorrelationId() will return the provided ID
 * })
 * ```
 */
export const runWithCorrelationId = <T>(
  correlationId: string,
  fn: () => T | Promise<T>
): Promise<T> =>
  correlationIdStorage.run(correlationId, async () => fn())

/**
 * Wrapper function to execute a handler with a correlation ID
 * This automatically generates and sets a correlation ID for the handler
 *
 * Usage:
 * ```typescript
 * const wrappedHandler = withCorrelationId(async (request) => {
 *   // Your handler code here
 *   // getCorrelationId() will return the auto-generated ID
 * })
 * ```
 */
export const withCorrelationId = <T extends (...args: any[]) => Promise<any>>(
  handler: T
): T =>
  (async (...args: any[]) => {
    return correlationIdStorage.run(generateCorrelationId(), () => handler(...args))
  }) as T
