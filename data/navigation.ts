import { getProfilePathForUser } from "@/utils/user"

export const mainNavigation = [
  { id: "houses", path: "/houses", key: "houses", label: "Behind the Bottle" },
  { id: "perfumes", path: "/the-vault", key: "perfumes", label: "The Vault" },
  { id: "about", path: "/the-exchange", key: "theExchange", label: "The Exchange" },
] as const

export const adminNavigation = [
  { id: "admin-dashboard", path: "/admin", key: "dashboard", label: "Dashboard" },
  { id: "admin-houses", path: "/admin/houses", key: "houses", label: "Houses" },
  { id: "admin-perfumes", path: "/admin/perfumes", key: "perfumes", label: "Perfumes" },
] as const

const profileNavItem = {
  id: "profile" as const,
  key: "profile" as const,
  label: "Profile" as const,
}

/** Profile nav item with dynamic path for the given user. Use when rendering profile links. */
export const getProfileNavigation = (user: { id: string; username?: string | null }) => [
  { ...profileNavItem, path: getProfilePathForUser(user) },
]
