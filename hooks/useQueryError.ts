import type { QueryObserverResult } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"

import {
  AppError,
  ErrorHandler,
  type ErrorSeverity,
  type ErrorType,
} from "~/utils/errorHandling"

export interface UseQueryErrorOptions {

  /**
   * Custom title for the error display
   */
  title?: string

  /**
   * Whether to show technical error details
   */
  showDetails?: boolean

  /**
   * Custom error handling function
   */
  onError?: (error: AppError) => void

  /**
   * Whether to throw errors (for error boundaries)
   */
  throwOnError?: boolean

  /**
   * Custom error type mapping function
   */
  mapErrorType?: (error: unknown) => ErrorType

  /**
   * Custom severity mapping function
   */
  mapSeverity?: (error: unknown) => ErrorSeverity
}

export interface UseQueryErrorReturn<TData, TError> {

  /**
   * Whether the query has an error
   */
  hasError: boolean

  /**
   * Normalized AppError if error exists, otherwise null
   */
  error: AppError | null

  /**
   * Original error from query result
   */
  originalError: TError | null

  /**
   * Function to manually reset the error state
   */
  resetError: () => void

  /**
   * Props ready to pass to ErrorDisplay component
   */
  errorDisplayProps: {
    error: AppError | null
    title?: string
    showDetails: boolean
    onRetry: (() => void) | undefined
    variant: "inline" | "card" | "banner"
  }
}

/**
 * Hook for consistent error handling in query results
 * 
 * Normalizes query errors to AppError format and provides convenient
 * props for error display components.
 * 
 * @param queryResult - Result from useQuery, useMutation, etc.
 * @param options - Configuration options
 * @returns Error state and utilities
 * 
 * @example
 * ```tsx
 * const { data, isLoading, error } = useQuery(...)
 * const { hasError, errorDisplayProps } = useQueryError(
 *   { data, isLoading, error, refetch },
 *   { title: "Failed to load houses" }
 * )
 * 
 * if (hasError) {
 *   return <ErrorDisplay {...errorDisplayProps} />
 * }
 * ```
 */
export function useQueryError<TData, TError>(
  queryResult: Pick<
    QueryObserverResult<TData, TError>,
    "error" | "isError" | "refetch" | "isFetching"
  >,
  options: UseQueryErrorOptions = {}
): UseQueryErrorReturn<TData, TError> {
  const {
    title,
    showDetails = false,
    onError,
    throwOnError = false,
    mapErrorType,
    mapSeverity,
  } = options

  const { error: originalError, isError, refetch, isFetching } = queryResult

  // Normalize error to AppError
  const error = useMemo(() => {
    if (!isError || !originalError) {
      return null
    }

    // Determine error type
    let errorType: ErrorType = "UNKNOWN" as ErrorType
    if (mapErrorType) {
      errorType = mapErrorType(originalError)
    } else {
      // Auto-detect error type from error message/content
      const errorMessage =
        originalError instanceof Error
          ? originalError.message
          : String(originalError)

      if (
        errorMessage.includes("Failed to fetch") ||
        errorMessage.includes("NetworkError") ||
        errorMessage.includes("Network request failed")
      ) {
        errorType = "NETWORK" as ErrorType
      } else if (
        errorMessage.includes("404") ||
        errorMessage.includes("Not Found")
      ) {
        errorType = "NOT_FOUND" as ErrorType
      } else if (
        errorMessage.includes("401") ||
        errorMessage.includes("Unauthorized")
      ) {
        errorType = "AUTHENTICATION" as ErrorType
      } else if (
        errorMessage.includes("403") ||
        errorMessage.includes("Forbidden")
      ) {
        errorType = "AUTHORIZATION" as ErrorType
      } else if (
        errorMessage.includes("500") ||
        errorMessage.includes("Server")
      ) {
        errorType = "SERVER" as ErrorType
      } else if (errorMessage.includes("400") || errorMessage.includes("Bad Request")) {
        errorType = "VALIDATION" as ErrorType
      }
    }

    // Determine severity
    let severity: ErrorSeverity = "MEDIUM" as ErrorSeverity
    if (mapSeverity) {
      severity = mapSeverity(originalError)
    } else {
      // Auto-detect severity based on error type
      switch (errorType) {
        case "NETWORK":
        case "SERVER":
          severity = "HIGH" as ErrorSeverity
          break
        case "AUTHENTICATION":
        case "AUTHORIZATION":
          severity = "HIGH" as ErrorSeverity
          break
        case "NOT_FOUND":
        case "VALIDATION":
          severity = "MEDIUM" as ErrorSeverity
          break
        default:
          severity = "MEDIUM" as ErrorSeverity
      }
    }

    // Create AppError
    const appError = ErrorHandler.handle(originalError, {
      component: "useQueryError",
      errorType,
      severity,
      isQueryError: true,
      queryContext: {
        isFetching,
        canRefetch: !!refetch,
      },
    })

    // Call custom error handler if provided
    if (onError) {
      onError(appError)
    }

    // Throw error if requested (for error boundaries)
    if (throwOnError) {
      throw appError
    }

    return appError
  }, [
    isError,
    originalError,
    mapErrorType,
    mapSeverity,
    onError,
    throwOnError,
    isFetching,
    refetch,
  ])

  const resetError = useCallback(() => {
    // Reset by refetching
    if (refetch) {
      refetch()
    }
  }, [refetch])

  const errorDisplayProps = useMemo(
    () => ({
      error,
      title,
      showDetails,
      onRetry: refetch ? () => refetch() : undefined,
      variant: "card" as const,
    }),
    [
error, title, showDetails, refetch
]
  )

  return {
    hasError: isError,
    error,
    originalError: originalError ?? null,
    resetError,
    errorDisplayProps,
  }
}

/**
 * Simplified hook for inline error display
 * Returns error message and retry function for inline use
 */
export function useQueryErrorInline<TData, TError>(queryResult: Pick<
    QueryObserverResult<TData, TError>,
    "error" | "isError" | "refetch"
  >) {
  const { hasError, error, errorDisplayProps } = useQueryError(queryResult, {
    variant: "inline",
  })

  return {
    hasError,
    error,
    errorMessage: error?.userMessage ?? error?.message ?? null,
    retry: errorDisplayProps.onRetry,
  }
}

