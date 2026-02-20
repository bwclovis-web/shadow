import { type FC } from "react"
import { Link } from "react-router"

import {
  AppError,
  getErrorCode,
  getErrorMessage,
  getErrorType,
} from "~/utils/errorHandling"
import { type ErrorMessage, getUserErrorMessage } from "~/utils/errorMessages"

interface ErrorDisplayProps {
  error: unknown
  title?: string
  showDetails?: boolean
  onRetry?: () => void
  onDismiss?: () => void
  className?: string
  variant?: "inline" | "card" | "banner"
}

const ErrorDisplay: FC<ErrorDisplayProps> = ({
  error,
  title,
  showDetails = false,
  onRetry,
  onDismiss,
  className = "",
  variant = "card",
}) => {
  const message = getErrorMessage(error)
  const code = getErrorCode(error)
  const type = getErrorType(error)
  const isAppError = error instanceof AppError

  // Get user-friendly error message with recovery suggestions
  let errorMessage: ErrorMessage | null = null
  if (isAppError) {
    errorMessage = getUserErrorMessage(error)
  }

  const getVariantStyles = () => {
    switch (variant) {
      case "inline":
        return "text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2"
      case "banner":
        return "bg-red-50 border-l-4 border-red-400 p-4"
      case "card":
      default:
        return "bg-white border border-red-200 rounded-lg shadow-sm p-4"
    }
  }

  const getIcon = () => {
    switch (type) {
      case "AUTHENTICATION":
        return "🔐"
      case "AUTHORIZATION":
        return "🚫"
      case "VALIDATION":
        return "⚠️"
      case "NOT_FOUND":
        return "🔍"
      case "NETWORK":
        return "🌐"
      case "DATABASE":
        return "🗄️"
      case "SERVER":
        return "⚙️"
      case "CLIENT":
        return "💻"
      default:
        return "❌"
    }
  }

  const getTitle = () => {
    if (title) {
      return title
    }

    // Use user-friendly error message title if available
    if (errorMessage) {
      return errorMessage.title
    }

    switch (type) {
      case "AUTHENTICATION":
        return "Authentication Error"
      case "AUTHORIZATION":
        return "Access Denied"
      case "VALIDATION":
        return "Validation Error"
      case "NOT_FOUND":
        return "Not Found"
      case "NETWORK":
        return "Network Error"
      case "DATABASE":
        return "Database Error"
      case "SERVER":
        return "Server Error"
      case "CLIENT":
        return "Client Error"
      default:
        return "Error"
    }
  }

  const getUserFriendlyMessage = () => {
    if (errorMessage) {
      return errorMessage.message
    }
    return message
  }

  const getSuggestion = () => {
    if (errorMessage) {
      return errorMessage.suggestion
    }
    return null
  }

  const getRecoveryAction = () => {
    if (errorMessage?.action && errorMessage.action !== "retry") {
      return errorMessage.action
    }
    return null
  }

  const getActionText = () => {
    if (errorMessage?.actionText) {
      return errorMessage.actionText
    }
    return "Go Back"
  }

  if (variant === "inline") {
    return (
      <div
        className={`${getVariantStyles()} ${className}`}
        role="alert"
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="flex items-center">
          <span className="mr-2" aria-label={`${type} error icon`} role="img">
            {getIcon()}
          </span>
          <span>{message}</span>
        </span>
      </div>
    )
  }

  return (
    <div
      className={`${getVariantStyles()} ${className}`}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      aria-labelledby="error-title"
      aria-describedby="error-message"
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <span className="text-2xl" aria-label={`${type} error icon`} role="img">
            {getIcon()}
          </span>
        </div>
        <div className="ml-3 flex-1">
          <h3 id="error-title" className="text-sm font-medium text-red-800">
            {getTitle()}
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <p id="error-message">{getUserFriendlyMessage()}</p>
          </div>

          {/* Show recovery suggestion if available */}
          {getSuggestion() && (
            <div
              className="mt-2 text-xs text-red-600"
              aria-label="Recovery suggestion"
            >
              <p className="italic">{getSuggestion()}</p>
            </div>
          )}

          {showDetails && isAppError && (
            <details
              className="mt-3 text-xs text-red-600"
              aria-label="Technical error details"
            >
              <summary className="cursor-pointer font-semibold hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 rounded">
                Technical Details
              </summary>
              <div className="mt-2 pl-4 border-l-2 border-red-300">
                <p>
                  <strong>Error Code:</strong> {code}
                </p>
                <p>
                  <strong>Type:</strong> {type}
                </p>
                <p>
                  <strong>Severity:</strong> {error.severity}
                </p>
                {error.context && Object.keys(error.context).length > 0 && (
                  <pre className="mt-2 overflow-auto text-xs">
                    <strong>Context:</strong>{" "}
                    {JSON.stringify(error.context, null, 2)}
                  </pre>
                )}
              </div>
            </details>
          )}

          {(onRetry || onDismiss || getRecoveryAction()) && (
            <div
              className="mt-4 flex flex-wrap gap-2"
              role="group"
              aria-label="Error recovery actions"
            >
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="text-sm bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
                  aria-label="Retry the failed operation"
                  type="button"
                >
                  Try Again
                </button>
              )}
              {getRecoveryAction() && (
                <Link
                  to={getRecoveryAction()!}
                  className="text-sm bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors inline-block"
                  aria-label={`Navigate to ${getActionText()}`}
                >
                  {getActionText()}
                </Link>
              )}
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                  aria-label="Dismiss this error message"
                  type="button"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ErrorDisplay
