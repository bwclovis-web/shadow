/**
 * Descriptions that are scrape/import junk (e.g. release year stored as
 * "2012.0") rather than usable copy for meta / JSON-LD.
 */
const YEAR_ONLY_DESCRIPTION = /^\d{4}(?:\.0+)?$/
const PURE_NUMERIC_DESCRIPTION = /^\d+(?:\.\d+)?$/

export const isUsableSeoDescription = (
  text: string | null | undefined
): text is string => {
  if (!text?.trim()) return false
  const cleaned = text.replace(/\s+/g, " ").trim()
  if (YEAR_ONLY_DESCRIPTION.test(cleaned)) return false
  if (PURE_NUMERIC_DESCRIPTION.test(cleaned) && cleaned.length < 20) return false
  return true
}

export const truncateDescription = (
  text: string | null | undefined,
  maxLength = 160
): string | undefined => {
  if (!isUsableSeoDescription(text)) return undefined
  const cleaned = text.replace(/\s+/g, " ").trim()
  if (cleaned.length <= maxLength) return cleaned
  return `${cleaned.slice(0, maxLength - 1)}…`
}
