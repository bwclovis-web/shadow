/**
 * Canonical rules for “missing data” on the data quality dashboard.
 * Keep API metrics and UI copy aligned with these helpers.
 */

/** Perfume is counted as missing core info when description is empty or it has no house. */
export const perfumeHasMissingInfo = (p: {
  description?: string | null
  perfumeHouseId?: string | null
}): boolean =>
  !p.description?.trim() || !p.perfumeHouseId

/** Required for a “complete” house profile in data quality reporting (description, website, email). */
export const HOUSE_QUALITY_FIELD_KEYS = ["description", "website", "email"] as const

export type HouseQualityFieldKey = (typeof HOUSE_QUALITY_FIELD_KEYS)[number]

export const getHouseMissingQualityFields = (h: {
  description?: string | null
  website?: string | null
  email?: string | null
}): HouseQualityFieldKey[] => {
  const missing: HouseQualityFieldKey[] = []
  if (!h.description?.trim()) missing.push("description")
  if (!h.website?.trim()) missing.push("website")
  if (!h.email?.trim()) missing.push("email")
  return missing
}

export const houseHasMissingQualityInfo = (h: Parameters<typeof getHouseMissingQualityFields>[0]): boolean =>
  getHouseMissingQualityFields(h).length > 0

/**
 * Normalize names for duplicate detection (case/whitespace insensitive).
 */
export const normalizeDuplicateKey = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, " ")
