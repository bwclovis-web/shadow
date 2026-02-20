import { useTranslation } from "react-i18next"
import { LuBadge, LuBadgeAlert, LuBadgeCheck } from "react-icons/lu"

import { usePasswordStrength } from "~/hooks"

interface PasswordStrengthIndicatorProps {
  password: string
  className?: string
  minLength?: number
  requireUppercase?: boolean
  requireLowercase?: boolean
  requireNumbers?: boolean
  requireSpecialChars?: boolean
  minScore?: number
}

export default function PasswordStrengthIndicator({
  password,
  className = "",
  minLength = 8,
  requireUppercase = true,
  requireLowercase = true,
  requireNumbers = true,
  requireSpecialChars = true,
  minScore = 3,
}: PasswordStrengthIndicatorProps) {
  const { t } = useTranslation()
  const { strengthInfo, isValid, getStrengthColor, getStrengthText } =
    usePasswordStrength(password, {
      minLength,
      requireUppercase,
      requireLowercase,
      requireNumbers,
      requireSpecialChars,
      minScore,
    })

  if (!password || !strengthInfo) {
    return null
  }

  const getStrengthIcon = (strength: string) => {
    switch (strength) {
      case "weak":
        return <LuBadgeAlert size={25} fill="red" strokeWidth={1.5} stroke="white" />
      case "fair":
        return <LuBadge size={25} fill="orange" strokeWidth={1.5} stroke="white" />
      case "good":
        return <LuBadge size={25} fill="yellow" strokeWidth={1.5} stroke="white" />
      case "strong":
        return (
          <LuBadgeCheck size={25} fill="blue" strokeWidth={1.5} stroke="white" />
        )
      case "very_strong":
        return (
          <LuBadgeCheck size={25} fill="green" strokeWidth={1.5} stroke="white" />
        )
      default:
        return (
          <LuBadgeAlert size={25} fill="white" strokeWidth={1.5} stroke="white" />
        )
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Strength Bar */}
      <div className="flex items-center space-x-2">
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getStrengthColor(strengthInfo.strength)}`}
            style={{
              width: `${Math.min(100, (strengthInfo.score / 8) * 100)}%`,
            }}
          />
        </div>
        <span className="text-sm font-medium text-noir-white flex items-center space-x-1">
          <span>{getStrengthIcon(strengthInfo.strength)}</span>
          <span>{getStrengthText(strengthInfo.strength)}</span>
        </span>
      </div>

      {/* Feedback Messages */}
      {strengthInfo.feedback.length > 0 && (
        <div className="text-xs text-noir-gold-100 space-y-1">
          {strengthInfo.feedback.map((message, index) => (
            <div key={index} className="flex items-center space-x-1">
              <span className="text-red-500">•</span>
              <span>{message} </span>
            </div>
          ))}
        </div>
      )}

      {/* Security Recommendations */}
      {strengthInfo.strength === "very_strong" && (
        <div className="text-xs text-green-600 flex items-center space-x-1">
          <span>✅</span>
          <span>{t("password.excellentPasswordStrength", "Excellent password strength!")}</span>
        </div>
      )}

      {/* Validation Status */}
      {isValid && (
        <div className="text-xs text-green-600 flex items-center space-x-1">
          <span>✅</span>
          <span>{t("password.passwordMeetsAllRequirements", "Password meets all requirements")}</span>
        </div>
      )}
    </div>
  )
}
