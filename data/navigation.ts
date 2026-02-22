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

export const profileNavigation = [
  { id: "profile", path: "/admin/profile", key: "profile", label: "Profile" },
] as const
