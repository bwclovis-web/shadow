export const mainNavigation = [
  { id: "home", path: "/", key: "home", label: "Home" },
  { id: "houses", path: "/houses", key: "houses", label: "Behind the Bottle" },
  { id: "perfumes", path: "/the-vault", key: "perfumes", label: "The Vault" },
  { id: "about", path: "/about", key: "about", label: "About" },
] as const

export const adminNavigation = [
  { id: "admin-dashboard", path: "/admin", key: "dashboard", label: "Dashboard" },
  { id: "admin-houses", path: "/admin/houses", key: "houses", label: "Houses" },
  { id: "admin-perfumes", path: "/admin/perfumes", key: "perfumes", label: "Perfumes" },
] as const

export const profileNavigation = [
  { id: "profile", path: "/admin/profile", key: "profile", label: "Profile" },
] as const
