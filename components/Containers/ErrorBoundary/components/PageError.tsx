import { type FC } from "react"

import { type AppError } from "~/utils/errorHandling"

interface PageErrorProps {
  error: AppError
  errorId: string
  onRetry: () => void
  onReportError: () => void
}

const PageError: FC<PageErrorProps> = ({
  error,
  errorId,
  onRetry,
  onReportError,
}) => (
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
          onClick={onRetry}
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
          onClick={onReportError}
          className="w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors"
        >
          Report Issue
        </button>
      </div>

      <p className="text-xs text-gray-500 mt-4 text-center">Error ID: {errorId}</p>
    </div>
  </div>
)

export default PageError
