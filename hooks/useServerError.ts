import { useCallback, useEffect, useState } from "react"

import { useErrorHandler } from "./useErrorHandler"

export interface UseServerErrorOptions {
  onError?: (error: string) => void
  onClear?: () => void
  autoClear?: boolean
  clearDelay?: number
}

export interface UseServerErrorReturn {
  serverError: string | null
  setServerError: (error: string | null) => void
  clearError: () => void
  handleServerError: (error: unknown) => void
  hasError: boolean
}

/**
 * Custom hook for managing server errors in forms and components
 *
 * @param options - Configuration options for error handling
 * @returns Server error state and handlers
 */
export const useServerError = ({
  onError,
  onClear,
  autoClear = false,
  clearDelay = 5000,
}: UseServerErrorOptions = {}): UseServerErrorReturn => {
  const { handleError } = useErrorHandler()
  const [serverError, setServerErrorState] = useState<string | null>(null)

  const setServerError = useCallback(
    (error: string | null) => {
      setServerErrorState(error)
      if (error) {
        onError?.(error)
      }
    },
    [onError]
  )

  const clearError = useCallback(() => {
    setServerErrorState(null)
    onClear?.()
  }, [onClear])

  const handleServerError = useCallback(
    (error: unknown) => {
      let errorMessage = "An unexpected error occurred"

      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === "string") {
        errorMessage = error
      } else if (error && typeof error === "object" && "message" in error) {
        errorMessage = String(error.message)
      }

      setServerError(errorMessage)
      handleError(error, { context: { serverError: true } })
    },
    [setServerError, handleError]
  )

  // Auto-clear error after delay
  useEffect(() => {
    if (autoClear && serverError) {
      const timer = setTimeout(() => {
        clearError()
      }, clearDelay)

      return () => clearTimeout(timer)
    }
  }, [
autoClear, serverError, clearDelay, clearError
])

  return {
    serverError,
    setServerError,
    clearError,
    handleServerError,
    hasError: Boolean(serverError),
  }
}

export default useServerError
