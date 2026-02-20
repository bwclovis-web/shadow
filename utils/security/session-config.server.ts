// Session configuration constants
export const SESSION_CONFIG = {
  // Access token settings
  ACCESS_TOKEN_EXPIRES_IN: "60m", // 60 minutes (configurable)
  REFRESH_TOKEN_EXPIRES_IN: "7d", // 7 days

  // Session management
  MAX_CONCURRENT_SESSIONS: 1, // Only 1 session per user
  INACTIVITY_TIMEOUT: 30 * 60 * 1000, // 30 minutes in milliseconds

  // Security settings
  REFRESH_TOKEN_LENGTH: 64, // 64 character random string
  SESSION_CLEANUP_INTERVAL: 60 * 60 * 1000, // 1 hour cleanup interval
} as const

// Environment-based configuration
export const getSessionConfig = () => {
  const accessTokenExpiry =
    process.env.ACCESS_TOKEN_EXPIRES_IN || SESSION_CONFIG.ACCESS_TOKEN_EXPIRES_IN
  const refreshTokenExpiry =
    process.env.REFRESH_TOKEN_EXPIRES_IN || SESSION_CONFIG.REFRESH_TOKEN_EXPIRES_IN
  const maxSessions = parseInt(process.env.MAX_CONCURRENT_SESSIONS || "1", 10)
  const inactivityTimeout = parseInt(process.env.INACTIVITY_TIMEOUT || "1800000", 10) // 30 minutes default

  return {
    accessTokenExpiresIn: accessTokenExpiry,
    refreshTokenExpiresIn: refreshTokenExpiry,
    maxConcurrentSessions: maxSessions,
    inactivityTimeout,
  }
}
