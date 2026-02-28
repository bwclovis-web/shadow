"use client"

import { useEffect, useRef, useState } from "react"

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

const COMMON_PASSWORDS = [
  "password",
  "123456",
  "qwerty",
  "admin",
  "letmein",
]

const STRENGTH_COLORS: Record<PasswordStrengthInfo["strength"], string> = {
  weak: "bg-red-500",
  fair: "bg-orange-500",
  good: "bg-yellow-500",
  strong: "bg-blue-500",
  very_strong: "bg-green-500",
}

const STRENGTH_LABELS: Record<PasswordStrengthInfo["strength"], string> = {
  weak: "Weak",
  fair: "Fair",
  good: "Good",
  strong: "Strong",
  very_strong: "Very Strong",
}

const STRENGTH_SCORE_STYLES: Record<
  PasswordStrengthInfo["strength"],
  { strength: PasswordStrengthInfo["strength"]; color: string }
> = {
  weak: { strength: "weak", color: "text-red-600" },
  fair: { strength: "fair", color: "text-orange-600" },
  good: { strength: "good", color: "text-yellow-600" },
  strong: { strength: "strong", color: "text-blue-600" },
  very_strong: { strength: "very_strong", color: "text-green-600" },
}

type StrengthConfig = Required<UsePasswordStrengthOptions>

const getStrengthFromScore = (score: number): PasswordStrengthInfo["strength"] => {
  if (score <= 1) return "weak"
  if (score <= 2) return "fair"
  if (score <= 3) return "good"
  if (score <= 4) return "strong"
  return "very_strong"
}

const calculatePasswordStrength = (
  pwd: string,
  config: StrengthConfig
): PasswordStrengthInfo => {
  const feedback: string[] = []
  let score = 0

  if (pwd.length >= config.minLength) {
    score += 1
  } else {
    feedback.push(`Use at least ${config.minLength} characters`)
  }

  if (pwd.length >= 12) score += 1
  if (pwd.length >= 16) score += 1

  if (config.requireLowercase) {
    if (/[a-z]/.test(pwd)) score += 1
    else feedback.push("Add lowercase letters")
  }
  if (config.requireUppercase) {
    if (/[A-Z]/.test(pwd)) score += 1
    else feedback.push("Add uppercase letters")
  }
  if (config.requireNumbers) {
    if (/[0-9]/.test(pwd)) score += 1
    else feedback.push("Add numbers")
  }
  if (config.requireSpecialChars) {
    if (/[^a-zA-Z0-9]/.test(pwd)) score += 1
    else feedback.push("Add special characters")
  }

  if (/(.)\1{2,}/.test(pwd)) {
    score -= 1
    feedback.push("Avoid repeated characters")
  }
  if (/123|abc|qwe|asd|zxc/i.test(pwd)) {
    score -= 1
    feedback.push("Avoid common patterns")
  }
  if (COMMON_PASSWORDS.some((common) => pwd.toLowerCase().includes(common))) {
    score -= 2
    feedback.push("Avoid common passwords")
  }

  score = Math.max(0, score)
  const strength = getStrengthFromScore(score)
  const { color } = STRENGTH_SCORE_STYLES[strength]
  const isValid =
    score >= config.minScore && pwd.length >= config.minLength

  return { score, strength, feedback, isValid, color }
}

const DEBOUNCE_MS = 150

/**
 * Custom hook for calculating password strength (debounced for Next.js).
 *
 * @param password - The password to analyze
 * @param options - Configuration options for password requirements
 * @returns Password strength information and utilities
 */
export const usePasswordStrength = (
  password: string,
  options: UsePasswordStrengthOptions = {}
) => {
  const {
    minLength = DEFAULT_OPTIONS.minLength,
    requireUppercase = DEFAULT_OPTIONS.requireUppercase,
    requireLowercase = DEFAULT_OPTIONS.requireLowercase,
    requireNumbers = DEFAULT_OPTIONS.requireNumbers,
    requireSpecialChars = DEFAULT_OPTIONS.requireSpecialChars,
    minScore = DEFAULT_OPTIONS.minScore,
  } = options

  const [strengthInfo, setStrengthInfo] = useState<PasswordStrengthInfo | null>(
    null
  )
  const [debouncedPassword, setDebouncedPassword] = useState(password)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!password) {
      setDebouncedPassword("")
      setStrengthInfo(null)
      return
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setDebouncedPassword(password)
      timeoutRef.current = null
    }, DEBOUNCE_MS)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [password])

  useEffect(() => {
    if (!debouncedPassword) {
      setStrengthInfo(null)
      return
    }

    const config: StrengthConfig = {
      minLength,
      requireUppercase,
      requireLowercase,
      requireNumbers,
      requireSpecialChars,
      minScore,
    }
    setStrengthInfo(calculatePasswordStrength(debouncedPassword, config))
  }, [
    debouncedPassword,
    minLength,
    requireUppercase,
    requireLowercase,
    requireNumbers,
    requireSpecialChars,
    minScore,
  ])

  const getStrengthColor = (strength: PasswordStrengthInfo["strength"]) =>
    STRENGTH_COLORS[strength]
  const getStrengthText = (strength: PasswordStrengthInfo["strength"]) =>
    STRENGTH_LABELS[strength]

  const calculateStrength = (pwd: string) => {
    const config: StrengthConfig = {
      minLength,
      requireUppercase,
      requireLowercase,
      requireNumbers,
      requireSpecialChars,
      minScore,
    }
    return calculatePasswordStrength(pwd, config)
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
