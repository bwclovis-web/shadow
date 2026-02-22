type UserLike = {
  firstName?: string | null
  lastName?: string | null
  username?: string | null
  email?: string | null
  id?: string
}

export const getTraderDisplayName = (trader: {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
}): string => {
  const { firstName, lastName, email } = trader
  const full = [firstName, lastName].filter(Boolean).join(" ").trim()
  return full || email || "Trader"
}

export const getUserDisplayName = (user: UserLike | null | undefined): string => {
  if (!user) return "Unknown"
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim()
  return full || user.username || user.email || user.id || "Unknown"
}
