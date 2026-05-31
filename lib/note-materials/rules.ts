import {
  KNOWN_MATERIALS_SET,
  KNOWN_MATERIALS_SORTED,
  MARKETING_PREFIXES_SORTED,
  MATERIAL_BLOCKLIST,
  ORIGIN_PREFIXES_SORTED,
  PROTECTED_MULTI_WORD_NOTES,
} from "./known-materials"

export const normalizeNoteName = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, " ")

/**
 * Derive a material slug from a note name using deterministic rules.
 * Returns null when ambiguous or protected.
 */
export const deriveMaterialSlugFromNoteName = (
  rawName: string
): string | null => {
  const normalized = normalizeNoteName(rawName)
  if (!normalized || PROTECTED_MULTI_WORD_NOTES.has(normalized)) {
    return null
  }

  if (KNOWN_MATERIALS_SET.has(normalized)) {
    if (isBlockedMaterial(normalized, normalized)) return null
    return normalized
  }

  let candidate = stripMarketingPrefixes(normalized)
  candidate = stripOriginPrefixes(candidate)
  if (candidate && KNOWN_MATERIALS_SET.has(candidate)) {
    if (isBlockedMaterial(normalized, candidate)) return null
    return candidate
  }

  const tail = matchKnownMaterialTail(normalized)
  if (tail) {
    if (isBlockedMaterial(normalized, tail)) return null
    return tail
  }

  return null
}

const isBlockedMaterial = (fullName: string, materialSlug: string): boolean => {
  for (const [longer, shorter] of MATERIAL_BLOCKLIST) {
    if (materialSlug === shorter && fullName.includes(longer)) {
      return true
    }
    if (materialSlug === shorter && fullName === longer) {
      return false
    }
  }
  return false
}

const stripOriginPrefixes = (name: string): string => {
  let s = name
  for (const prefix of ORIGIN_PREFIXES_SORTED) {
    const re = new RegExp(`^${escapeRegex(prefix)}\\s+`, "i")
    if (re.test(s)) {
      s = s.replace(re, "").trim()
      break
    }
  }
  return s
}

const stripMarketingPrefixes = (name: string): string => {
  let s = name
  for (const prefix of MARKETING_PREFIXES_SORTED) {
    const re = new RegExp(`^${escapeRegex(prefix)}\\s+`, "i")
    if (re.test(s)) {
      s = s.replace(re, "").trim()
    }
  }
  return s
}

const matchKnownMaterialTail = (name: string): string | null => {
  for (const material of KNOWN_MATERIALS_SORTED) {
    if (name === material) return material
    const suffix = ` ${material}`
    if (name.endsWith(suffix) || name === material) {
      const prefix = name.slice(0, -suffix.length).trim()
      if (!prefix || isOriginOrMarketingOnly(prefix)) {
        return material
      }
    }
  }
  return null
}

const isOriginOrMarketingOnly = (prefix: string): boolean => {
  let s = prefix
  s = stripMarketingPrefixes(s)
  s = stripOriginPrefixes(s)
  return s.length === 0
}

const escapeRegex = (s: string): string =>
  s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
