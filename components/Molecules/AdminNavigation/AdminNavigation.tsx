"use client"

import { type VariantProps } from "class-variance-authority"
import { type HTMLProps } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"

import { adminNavigation, getProfileNavigation } from "@/data/navigation"
import { styleMerge } from "@/utils/styleUtils"

import { adminNavigationVariants } from "./adminNavigation-variants"

interface AdminNavigationProps
  extends HTMLProps<HTMLUListElement>,
    VariantProps<typeof adminNavigationVariants> {
  user?: {
    id?: string
    username?: string | null
    role?: string
  }
  onNavClick?: () => void
}

const linkBase =
  "text-noir-gold py-2 px-2 hover:text-noir-gold-500 transition-colors duration-200 hover:bg-noir-dark/80 block w-full"
const linkActive =
  "text-noir-dark text-shadow-none bg-noir-gold/80 border-2 border-noir-gold"

const AdminNavigation = ({ className, user, onNavClick }: AdminNavigationProps) => {
  const tAdmin = useTranslations("admin")
  const tProfile = useTranslations("profile")
  const pathname = usePathname()
  const isAdmin = user?.role === "admin" || user?.role === "editor"

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + "/")

  return (
    <nav className="z-20 w-full text-noir-light pt-4">
      <ul
        className={styleMerge(adminNavigationVariants({ className }))}
        data-cy="AdminNavigation"
      >
        {/* Admin-only navigation - only show for admins/editors */}
        {isAdmin &&
          adminNavigation.map((item: (typeof adminNavigation)[number]) => (
            <li
              key={item.id}
              className="capitalize font-semibold text-shadow-sm text-shadow-noir-dark/70 leading-5"
            >
              <Link
                href={item.path}
                onClick={onNavClick}
                className={styleMerge(linkBase, isActive(item.path) && linkActive)}
              >
                <span className="pl-2" suppressHydrationWarning>
                  {tAdmin("navigation." + item.key)}
                </span>
              </Link>
            </li>
          ))}
        {/* Profile navigation - show for all authenticated users */}
        {user?.id &&
          getProfileNavigation({
            id: user.id,
            username: user.username ?? null,
          }).map(item => (
            <li
              key={item.id}
              className="capitalize font-semibold text-shadow-sm text-shadow-noir-dark/70 leading-5"
            >
              <Link
                href={item.path}
                onClick={onNavClick}
                className={styleMerge(
                  "text-noir-gold py-2 hover:text-noir-gold-500 transition-colors duration-200 hover:bg-noir-dark/80 block w-full",
                  isActive(item.path) && linkActive
                )}
              >
                <span className="pl-2" suppressHydrationWarning>
                  {tProfile("navigation." + item.key)}
                </span>
              </Link>
            </li>
          ))}
      </ul>
    </nav>
  )
}
export default AdminNavigation
