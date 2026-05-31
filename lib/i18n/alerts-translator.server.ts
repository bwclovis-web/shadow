import { createTranslator } from "next-intl"

import { defaultLocale, type Locale } from "@/i18n/request"

export const getAlertsTranslator = async (locale: Locale = defaultLocale) => {
  const messages = (await import(`../../messages/${locale}.json`)).default
  return createTranslator({ locale, namespace: "alerts", messages })
}
