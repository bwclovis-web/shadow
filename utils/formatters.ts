/**
 * Display formatters
 */

export function formatUserName(user: {
  firstName?: string | null
  lastName?: string | null
  username?: string | null
  email?: string | null
}): string {
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim()
  return full || user.username || user.email || "User"
}
