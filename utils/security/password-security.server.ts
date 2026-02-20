import bcrypt from "bcryptjs"
import crypto from "crypto"

// Password security configuration
export const PASSWORD_CONFIG = {
  // bcrypt salt rounds (higher = more secure but slower)
  SALT_ROUNDS: 12,

  // Password requirements
  MIN_LENGTH: 8,
  MAX_LENGTH: 128,

  // Account lockout settings
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes in milliseconds

  // Password history (prevent reuse of last N passwords)
  PASSWORD_HISTORY_LIMIT: 5,

  // Password expiration (in days, 0 = never expires)
  PASSWORD_EXPIRY_DAYS: 90,
} as const

// Password strength levels
export enum PasswordStrength {
  WEAK = "weak",
  FAIR = "fair",
  GOOD = "good",
  STRONG = "strong",
  VERY_STRONG = "very_strong",
}

// Password strength scoring
export function calculatePasswordStrength(password: string): {
  score: number
  strength: PasswordStrength
  feedback: string[]
} {
  const feedback: string[] = []
  let score = 0

  // Length scoring
  if (password.length >= 8) {
    score += 1
  } else {
    feedback.push("Use at least 8 characters")
  }

  if (password.length >= 12) {
    score += 1
  }
  if (password.length >= 16) {
    score += 1
  }

  // Character variety scoring
  if (/[a-z]/.test(password)) {
    score += 1
  } else {
    feedback.push("Add lowercase letters")
  }

  if (/[A-Z]/.test(password)) {
    score += 1
  } else {
    feedback.push("Add uppercase letters")
  }

  if (/[0-9]/.test(password)) {
    score += 1
  } else {
    feedback.push("Add numbers")
  }

  if (/[^a-zA-Z0-9]/.test(password)) {
    score += 1
  } else {
    feedback.push("Add special characters (!@#$%^&*)")
  }

  // Pattern penalties
  if (/(.)\1{2,}/.test(password)) {
    score -= 1
    feedback.push("Avoid repeated characters")
  }

  if (/123|abc|qwe|asd|zxc/i.test(password)) {
    score -= 1
    feedback.push("Avoid common sequences")
  }

  // Common password check
  const commonPasswords = [
    "password",
    "123456",
    "123456789",
    "qwerty",
    "abc123",
    "password123",
    "admin",
    "letmein",
    "welcome",
    "monkey",
  ]

  if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
    score -= 2
    feedback.push("Avoid common passwords")
  }

  // Determine strength level
  let strength: PasswordStrength
  if (score <= 2) {
    strength = PasswordStrength.WEAK
  } else if (score <= 4) {
    strength = PasswordStrength.FAIR
  } else if (score <= 6) {
    strength = PasswordStrength.GOOD
  } else if (score <= 8) {
    strength = PasswordStrength.STRONG
  } else {
    strength = PasswordStrength.VERY_STRONG
  }

  return { score, strength, feedback }
}

// Enhanced password hashing with additional security
export async function hashPassword(password: string): Promise<string> {
  // Generate a random salt for additional security
  const salt = crypto.randomBytes(16).toString("hex")

  // Hash the password with bcrypt
  const hashedPassword = await bcrypt.hash(password, PASSWORD_CONFIG.SALT_ROUNDS)

  // Combine salt and hash for storage (salt:hash format)
  return `${salt}:${hashedPassword}`
}

// Enhanced password verification
export async function verifyPassword(
  password: string,
  storedPassword: string
): Promise<boolean> {
  try {
    // Check if it's the new format (salt:hash) or old format (just hash)
    if (storedPassword.includes(":")) {
      const [salt, hash] = storedPassword.split(":")
      return await bcrypt.compare(password, hash)
    } else {
      // Legacy format - direct bcrypt comparison
      return await bcrypt.compare(password, storedPassword)
    }
  } catch (error) {
    console.error("Password verification error:", error)
    return false
  }
}

// Check if password meets complexity requirements
export function validatePasswordComplexity(password: string): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (password.length < PASSWORD_CONFIG.MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_CONFIG.MIN_LENGTH} characters long`)
  }

  if (password.length > PASSWORD_CONFIG.MAX_LENGTH) {
    errors.push(`Password must be less than ${PASSWORD_CONFIG.MAX_LENGTH} characters`)
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter")
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter")
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number")
  }

  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push("Password must contain at least one special character")
  }

  if (password.includes(" ")) {
    errors.push("Password cannot contain spaces")
  }

  // Check for common patterns
  if (/(.)\1{2,}/.test(password)) {
    errors.push("Password cannot contain more than 2 consecutive identical characters")
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

// Generate a secure random password
export function generateSecurePassword(length: number = 16): string {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*"
  let password = ""

  // Ensure at least one character from each required category
  password += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)] // uppercase
  password += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)] // lowercase
  password += "0123456789"[Math.floor(Math.random() * 10)] // number
  password += "!@#$%^&*"[Math.floor(Math.random() * 8)] // special char

  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)]
  }

  // Shuffle the password
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("")
}

// Check if password is expired
export function isPasswordExpired(lastPasswordChange: Date): boolean {
  if (PASSWORD_CONFIG.PASSWORD_EXPIRY_DAYS === 0) {
    return false
  }

  const expiryDate = new Date(lastPasswordChange)
  expiryDate.setDate(expiryDate.getDate() + PASSWORD_CONFIG.PASSWORD_EXPIRY_DAYS)

  return new Date() > expiryDate
}

// Calculate days until password expires
export function getDaysUntilPasswordExpiry(lastPasswordChange: Date): number {
  if (PASSWORD_CONFIG.PASSWORD_EXPIRY_DAYS === 0) {
    return Infinity
  }

  const expiryDate = new Date(lastPasswordChange)
  expiryDate.setDate(expiryDate.getDate() + PASSWORD_CONFIG.PASSWORD_EXPIRY_DAYS)

  const now = new Date()
  const diffTime = expiryDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  return Math.max(0, diffDays)
}

// Account lockout management
export interface AccountLockoutInfo {
  isLocked: boolean
  attemptsRemaining: number
  lockoutExpiresAt?: Date
}

export function checkAccountLockout(
  failedAttempts: number,
  lastFailedAttempt?: Date
): AccountLockoutInfo {
  const now = new Date()

  // Reset attempts if lockout period has passed
  if (lastFailedAttempt) {
    const timeSinceLastAttempt = now.getTime() - lastFailedAttempt.getTime()
    if (timeSinceLastAttempt > PASSWORD_CONFIG.LOCKOUT_DURATION) {
      return {
        isLocked: false,
        attemptsRemaining: PASSWORD_CONFIG.MAX_LOGIN_ATTEMPTS,
      }
    }
  }

  const attemptsRemaining = Math.max(
    0,
    PASSWORD_CONFIG.MAX_LOGIN_ATTEMPTS - failedAttempts
  )
  const isLocked = failedAttempts >= PASSWORD_CONFIG.MAX_LOGIN_ATTEMPTS

  return {
    isLocked,
    attemptsRemaining,
    lockoutExpiresAt:
      isLocked && lastFailedAttempt
        ? new Date(lastFailedAttempt.getTime() + PASSWORD_CONFIG.LOCKOUT_DURATION)
        : undefined,
  }
}

// Password history validation (prevent reuse)
export function validatePasswordHistory(
  newPassword: string,
  passwordHistory: string[]
): { isValid: boolean; error?: string } {
  for (const oldPassword of passwordHistory) {
    if (bcrypt.compareSync(newPassword, oldPassword)) {
      return {
        isValid: false,
        error: `Cannot reuse any of your last ${PASSWORD_CONFIG.PASSWORD_HISTORY_LIMIT} passwords`,
      }
    }
  }

  return { isValid: true }
}

// Security recommendations based on password strength
export function getSecurityRecommendations(strength: PasswordStrength): string[] {
  const recommendations: string[] = []

  switch (strength) {
    case PasswordStrength.WEAK:
      recommendations.push(
        "Use a password manager to generate and store secure passwords",
        "Enable two-factor authentication for additional security",
        "Avoid using personal information in passwords"
      )
      break
    case PasswordStrength.FAIR:
      recommendations.push(
        "Consider using a password manager",
        "Enable two-factor authentication",
        "Make passwords longer for better security"
      )
      break
    case PasswordStrength.GOOD:
      recommendations.push(
        "Enable two-factor authentication for maximum security",
        "Consider using a password manager for convenience"
      )
      break
    case PasswordStrength.STRONG:
    case PasswordStrength.VERY_STRONG:
      recommendations.push(
        "Excellent password strength!",
        "Enable two-factor authentication for additional security",
        "Keep your password secure and don't share it"
      )
      break
  }

  return recommendations
}
