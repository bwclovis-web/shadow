import DOMPurify from "isomorphic-dompurify"

/**
 * Allowlist for review HTML (safe rich text only).
 * Used for both write-path sanitization and optional render-time sanitization.
 */
export const REVIEW_HTML_ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
] as const

/** Tags that must never appear in review HTML (blocklist overrides allowlist). */
const REVIEW_FORBID_TAGS = ["script", "iframe", "object", "embed", "form", "input", "button"]

const REVIEW_SANITIZE_CONFIG = {
  ALLOWED_TAGS: [...REVIEW_HTML_ALLOWED_TAGS],
  ALLOWED_ATTR: [] as string[],
  FORBID_TAGS: REVIEW_FORBID_TAGS,
}

/**
 * Detect HTML that is explicitly dangerous and should be rejected (not just sanitized).
 * Use this for server-side validation so requests containing scripts/embeds fail fast.
 */
export function containsDangerousReviewHtml(html: string): boolean {
  if (typeof html !== "string") return false
  return (
    /<\s*script\b/i.test(html) ||
    /<\s*\/\s*script\s*>/i.test(html) ||
    /&lt;\s*script\b/i.test(html) ||
    /&lt;\s*\/\s*script\s*&gt;/i.test(html) ||
    /&#0*60;\s*script\b/i.test(html) || // "&#60;script"
    /&#x0*3c;\s*script\b/i.test(html) || // "&#x3c;script"
    /%3c\s*script\b/i.test(html) || // urlencoded "<script"
    /<\s*iframe\b/i.test(html) ||
    /&lt;\s*iframe\b/i.test(html) ||
    /<\s*object\b/i.test(html) ||
    /&lt;\s*object\b/i.test(html) ||
    /<\s*embed\b/i.test(html) ||
    /&lt;\s*embed\b/i.test(html) ||
    /\bjavascript\s*:/i.test(html)
  )
}

/**
 * Final pass: remove any remaining script/dangerous tag content (defense-in-depth).
 * Handles malformed or bypassed markup so we never persist executable content.
 */
function stripDangerousTags(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<\/script\s*>/gi, "")
    .replace(/<script\b[^>]*\/?\s*>/gi, "")
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi, "")
    .replace(/<object\b[^>]*>[\s\S]*?<\/object\s*>/gi, "")
    .replace(/<embed\b[^>]*\/?\s*>/gi, "")
    .replace(/javascript:/gi, "")
}

/**
 * Sanitize HTML intended for review content (create/update and render).
 * Safe to use on server and client (isomorphic-dompurify).
 * Strips script/dangerous tags first (so they are never parsed by DOM), then DOMPurify allowlist.
 */
export function sanitizeReviewHtml(html: string): string {
  if (typeof html !== "string") return ""
  const noScript = stripDangerousTags(html)
  const purified = DOMPurify.sanitize(noScript, REVIEW_SANITIZE_CONFIG)
  const result = typeof purified === "string" ? purified : String(purified)
  return stripDangerousTags(result)
}
