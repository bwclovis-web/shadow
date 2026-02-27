import Link from "next/link"

import {
  type AppError,
  type ErrorType,
  getErrorCode,
  getErrorMessage,
  getErrorType,
  isAppError,
} from "@/utils/errorHandling"
import { styleMerge } from "@/utils/styleUtils"

export interface ErrorDisplayProps {
  error: unknown
  title?: string
  showDetails?: boolean
  onRetry?: () => void
  onDismiss?: () => void
  className?: string
  variant?: "inline" | "card" | "banner"
}

const VARIANT_STYLES: Record<NonNullable<ErrorDisplayProps["variant"]>, string> = {
  inline: "text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2",
  banner: "bg-red-50 border-l-4 border-red-400 p-4",
  card: "bg-white border border-red-200 rounded-lg shadow-sm p-4",
}

const TYPE_ICONS: Record<ErrorType, string> = {
  AUTHENTICATION: "🔐",
  AUTHORIZATION: "🚫",
  VALIDATION: "⚠️",
  NOT_FOUND: "🔍",
  NETWORK: "🌐",
  DATABASE: "🗄️",
  SERVER: "⚙️",
  CLIENT: "💻",
  UNKNOWN: "❌",
}

const TYPE_TITLES: Record<ErrorType, string> = {
  AUTHENTICATION: "Authentication Error",
  AUTHORIZATION: "Access Denied",
  VALIDATION: "Validation Error",
  NOT_FOUND: "Not Found",
  NETWORK: "Network Error",
  DATABASE: "Database Error",
  SERVER: "Server Error",
  CLIENT: "Client Error",
  UNKNOWN: "Error",
}

const getResolvedContent = (error: unknown) => {
  const message = getErrorMessage(error)
  const type = getErrorType(error)
  const title = TYPE_TITLES[type]
  return { message, type, title }
}

export const ErrorDisplay = ({
  error,
  title: titleProp,
  showDetails = false,
  onRetry,
  onDismiss,
  className,
  variant = "card",
}: ErrorDisplayProps) => {
  const { message, type, title: typeTitle } = getResolvedContent(error)
  const code = getErrorCode(error)
  const appError = isAppError(error) ? (error as AppError) : null

  const title = titleProp ?? typeTitle
  const displayMessage = message
  const recoveryHref = appError?.context?.recoveryHref as string | undefined
  const recoveryLabel = (appError?.context?.recoveryLabel as string) ?? "Go Back"
  const suggestion = appError?.context?.suggestion as string | undefined

  const hasActions = Boolean(onRetry ?? onDismiss ?? (recoveryHref && recoveryHref !== "retry"))

  if (variant === "inline") {
    return (
      <div
        className={styleMerge(VARIANT_STYLES.inline, className)}
        role="alert"
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="flex items-center">
          <span className="mr-2" aria-label={`${type} error icon`} role="img">
            {TYPE_ICONS[type]}
          </span>
          <span>{displayMessage}</span>
        </span>
      </div>
    )
  }

  return (
    <div
      className={styleMerge(VARIANT_STYLES[variant], className)}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      aria-labelledby="error-title"
      aria-describedby="error-message"
    >
      <div className="flex items-start">
        <div className="shrink-0">
          <span className="text-2xl" aria-label={`${type} error icon`} role="img">
            {TYPE_ICONS[type]}
          </span>
        </div>
        <div className="ml-3 flex-1">
          <h3 id="error-title" className="text-sm font-medium text-red-800">
            {title}
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <p id="error-message">{displayMessage}</p>
          </div>

          {suggestion && (
            <div className="mt-2 text-xs text-red-600" aria-label="Recovery suggestion">
              <p className="italic">{suggestion}</p>
            </div>
          )}

          {showDetails && appError && (
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
                  <strong>Severity:</strong> {appError.severity}
                </p>
                {appError.context && Object.keys(appError.context).length > 0 && (
                  <pre className="mt-2 overflow-auto text-xs">
                    <strong>Context:</strong>{" "}
                    {JSON.stringify(appError.context, null, 2)}
                  </pre>
                )}
              </div>
            </details>
          )}

          {hasActions && (
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
              {recoveryHref && recoveryHref !== "retry" && (
                <Link
                  href={recoveryHref}
                  className="text-sm bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors inline-block"
                  aria-label={`Navigate to ${recoveryLabel}`}
                >
                  {recoveryLabel}
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
