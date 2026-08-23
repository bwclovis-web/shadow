/** Locales shared by next-intl UI and Sanity journal articles. */
export const JOURNAL_LOCALES = ["en", "es", "fr", "it"] as const

export type JournalLocale = (typeof JOURNAL_LOCALES)[number]

export const DEFAULT_JOURNAL_LOCALE: JournalLocale = "en"

export const JOURNAL_LOCALE_LABELS: Record<JournalLocale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  it: "Italiano",
}

export const isJournalLocale = (value: string | null | undefined): value is JournalLocale =>
  !!value && (JOURNAL_LOCALES as readonly string[]).includes(value)

export const normalizeJournalLocale = (value: string | null | undefined): JournalLocale => {
  const base = value?.split("-")[0]?.toLowerCase() ?? DEFAULT_JOURNAL_LOCALE
  return isJournalLocale(base) ? base : DEFAULT_JOURNAL_LOCALE
}
