import { useCallback, useEffect, useMemo, useState } from "react"

export interface PasswordStrengthInfo {
  score: number
  strength: "weak" | "fair" | "good" | "strong" | "very_strong"
  feedback: string[]
  isValid: boolean
  color: string
}

export interface UsePasswordStrengthOptions {
  minLength?: number
  requireUppercase?: boolean
  requireLowercase?: boolean
  requireNumbers?: boolean
  requireSpecialChars?: boolean
  minScore?: number
}

const DEFAULT_OPTIONS: Required<UsePasswordStrengthOptions> = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  minScore: 3,
}

/**
 * Custom hook for calculating password strength
 *
 * @param password - The password to analyze
 * @param options - Configuration options for password requirements
 * @returns Password strength information and utilities
 */
export const usePasswordStrength = (
  password: string,
  options: UsePasswordStrengthOptions = {}
) => {
  // Destructure options to use individual values as dependencies instead of the object
  const {
    minLength = DEFAULT_OPTIONS.minLength,
    requireUppercase = DEFAULT_OPTIONS.requireUppercase,
    requireLowercase = DEFAULT_OPTIONS.requireLowercase,
    requireNumbers = DEFAULT_OPTIONS.requireNumbers,
    requireSpecialChars = DEFAULT_OPTIONS.requireSpecialChars,
    minScore = DEFAULT_OPTIONS.minScore,
  } = options

  const config = useMemo(
    () => ({
      minLength,
      requireUppercase,
      requireLowercase,
      requireNumbers,
      requireSpecialChars,
      minScore,
    }),
    [
      minLength,
      requireUppercase,
      requireLowercase,
      requireNumbers,
      requireSpecialChars,
      minScore,
    ]
  )
  const [strengthInfo, setStrengthInfo] = useState<PasswordStrengthInfo | null>(null)

  const calculateStrength = useCallback(
    (pwd: string): PasswordStrengthInfo => {
      const feedback: string[] = []
      let score = 0

      // Length scoring
      if (pwd.length >= config.minLength) {
        score += 1
      } else {
        feedback.push(`Use at least ${config.minLength} characters`)
      }

      if (pwd.length >= 12) {
        score += 1
      }
      if (pwd.length >= 16) {
        score += 1
      }

      // Character variety scoring
      if (config.requireLowercase) {
        if (/[a-z]/.test(pwd)) {
          score += 1
        } else {
          feedback.push("Add lowercase letters")
        }
      }

      if (config.requireUppercase) {
        if (/[A-Z]/.test(pwd)) {
          score += 1
        } else {
          feedback.push("Add uppercase letters")
        }
      }

      if (config.requireNumbers) {
        if (/[0-9]/.test(pwd)) {
          score += 1
        } else {
          feedback.push("Add numbers")
        }
      }

      if (config.requireSpecialChars) {
        if (/[^a-zA-Z0-9]/.test(pwd)) {
          score += 1
        } else {
          feedback.push("Add special characters")
        }
      }

      // Pattern penalties
      if (/(.)\1{2,}/.test(pwd)) {
        score -= 1
        feedback.push("Avoid repeated characters")
      }

      if (/123|abc|qwe|asd|zxc/i.test(pwd)) {
        score -= 1
        feedback.push("Avoid common patterns")
      }

      // Common password check (simplified)
      const commonPasswords = [
"password", "123456", "qwerty", "admin", "letmein"
]
      if (commonPasswords.some(common => pwd.toLowerCase().includes(common))) {
        score -= 2
        feedback.push("Avoid common passwords")
      }

      // Ensure score is not negative
      score = Math.max(0, score)

      // Determine strength level
      let strength: PasswordStrengthInfo["strength"]
      let color: string

      if (score <= 1) {
        strength = "weak"
        color = "text-red-600"
      } else if (score <= 2) {
        strength = "fair"
        color = "text-orange-600"
      } else if (score <= 3) {
        strength = "good"
        color = "text-yellow-600"
      } else if (score <= 4) {
        strength = "strong"
        color = "text-blue-600"
      } else {
        strength = "very_strong"
        color = "text-green-600"
      }

      const isValid = score >= config.minScore && pwd.length >= config.minLength

      return {
        score,
        strength,
        feedback,
        isValid,
        color,
      }
    },
    [config]
  )

  useEffect(() => {
    if (!password) {
      setStrengthInfo(null)
      return
    }

    const strength = calculateStrength(password)
    setStrengthInfo(strength)
  }, [password, calculateStrength])

  const getStrengthColor = (strength: PasswordStrengthInfo["strength"]) => {
    const colors = {
      weak: "bg-red-500",
      fair: "bg-orange-500",
      good: "bg-yellow-500",
      strong: "bg-blue-500",
      very_strong: "bg-green-500",
    }
    return colors[strength]
  }

  const getStrengthText = (strength: PasswordStrengthInfo["strength"]) => {
    const texts = {
      weak: "Weak",
      fair: "Fair",
      good: "Good",
      strong: "Strong",
      very_strong: "Very Strong",
    }
    return texts[strength]
  }

  return {
    strengthInfo,
    isValid: strengthInfo?.isValid ?? false,
    getStrengthColor,
    getStrengthText,
    calculateStrength,
  }
}

export default usePasswordStrength
