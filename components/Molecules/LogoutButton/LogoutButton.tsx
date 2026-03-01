"use client"

import type { FormEvent } from "react"
import { useTranslations } from "next-intl"
import { RiLogoutBoxRLine } from "react-icons/ri"

import { Button } from "@/components/Atoms/Button/Button"
//import { clearCacheOnLogout } from "@/utils/cacheManagement"

const getCsrfTokenFromCookie = (): string | null => {
  const cookie = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("_csrf="))
  const token = cookie?.split("=")[1]?.trim()
  return token || null
}

const LogoutButton = () => {
  const t = useTranslations("navigation")

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault()
    // Clear cache before logout redirect
    // clearCacheOnLogout()
    const csrfToken = getCsrfTokenFromCookie()
    const headers: HeadersInit = csrfToken
      ? { "x-csrf-token": csrfToken }
      : {}
    const response = await fetch("/api/log-out", {
      method: "POST",
      credentials: "include",
      headers,
    })
    if (response.redirected) {
      window.location.assign(response.url)
      return
    }
    window.location.assign("/sign-in")
  }

  return (
    <form method="post" action="/api/log-out" onSubmit={handleSubmit}>
      <Button
        variant="icon"
        type="submit"
        aria-label={t("logout")}
        className="bg-noir-light hover:bg-noir-dark hover:text-noir-light rounded-full p-2 transition-colors duration-300 text-noir-black"
      >
        <RiLogoutBoxRLine size={20} />
      </Button>
    </form>
  )
}
export default LogoutButton
