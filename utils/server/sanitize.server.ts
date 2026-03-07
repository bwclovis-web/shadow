/**
 * Sanitize plain text input: normalize Unicode and strip characters/patterns that could lead to XSS or broken display.
 * Use for form fields like name/description before persisting (e.g. perfume/house create/update).
 */
export function sanitizeText(text: string | null): string {
  if (!text) {
    return ""
  }

  return text
    .trim()
    .replace(/[<>]/g, "") // Remove angle brackets to prevent HTML/script tags
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+=/gi, "") // Remove event handlers (onclick, onerror, etc.)
    .replace(/[\x00-\x1F\x7F]/g, "") // Remove control characters
    .normalize("NFD") // Normalize Unicode
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[\u2013\u2014]/g, "-") // en dash, em dash → hyphen
    .replace(/[\u2018\u2019]/g, "'") // smart single quotes
    .replace(/[\u201C\u201D]/g, '"') // smart double quotes
    .replace(/[\u2026]/g, "...") // ellipsis
}
