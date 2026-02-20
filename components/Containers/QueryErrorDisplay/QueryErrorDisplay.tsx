import type { QueryObserverResult } from "@tanstack/react-query"
import { type FC, type ReactNode } from "react"

import ErrorDisplay from "~/components/Containers/ErrorDisplay"
import { useQueryError, type UseQueryErrorOptions } from "~/hooks/useQueryError"

export interface QueryErrorDisplayProps<TData, TError>
  extends UseQueryErrorOptions {

  /**
   * Query result from useQuery, useMutation, etc.
   */
  queryResult: Pick<
    QueryObserverResult<TData, TError>,
    "error" | "isError" | "refetch" | "isFetching"
  >

  /**
   * Variant of error display
   */
  variant?: "inline" | "card" | "banner"

  /**
   * Custom className
   */
  className?: string

  /**
   * Children to render when there's no error
   */
  children?: ReactNode

  /**
   * Whether to show error only (hide children when error exists)
   */
  showErrorOnly?: boolean
}

/**
 * QueryErrorDisplay - Consistent error UI for TanStack Query errors
 * 
 * Wraps useQueryError hook and ErrorDisplay component to provide a
 * consistent error display pattern across the application.
 * 
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = useQuery(...)
 * 
 * return (
 *   <QueryErrorDisplay queryResult={{ data, isLoading, error, refetch }}>
 *     <MyContent data={data} />
 *   </QueryErrorDisplay>
 * )
 * ```
 */
function QueryErrorDisplay<TData, TError>({
  queryResult,
  title,
  showDetails = false,
  variant = "card",
  className = "",
  children,
  showErrorOnly = false,
  onError,
}: QueryErrorDisplayProps<TData, TError>) {
  const { hasError, errorDisplayProps } = useQueryError(queryResult, {
    title,
    showDetails,
    onError,
  })

  if (hasError && errorDisplayProps.error) {
    return (
      <div className={className}>
        <ErrorDisplay
          {...errorDisplayProps}
          variant={variant}
        />
      </div>
    )
  }

  if (showErrorOnly && hasError) {
    return null
  }

  return <>{children}</>
}

export default QueryErrorDisplay as FC<QueryErrorDisplayProps<any, any>>

