import { getProfilePathForUser } from "@/utils/user"

export const mainNavigation = [
  { id: "houses", path: "/houses", key: "houses", label: "Behind the Bottle" },
  { id: "perfumes", path: "/the-vault", key: "perfumes", label: "The Vault" },
  { id: "about", path: "/the-exchange", key: "theExchange", label: "The Exchange" },
] as const

export const adminNavigation = [
  { id: "1", label: "create house", key: "createHouse",   path: "/admin/create-house" } as const,
  { id: "2", label: "create perfume", key: "createPerfume", path: "/admin/create-perfume" },
  { id: "3", label: "data quality", key: "dataQuality", path: "/admin/data-quality" },
  { id: "4", label: "user management", key: "userManagement", path: "/admin/users" },
  { id: "5", label: "security monitor", key: "securityMonitor", path: "/admin/security-monitor" },
  { id: "6", label: "performance admin", key: "performanceAdmin", path: "/admin/performance-admin" },
  { id: "7", label: "pending submissions", key: "pendingSubmissions", path: "/admin/pending-submission" },
] as const


export const profileNavigation = [
  { id: "1", label: "My Wishlist", key: "wishlist", path: "/profile/wishlist" } as const,
  { id: "2", label: "My Scents", key: "myScents", path: "/profile/my-scents" } as const,
  { id: "3", label: "Change Password", key: "changePassword", path: "/profile/change-password" } as const,
] as const

/** Profile nav item with dynamic path for the given user. Use when rendering profile links. */
export const getProfileNavigation = (user: { id: string; username?: string | null }) => {
  const basePath = getProfilePathForUser(user)
  return profileNavigation.map((item) => ({
    ...item,
    path: basePath + item.path.replace(/^\/profile/, "") || basePath,
  }))
}
