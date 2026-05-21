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

export const formatDateTime = (date: Date | string): string => {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  })
}
