"use client"

import type { ReactNode } from "react"
import { useTranslations } from "next-intl"
import { LuBadge, LuBadgeAlert, LuBadgeCheck } from "react-icons/lu"

import { usePasswordStrength } from "@/hooks/usePasswordStrength" 

const ICON_PROPS = { size: 25, strokeWidth: 1.5, stroke: "white" } as const

const STRENGTH_ICONS: Record<string, ReactNode> = {
  weak: <LuBadgeAlert {...ICON_PROPS} fill="red" />,
  fair: <LuBadge {...ICON_PROPS} fill="orange" />,
  good: <LuBadge {...ICON_PROPS} fill="yellow" />,
  strong: <LuBadgeCheck {...ICON_PROPS} fill="blue" />,
  very_strong: <LuBadgeCheck {...ICON_PROPS} fill="green" />,
}

const DEFAULT_STRENGTH_ICON = (
  <LuBadgeAlert {...ICON_PROPS} fill="white" />
)

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

const PasswordStrengthIndicator = ({
  password,
  className = "",
  minLength = 8,
  requireUppercase = true,
  requireLowercase = true,
  requireNumbers = true,
  requireSpecialChars = true,
  minScore = 3,
}: PasswordStrengthIndicatorProps) => {
  const t = useTranslations("password")
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

  const barWidthPercent = Math.min(100, (strengthInfo.score / 8) * 100)

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Strength Bar */}
      <div className="flex items-center space-x-2">
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getStrengthColor(strengthInfo.strength)}`}
            style={{ width: `${barWidthPercent}%` }}
          />
        </div>
        <span className="text-sm font-medium text-noir-white flex items-center space-x-1">
          <span>
            {STRENGTH_ICONS[strengthInfo.strength] ?? DEFAULT_STRENGTH_ICON}
          </span>
          <span>{getStrengthText(strengthInfo.strength)}</span>
        </span>
      </div>

      {/* Feedback Messages */}
      {strengthInfo.feedback.length > 0 && (
        <div className="text-xs text-noir-gold-100 space-y-1">
          {strengthInfo.feedback.map((message: string, index: number) => (
            <div key={`${index}-${message}`} className="flex items-center space-x-1">
              <span className="text-red-500">•</span>
              <span>{message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Security Recommendations */}
      {strengthInfo.strength === "very_strong" && (
        <div className="text-xs text-green-600 flex items-center space-x-1">
          <span>✅</span>
          <span>{t("excellentPasswordStrength")}</span>
        </div>
      )}

      {/* Validation Status */}
      {isValid && (
        <div className="text-xs text-green-600 flex items-center space-x-1">
          <span>✅</span>
          <span>{t("passwordMeetsAllRequirements")}</span>
        </div>
      )}
    </div>
  )
}

export default PasswordStrengthIndicator
