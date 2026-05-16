import type { UserRole } from "@prisma/client"

import type { UserWithCounts } from "@/models/admin.server"

export type RoleFilter = "all" | UserRole
export type StrikeFilter = "all" | "none" | "1" | "2" | "banned"

export const getUserDisplayName = (user: UserWithCounts): string => {
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim()
  return full || user.username || user.email
}

export const filterUsers = (
  users: UserWithCounts[],
  searchQuery: string,
  roleFilter: RoleFilter,
  strikeFilter: StrikeFilter
): UserWithCounts[] => {
  const q = searchQuery.trim().toLowerCase()

  return users.filter((user) => {
    if (roleFilter !== "all" && user.role !== roleFilter) return false

    if (strikeFilter === "none" && user.strikeCount !== 0) return false
    if (strikeFilter === "1" && user.strikeCount !== 1) return false
    if (strikeFilter === "2" && user.strikeCount !== 2) return false
    if (strikeFilter === "banned" && !user.isBanned) return false

    if (!q) return true

    const displayName = getUserDisplayName(user).toLowerCase()
    const email = user.email.toLowerCase()
    const username = (user.username ?? "").toLowerCase()

    return (
      displayName.includes(q) ||
      email.includes(q) ||
      username.includes(q)
    )
  })
}
