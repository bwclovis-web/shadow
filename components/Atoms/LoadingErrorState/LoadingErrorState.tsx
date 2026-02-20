import type { ReactNode } from "react"

import ErrorDisplay from "~/components/Containers/ErrorDisplay"

interface LoadingErrorStateProps {
  isLoading?: boolean
  error?: unknown
  loadingText?: string
  errorTitle?: string
  showErrorDetails?: boolean
  onRetry?: () => void
  onDismiss?: () => void
  className?: string
  children?: ReactNode
}

const LoadingErrorState = ({
  isLoading = false,
  error,
  loadingText = "Loading...",
  errorTitle,
  showErrorDetails = false,
  onRetry,
  onDismiss,
  className = "",
  children,
}: LoadingErrorStateProps) => {
  if (error) {
    return (
      <div className={className}>
        <ErrorDisplay
          error={error}
          title={errorTitle}
          showDetails={showErrorDetails}
          onRetry={onRetry}
          onDismiss={onDismiss}
          variant="card"
        />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-sm text-gray-600">{loadingText}</p>
        </div>
      </div>
    )
  }
  return <>{children}</>
}

export default LoadingErrorState
