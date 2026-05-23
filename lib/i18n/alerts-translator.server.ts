import { getTranslations } from "next-intl/server"

import { defaultLocale, type Locale } from "@/i18n/request"

export const getAlertsTranslator = async (locale: Locale = defaultLocale) =>
  getTranslations({ locale, namespace: "alerts" })
