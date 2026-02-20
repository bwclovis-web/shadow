import { type FC } from "react"

import { type AppError } from "~/utils/errorHandling"

interface ComponentErrorProps {
  error: AppError
  errorId: string
  onRetry: () => void
  onReportError: () => void
}

const ComponentError: FC<ComponentErrorProps> = ({
  error,
  errorId,
  onRetry,
  onReportError,
}) => (
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
            onClick={onRetry}
            className="text-sm bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200 transition-colors"
          >
            Retry
          </button>
          <button
            onClick={onReportError}
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

export default ComponentError
