import React, { Component, type ErrorInfo, type ReactNode } from "react"

import {
  AppError,
  type ErrorBoundaryProps,
  type ErrorBoundaryState,
  ErrorHandler,
} from "~/utils/errorHandling"




export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  private retryCount = 0

  private maxRetries = 3

  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    const appError = ErrorHandler.handle(error, { component: "ErrorBoundary" })
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    return {
      hasError: true,
      error: appError,
      errorId,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const appError = ErrorHandler.handle(error, {
      component: "ErrorBoundary",
      errorInfo: {
        componentStack: errorInfo.componentStack,
      },
    })

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(appError, errorInfo)
    }

    // Update state with the handled error
    this.setState({
      error: appError,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    })
  }

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++
      this.setState({ hasError: false, error: undefined, errorId: undefined })
    } else {
      // Reset retry count and reload the page
      this.retryCount = 0
      window.location.reload()
    }
  }

  private handleReportError = () => {
    if (this.state.error && this.state.errorId) {
      // In a real app, you would send this to your error reporting service
      console.error("Error reported:", {
        errorId: this.state.errorId,
        error: this.state.error.toJSON(),
      })

      // Show user feedback
      alert("Error has been reported. Thank you for your feedback!")
    }
  }

  render() {
    if (this.state.hasError && this.state.error && this.state.errorId) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.state.errorId)
      }

      // Default fallback UI based on level
      return this.renderDefaultFallback(this.state.error, this.state.errorId)
    }

    return this.props.children
  }

  private renderDefaultFallback(error: AppError, errorId: string) {
    const { level = "component" } = this.props

    if (level === "critical") {
      return this.renderCriticalError(error, errorId)
    }

    if (level === "page") {
      return this.renderPageError(error, errorId)
    }

    return this.renderComponentError(error, errorId)
  }

  private renderCriticalError(error: AppError, errorId: string) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="text-6xl mb-4">🚨</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Critical Error</h1>
          <p className="text-gray-600 mb-4">
            A critical error has occurred. Please refresh the page or contact
            support.
          </p>
          <div className="space-y-2">
            <button
              onClick={this.handleRetry}
              className="w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
            >
              Refresh Page
            </button>
            <button
              onClick={this.handleReportError}
              className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
            >
              Report Error
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-4">Error ID: {errorId}</p>
        </div>
      </div>
    )
  }

  private renderPageError(error: AppError, errorId: string) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-lg w-full bg-white rounded-lg shadow-lg p-6">
          <div className="text-center mb-6">
            <div className="text-4xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Something went wrong
            </h1>
            <p className="text-gray-600">{error.userMessage}</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={this.handleRetry}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => window.history.back()}
              className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
            >
              Go Back
            </button>
            <button
              onClick={this.handleReportError}
              className="w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors"
            >
              Report Issue
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-4 text-center">
            Error ID: {errorId}
          </p>
        </div>
      </div>
    )
  }

  private renderComponentError(error: AppError, errorId: string) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <div className="w-5 h-5 text-red-400">⚠️</div>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-red-800">Component Error</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error.userMessage}</p>
            </div>
            <div className="mt-3 flex space-x-2">
              <button
                onClick={this.handleRetry}
                className="text-sm bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200 transition-colors"
              >
                Retry
              </button>
              <button
                onClick={this.handleReportError}
                className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200 transition-colors"
              >
                Report
              </button>
            </div>
            <p className="text-xs text-red-500 mt-2">Error ID: {errorId}</p>
          </div>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
