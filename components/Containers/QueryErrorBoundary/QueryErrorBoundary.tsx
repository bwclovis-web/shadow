import { useQueryErrorResetBoundary } from "@tanstack/react-query"
import React, { Component, type ErrorInfo, type FC, type ReactNode } from "react"

import ErrorDisplay from "~/components/Containers/ErrorDisplay"
import {
  AppError,
  ErrorHandler,
  type ErrorSeverity,
  type ErrorType,
} from "~/utils/errorHandling"

interface QueryErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: AppError, errorId: string, reset: () => void) => ReactNode
  onError?: (error: AppError, errorInfo: ErrorInfo) => void
  level?: "page" | "component" | "critical"
  queryKey?: string[] // Optional query key to filter which query errors to catch
}

interface QueryErrorBoundaryState {
  hasError: boolean
  error?: AppError
  errorId?: string
}

/**
 * QueryErrorBoundary - Specialized error boundary for TanStack Query errors
 * 
 * This boundary catches errors from queries and mutations, providing recovery
 * options and consistent error UI. Can be reset using QueryErrorResetBoundary
 * or the reset callback.
 * 
 * @example
 * ```tsx
 * <QueryErrorBoundary level="component">
 *   <MyComponent />
 * </QueryErrorBoundary>
 * ```
 */
export class QueryErrorBoundary extends Component<
  QueryErrorBoundaryProps,
  QueryErrorBoundaryState
> {
  private retryCount = 0

  private maxRetries = 3

  constructor(props: QueryErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): QueryErrorBoundaryState {
    // Determine error type based on error message/content
    let errorType: ErrorType = "NETWORK" as ErrorType
    let severity: ErrorSeverity = "MEDIUM" as ErrorSeverity

    // Check if it's a network-related error
    if (
      error.message.includes("Failed to fetch") ||
      error.message.includes("NetworkError") ||
      error.message.includes("Network request failed")
    ) {
      errorType = "NETWORK" as ErrorType
      severity = "HIGH" as ErrorSeverity
    } else if (error.message.includes("404") || error.message.includes("Not Found")) {
      errorType = "NOT_FOUND" as ErrorType
      severity = "MEDIUM" as ErrorSeverity
    } else if (
      error.message.includes("401") ||
      error.message.includes("Unauthorized")
    ) {
      errorType = "AUTHENTICATION" as ErrorType
      severity = "HIGH" as ErrorSeverity
    } else if (
      error.message.includes("403") ||
      error.message.includes("Forbidden")
    ) {
      errorType = "AUTHORIZATION" as ErrorType
      severity = "HIGH" as ErrorSeverity
    } else if (error.message.includes("500") || error.message.includes("Server")) {
      errorType = "SERVER" as ErrorType
      severity = "CRITICAL" as ErrorSeverity
    }

    const appError = ErrorHandler.handle(error, {
      component: "QueryErrorBoundary",
      errorType,
      severity,
      isQueryError: true,
    })
    const errorId = `query_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    return {
      hasError: true,
      error: appError,
      errorId,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const appError = ErrorHandler.handle(error, {
      component: "QueryErrorBoundary",
      errorInfo,
      isQueryError: true,
    })

    // Log error for monitoring
    console.error("QueryErrorBoundary caught error:", {
      error: appError.toJSON(),
      errorInfo,
      componentStack: errorInfo.componentStack,
    })

    if (this.props.onError) {
      this.props.onError(appError, errorInfo)
    }
  }

  private handleReset = () => {
    this.retryCount = 0
    this.setState({ hasError: false, error: undefined, errorId: undefined })
  }

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++
      this.handleReset()
    } else {
      // Reset retry count and reload the page
      this.retryCount = 0
      window.location.reload()
    }
  }

  render() {
    if (this.state.hasError && this.state.error && this.state.errorId) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(
          this.state.error,
          this.state.errorId,
          this.handleReset
        )
      }

      // Default fallback UI
      return (
        <div className="p-4">
          <ErrorDisplay
            error={this.state.error}
            title="Query Error"
            showDetails={this.props.level === "critical"}
            onRetry={this.handleRetry}
            variant={this.props.level === "component" ? "inline" : "card"}
          />
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Hook-based wrapper for QueryErrorBoundary that uses QueryErrorResetBoundary
 * This is the recommended way to use the boundary in functional components
 * as it integrates with TanStack Query's error reset mechanism
 */
interface QueryErrorResetBoundaryProps {
  children: ReactNode
  fallback?: (error: AppError, errorId: string, reset: () => void) => ReactNode
  onError?: (error: AppError) => void
  level?: "page" | "component" | "critical"
}

export const QueryErrorResetBoundary: FC<QueryErrorResetBoundaryProps> = ({
  children,
  fallback,
  onError,
  level = "component",
}) => {
  const { reset } = useQueryErrorResetBoundary()

  return (
    <QueryErrorBoundary
      fallback={fallback}
      onError={error => {
        onError?.(error)
        // Reset query errors when boundary catches them
        reset()
      }}
      level={level}
    >
      {children}
    </QueryErrorBoundary>
  )
}

export default QueryErrorBoundary

