export interface FieldState {
  hasError: boolean
  hasSuccess: boolean
  hasWarning: boolean
  hasInfo: boolean
  disabled: boolean
}

export const getFieldStateClasses = ({
  hasError,
  hasSuccess,
  hasWarning,
  hasInfo,
  disabled,
}: FieldState): string => {
  if (hasError) {
    return `border-red-300 focus:border-red-500 focus:ring-red-500 ${disabled ? "bg-gray-50 cursor-not-allowed" : ""}`
  }

  if (hasSuccess) {
    return `border-green-300 focus:border-green-500 focus:ring-green-500 ${disabled ? "bg-gray-50 cursor-not-allowed" : ""}`
  }

  if (hasWarning) {
    return `border-yellow-300 focus:border-yellow-500 focus:ring-yellow-500 ${disabled ? "bg-gray-50 cursor-not-allowed" : ""}`
  }

  if (hasInfo) {
    return `border-blue-300 focus:border-blue-500 focus:ring-blue-500 ${disabled ? "bg-gray-50 cursor-not-allowed" : ""}`
  }

  return `border-gray-300 focus:border-blue-500 focus:ring-blue-500 ${disabled ? "bg-gray-50 cursor-not-allowed" : ""}`
}

export const getAriaDescribedBy = (
  error?: string,
  helpText?: string,
  success?: string,
  warning?: string,
  info?: string
): string | undefined => {
  const ids = [
    error && "error-message",
    helpText && "help-text",
    success && "success-message",
    warning && "warning-message",
    info && "info-message",
  ]
    .filter(Boolean)
    .join(" ")

  return ids || undefined
}

