import { FiAlertCircle, FiCheckCircle, FiInfo } from "react-icons/fi"

export interface ValidationMessageProps {
  error?: string
  success?: string
  warning?: string
  info?: string
  className?: string
  showIcon?: boolean
  size?: "sm" | "md" | "lg"
}

const ValidationMessage = ({
  error,
  success,
  warning,
  info,
  className = "",
  showIcon = true,
  size = "md",
}: ValidationMessageProps) => {
  const message = error || success || warning || info
  const type = error ? "error" : success ? "success" : warning ? "warning" : "info"

  if (!message) {
    return null
  }

  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-2",
    lg: "text-base px-4 py-3",
  }

  const iconSizeClasses = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  }

  const typeClasses = {
    error: "bg-red-50 border-red-200 text-red-800",
    success: "bg-green-50 border-green-200 text-green-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    info: "bg-blue-50 border-blue-200 text-blue-800",
  }

  const iconClasses = {
    error: "text-red-500",
    success: "text-green-500",
    warning: "text-yellow-500",
    info: "text-blue-500",
  }

  const IconComponent = {
    error: FiAlertCircle,
    success: FiCheckCircle,
    warning: FiAlertCircle,
    info: FiInfo,
  }[type]

  return (
    <div
      className={`
        flex items-center gap-2 rounded-md border
        ${sizeClasses[size]}
        ${typeClasses[type]}
        ${className}
      `}
      role="alert"
      aria-live="polite"
    >
      {showIcon && (
        <IconComponent
          className={`
            flex-shrink-0
            ${iconSizeClasses[size]}
            ${iconClasses[type]}
          `}
          aria-hidden="true"
        />
      )}
      <span className="flex-1">{message}</span>
    </div>
  )
}

export default ValidationMessage
