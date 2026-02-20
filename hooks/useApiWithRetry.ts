/**
 * React hook for API calls with automatic retry on transient failures
 *
 * Combines the error handling capabilities of useApiErrorHandler
 * with the retry mechanism from the retry utility.
 */

import { useCallback, useState } from "react"

import { RetryOptions, retryPresets, withRetry } from "~/utils/retry"

import { useApiErrorHandler } from "./useErrorHandler"

export interface UseApiWithRetryOptions {

  /**
   * User ID for error logging
   */
  userId?: string

  /**
   * Default retry options applied to all API calls
   */
  defaultRetryOptions?: RetryOptions

  /**
   * Called when a retry attempt is made
   */
  onRetry?: (error: unknown, attempt: number, nextDelay: number) => void

  /**
   * Called when all retries are exhausted
   */
  onMaxRetriesReached?: (error: unknown, attempts: number) => void
}

export interface UseApiWithRetryReturn {

  /**
   * Current error state
   */
  error: ReturnType<typeof useApiErrorHandler>["error"]

  /**
   * Whether an error is present
   */
  isError: boolean

  /**
   * Whether an API call is in progress
   */
  isLoading: boolean

  /**
   * Whether a retry is in progress
   */
  isRetrying: boolean

  /**
   * Number of retry attempts made for the current operation
   */
  retryCount: number

  /**
   * Execute an API call with automatic retry
   *
   * @param apiFn - The API function to call
   * @param options - Override retry options for this call
   * @returns Promise resolving to the API response or null on error
   */
  fetchWithRetry: <T>(
    apiFn: () => Promise<T>,
    options?: {
      retryOptions?: RetryOptions
      endpoint?: string
      method?: string
    }
  ) => Promise<T | null>

  /**
   * Execute an API call with retry using a preset configuration
   *
   * @param apiFn - The API function to call
   * @param preset - Preset name ('conservative', 'standard', 'aggressive', 'quick')
   * @param endpoint - API endpoint for error context
   * @param method - HTTP method for error context
   */
  fetchWithPreset: <T>(
    apiFn: () => Promise<T>,
    preset: keyof typeof retryPresets,
    endpoint?: string,
    method?: string
  ) => Promise<T | null>

  /**
   * Clear error state
   */
  clearError: () => void

  /**
   * Reset retry count
   */
  resetRetryCount: () => void
}

/**
 * Hook for API calls with automatic retry on transient failures
 *
 * @param options - Configuration options
 * @returns API utilities with retry capability
 *
 * @example
 * ```typescript
 * const { fetchWithRetry, isLoading, error } = useApiWithRetry({
 *   defaultRetryOptions: retryPresets.standard
 * })
 *
 * const data = await fetchWithRetry(
 *   () => fetch('/api/perfumes').then(r => r.json()),
 *   { endpoint: '/api/perfumes', method: 'GET' }
 * )
 * ```
 */
export const useApiWithRetry = (options: UseApiWithRetryOptions = {}): UseApiWithRetryReturn => {
  const {
    userId,
    defaultRetryOptions = retryPresets.standard,
    onRetry: globalOnRetry,
    onMaxRetriesReached: globalOnMaxRetriesReached,
  } = options

  const { error, isError, handleApiError, clearError } = useApiErrorHandler(userId)
  const [isLoading, setIsLoading] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  const resetRetryCount = useCallback(() => {
    setRetryCount(0)
  }, [])

  const fetchWithRetry = useCallback(
    async <T>(
      apiFn: () => Promise<T>,
      callOptions?: {
        retryOptions?: RetryOptions
        endpoint?: string
        method?: string
      }
    ): Promise<T | null> => {
      try {
        setIsLoading(true)
        setIsRetrying(false)
        setRetryCount(0)
        clearError()

        // Merge retry options
        const retryOptions: RetryOptions = {
          ...defaultRetryOptions,
          ...callOptions?.retryOptions,
          // Wrap the callbacks to update state
          onRetry: (error, attempt, nextDelay) => {
            setIsRetrying(true)
            setRetryCount(attempt)
            callOptions?.retryOptions?.onRetry?.(error, attempt, nextDelay)
            globalOnRetry?.(error, attempt, nextDelay)
          },
          onMaxRetriesReached: (error, attempts) => {
            setIsRetrying(false)
            setRetryCount(attempts)
            callOptions?.retryOptions?.onMaxRetriesReached?.(error, attempts)
            globalOnMaxRetriesReached?.(error, attempts)
          },
        }

        const result = await withRetry(apiFn, retryOptions)

        // Success - reset retry state
        setIsRetrying(false)
        setRetryCount(0)

        return result
      } catch (error) {
        // All retries exhausted or non-retryable error
        setIsRetrying(false)
        handleApiError(error, callOptions?.endpoint, callOptions?.method)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [
      defaultRetryOptions,
      globalOnRetry,
      globalOnMaxRetriesReached,
      handleApiError,
      clearError,
    ]
  )

  const fetchWithPreset = useCallback(
    async <T>(
      apiFn: () => Promise<T>,
      preset: keyof typeof retryPresets,
      endpoint?: string,
      method?: string
    ): Promise<T | null> => fetchWithRetry(apiFn, {
        retryOptions: retryPresets[preset],
        endpoint,
        method,
      }),
    [fetchWithRetry]
  )

  return {
    error,
    isError,
    isLoading,
    isRetrying,
    retryCount,
    fetchWithRetry,
    fetchWithPreset,
    clearError,
    resetRetryCount,
  }
}

export default useApiWithRetry
