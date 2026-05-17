import countryListJson from "@/data/countryList.json"

export type CountryEntry = {
  id: string
  name: string
  label: string
  code: string
}

export const COUNTRIES: CountryEntry[] = countryListJson as CountryEntry[]

const COUNTRY_BY_ID = new Map(COUNTRIES.map((c) => [c.id, c]))
const COUNTRY_BY_CODE = new Map(COUNTRIES.map((c) => [c.code.toUpperCase(), c]))

/** Legacy trader region codes from the first IMP-052 select. */
const LEGACY_REGION_TO_COUNTRY_ID: Record<string, string> = {
  US: "United States",
  UK: "United Kingdom",
  AU: "Australia",
}

const LEGACY_REGION_LABELS: Record<string, string> = {
  EU: "Europe",
  other: "Other",
}

/**
 * Regional-indicator flag emoji from ISO 3166-1 alpha-2 (e.g. US → 🇺🇸).
 * Returns empty string when the code is not two letters A–Z.
 */
export const isoCodeToFlagEmoji = (code: string | null | undefined): string => {
  const upper = code?.trim().toUpperCase() ?? ""
  const iso = upper === "UK" ? "GB" : upper
  if (!/^[A-Z]{2}$/.test(iso)) return ""
  const base = 0x1f1e6
  return [...iso]
    .map((char) => String.fromCodePoint(base + char.charCodeAt(0) - 65))
    .join("")
}

/**
 * Small PNG flag for reliable display (emoji flags often missing on Windows).
 * flagcdn only serves certain `w{N}` sizes (e.g. w20, w40); w24 and others 404.
 */
export const getCountryFlagImageUrl = (code: string, preferredWidth = 20): string => {
  const iso = code.toLowerCase()
  if (preferredWidth > 20 && preferredWidth <= 28) {
    return `https://flagcdn.com/24x18/${iso}.png`
  }
  const width = preferredWidth <= 20 ? 20 : preferredWidth <= 40 ? 40 : 80
  return `https://flagcdn.com/w${width}/${iso}.png`
}

export const getCountryById = (id: string | null | undefined): CountryEntry | null => {
  if (!id?.trim()) return null
  return COUNTRY_BY_ID.get(id.trim()) ?? null
}

export const getCountryByCode = (code: string | null | undefined): CountryEntry | null => {
  if (!code?.trim()) return null
  return COUNTRY_BY_CODE.get(code.trim().toUpperCase()) ?? null
}

export const searchCountries = (query: string): CountryEntry[] => {
  const q = query.trim().toLowerCase()
  if (!q) {
    return [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name))
  }
  return COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.label.toLowerCase().includes(q)
  ).sort((a, b) => a.name.localeCompare(b.name))
}

export type ResolvedTraderCountry = {
  name: string
  code: string | null
  flag: string
}

/** Resolve stored region (country name, ISO code, or legacy bucket) for display. */
export const resolveTraderCountry = (
  region: string | null | undefined
): ResolvedTraderCountry | null => {
  if (!region?.trim()) return null
  const raw = region.trim()

  const byId = getCountryById(raw)
  if (byId) {
    return { name: byId.name, code: byId.code, flag: isoCodeToFlagEmoji(byId.code) }
  }

  const legacyId = LEGACY_REGION_TO_COUNTRY_ID[raw.toUpperCase()]
  if (legacyId) {
    const country = getCountryById(legacyId)
    if (country) {
      return {
        name: country.name,
        code: country.code,
        flag: isoCodeToFlagEmoji(country.code),
      }
    }
  }

  const byCode = getCountryByCode(raw === "UK" ? "GB" : raw)
  if (byCode) {
    return { name: byCode.name, code: byCode.code, flag: isoCodeToFlagEmoji(byCode.code) }
  }

  const legacyLabel = LEGACY_REGION_LABELS[raw.toLowerCase()] ?? LEGACY_REGION_LABELS[raw]
  if (legacyLabel) {
    const code = raw.toUpperCase() === "EU" ? "EU" : null
    return {
      name: legacyLabel,
      code,
      flag: code ? isoCodeToFlagEmoji(code) : "",
    }
  }

  return { name: raw, code: null, flag: "" }
}

export const isAllowedCountryId = (id: string | null | undefined): boolean =>
  id == null || id === "" || COUNTRY_BY_ID.has(id.trim())
