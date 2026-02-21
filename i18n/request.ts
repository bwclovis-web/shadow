import { getRequestConfig } from "next-intl/server"
import { cookies } from "next/headers"

const locales = ["en", "es", "fr", "it"] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = "en"

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const locale =
    (cookieStore.get("locale")?.value as Locale) ??
    cookieStore.get("i18next")?.value ??
    cookieStore.get("i18nextLng")?.value ??
    defaultLocale

  const normalizedLocale = locale?.split("-")[0] ?? defaultLocale
  const validLocale = locales.includes(normalizedLocale as Locale)
    ? (normalizedLocale as Locale)
    : defaultLocale

  return {
    locale: validLocale,
    messages: (await import(`../messages/${validLocale}.json`)).default,
  }
})
