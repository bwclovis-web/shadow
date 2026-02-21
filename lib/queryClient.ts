import {
  QueryCache,
  QueryClient,
  MutationCache,
} from '@tanstack/react-query'

/**
 * Retry function signature for TanStack Query
 */
type RetryFunction = (failureCount: number, error: unknown) => boolean

/**
 * Query types for different retry strategies
 */
export type QueryType =
  | 'critical'     // Critical data (user profile, auth) - aggressive retry
  | 'important'    // Important data (houses, perfumes) - standard retry
  | 'optional'     // Optional data (stats, analytics) - minimal retry
  | 'real-time'    // Real-time data - no retry, refetch instead
  | 'background'   // Background data - low priority retry

/** Don't retry on 4xx client errors (validation, auth, etc.) */
const shouldSkip4xx = (error: unknown): boolean => (
  !!error &&
  typeof error === 'object' &&
  'status' in error &&
  typeof (error as { status: unknown }).status === 'number' &&
  (error as { status: number }).status >= 400 &&
  (error as { status: number }).status < 500
)

/** Create retry function with max attempts and 4xx skip */
const createRetry = (maxAttempts: number): RetryFunction =>
  (failureCount: number, error: unknown) => {
    if (shouldSkip4xx(error)) return false
    return failureCount < maxAttempts
  }

/**
 * Retry configuration for different query types
 */
export const retryConfigs: Record<QueryType, RetryFunction | boolean> = {
  critical: createRetry(5),
  important: createRetry(3),
  optional: createRetry(1),
  'real-time': false,
  background: createRetry(1),
}

/**
 * Get retry configuration for a query type
 */
export const getRetryConfig = (queryType: QueryType = 'important'): RetryFunction | boolean =>
  retryConfigs[queryType]

/**
 * Creates and configures a QueryClient instance with default options
 * for TanStack Query v5.
 * 
 * Default Configuration:
 * - staleTime: 5 minutes (aligns with current cache duration)
 * - gcTime: 10 minutes (formerly cacheTime in v4)
 * - retry: 3 attempts (configurable per query type)
 * - refetchOnWindowFocus: false (set per-query for better control)
 * - refetchOnReconnect: true (refetch when network reconnects)
 * 
 * Background Refetching:
 * - Default: No automatic refetchInterval (set per-query as needed)
 * - Use refetchInterval for real-time data (alerts, notifications, live stats)
 * - Use refetchOnWindowFocus strategically (only when data should refresh on tab focus)
 * - Implement stale-while-revalidate pattern for better UX
 * 
 * Error Handling:
 * - Query cache listener for error monitoring with metadata access
 * - Per-query-type retry strategies
 * 
 * @see app/lib/utils/backgroundRefetch.ts for refetch strategies
 * @see app/lib/utils/staleWhileRevalidate.ts for SWR pattern
 */
const STALE_TIME = 5 * 60 * 1000   // 5 minutes
const GC_TIME = 10 * 60 * 1000     // 10 minutes (garbage collection)
const IS_DEV = process.env.NODE_ENV === 'development'

const createQueryClient = (): QueryClient => {
  const queryCache = new QueryCache(
    IS_DEV
      ? {
          onError: (error, query) => {
            console.error('Query error:', {
              queryKey: query.queryKey,
              error,
              queryHash: query.queryHash,
            })
          },
        }
      : undefined
  )

  const mutationCache = new MutationCache(
    IS_DEV
      ? {
          onError: (error, _variables, _onMutateResult, mutation) => {
            console.error('Mutation error:', {
              mutationKey: mutation.options.mutationKey,
              error,
            })
          },
        }
      : undefined
  )

  return new QueryClient({
    queryCache,
    mutationCache,
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME,
        gcTime: GC_TIME,
        retry: retryConfigs.important,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: (failureCount: number, error: unknown) => {
          if (shouldSkip4xx(error)) return false
          return failureCount < 2
        },
      },
    },
  })
}

// Export singleton instance instance
export const queryClient = createQueryClient()

