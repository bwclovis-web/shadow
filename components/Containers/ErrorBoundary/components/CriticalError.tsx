import { type FC } from "react"

import { type AppError } from "~/utils/errorHandling"

interface CriticalErrorProps {
  error: AppError
  errorId: string
  onRetry: () => void
  onReportError: () => void
}

const CriticalError: FC<CriticalErrorProps> = ({
  error,
  errorId,
  onRetry,
  onReportError,
}) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
    <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
      <div className="text-6xl mb-4">🚨</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Critical Error</h1>
      <p className="text-gray-600 mb-4">
        A critical error has occurred. Please refresh the page or contact support.
      </p>
      <div className="space-y-2">
        <button
          onClick={onRetry}
          className="w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
        >
          Refresh Page
        </button>
        <button
          onClick={onReportError}
          className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
        >
          Report Error
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-4">Error ID: {errorId}</p>
    </div>
  </div>
)

export default CriticalError
