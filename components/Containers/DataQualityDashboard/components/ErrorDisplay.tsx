import { type FC } from "react"

interface ErrorDisplayProps {
  message: string
}

const ErrorDisplay: FC<ErrorDisplayProps> = ({ message }) => (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <h3 className="text-lg font-medium text-red-800">Error</h3>
    <p className="text-red-600 mt-2">{message}</p>
  </div>
)

export default ErrorDisplay
