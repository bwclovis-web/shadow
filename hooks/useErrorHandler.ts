import { useCallback, useState } from "react"

import {
  AppError,
  createError,
  ErrorHandler,
  type ErrorSeverity,
  type ErrorType,
} from "~/utils/errorHandling"

interface UseErrorHandlerReturn {
  error: AppError | null
  isError: boolean
  handleError: (error: unknown, context?: Record<string, any>) => AppError
  clearError: () => void
  createAndHandleError: (
    message: string,
    type?: ErrorType,
    severity?: ErrorSeverity,
    context?: Record<string, any>
  ) => AppError
}

/**
 * Custom hook for handling errors in React components
 *
 * @param userId - Optional user ID for error logging
 * @returns Error handling utilities
 */
export const useErrorHandler = (userId?: string): UseErrorHandlerReturn => {
  const [error, setError] = useState<AppError | null>(null)

  const handleError = useCallback(
    (error: unknown, context?: Record<string, any>): AppError => {
      const appError = ErrorHandler.handle(error, context, userId)
      setError(appError)
      return appError
    },
    [userId]
  )

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const createAndHandleError = useCallback(
    (
      message: string,
      type: ErrorType = "UNKNOWN" as ErrorType,
      severity: ErrorSeverity = "MEDIUM" as ErrorSeverity,
      context?: Record<string, any>
    ): AppError => {
      const appError = new AppError(
        message,
        type,
        severity,
        undefined,
        undefined,
        context
      )
      ErrorHandler.handle(appError, context, userId)
      setError(appError)
      return appError
    },
    [userId]
  )

  return {
    error,
    isError: error !== null,
    handleError,
    clearError,
    createAndHandleError,
  }
}

/**
 * Hook for handling async operations with error handling
 *
 * @param userId - Optional user ID for error logging
 * @returns Async operation handler with error management
 */
export const useAsyncErrorHandler = (userId?: string) => {
  const { error, isError, handleError, clearError } = useErrorHandler(userId)
  const [isLoading, setIsLoading] = useState(false)

  const execute = useCallback(
    async <T>(
      asyncFn: () => Promise<T>,
      context?: Record<string, any>
    ): Promise<T | null> => {
      try {
        setIsLoading(true)
        clearError()
        const result = await asyncFn()
        return result
      } catch (error) {
        handleError(error, context)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [handleError, clearError]
  )

  return {
    error,
    isError,
    isLoading,
    execute,
    clearError,
  }
}

/**
 * Hook for handling form errors
 *
 * @returns Form error handling utilities
 */
export const useFormErrorHandler = () => {
  const { error, isError, handleError, clearError } = useErrorHandler()

  const handleFormError = useCallback(
    (error: unknown, field?: string) => {
      const context = field ? { field, form: true } : { form: true }
      return handleError(error, context)
    },
    [handleError]
  )

  const createValidationError = useCallback((message: string, field?: string) => {
    const context = field ? { field, form: true } : { form: true }
    return createError.validation(message, context)
  }, [])

  return {
    error,
    isError,
    handleFormError,
    createValidationError,
    clearError,
  }
}

/**
 * Hook for handling API errors
 *
 * @param userId - Optional user ID for error logging
 * @returns API error handling utilities
 */
export const useApiErrorHandler = (userId?: string) => {
  const { error, isError, handleError, clearError } = useErrorHandler(userId)

  const handleApiError = useCallback(
    (error: unknown, endpoint?: string, method?: string) => {
      const context = {
        api: true,
        endpoint,
        method,
        timestamp: new Date().toISOString(),
      }
      return handleError(error, context)
    },
    [handleError]
  )

  const createApiError = useCallback(
    (message: string, endpoint?: string, method?: string, statusCode?: number) => {
      const context = {
        api: true,
        endpoint,
        method,
        statusCode,
        timestamp: new Date().toISOString(),
      }

      let errorType: ErrorType = "UNKNOWN" as ErrorType
      if (statusCode) {
        if (statusCode >= 400 && statusCode < 500) {
          errorType = "CLIENT" as ErrorType
        } else if (statusCode >= 500) {
          errorType = "SERVER" as ErrorType
        }
      }

      return createError[errorType.toLowerCase() as keyof typeof createError](
        message,
        context
      )
    },
    []
  )

  return {
    error,
    isError,
    handleApiError,
    createApiError,
    clearError,
  }
}
