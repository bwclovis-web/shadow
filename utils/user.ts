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

export const createSafeUser = (user: UserI | null): SafeUser | null => {
  if (!user) {
    return null
  }

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    role: user.role,
  }
}

/**
 * Extracts the username part from an email address (everything before the @)
 * @param email - The email address to extract username from
 * @returns The username part of the email, or the full email if no @ is found
 */
export const getUsernameFromEmail = (email: string): string => {
  if (!email) {
    return ""
  }

  const atIndex = email.indexOf("@")
  if (atIndex === -1) {
    return email
  }

  return email.substring(0, atIndex)
}

/** URL-safe segment for profile path: slugified username when set, else user id. */
export const getProfileSlug = (user: {
  id: string
  username?: string | null
}): string => {
  if (user.username?.trim()) {
    const slug = user.username
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
    if (slug) return slug
  }
  return user.id
}

/** Profile URL for a user: /{slug}/profile (slug is username-based or id). */
export const getProfilePathForUser = (user: {
  id: string
  username?: string | null
}): string => `/${getProfileSlug(user)}/profile`

