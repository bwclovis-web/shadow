"use server"

import { cookies } from "next/headers"

const LOCALE_COOKIE = "locale"
const MAX_AGE = 60 * 60 * 24 * 365 // 1 year

export const setLocale = async (locale: string) => {
  const cookieStore = await cookies()
  cookieStore.set(LOCALE_COOKIE, locale, {
    maxAge: MAX_AGE,
    path: "/",
    sameSite: "lax",
  })
}
