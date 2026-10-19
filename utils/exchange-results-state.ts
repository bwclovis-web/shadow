/**
 * Presentation mode for Exchange browse results (Step 7).
 * Priority: failure → stale → empty variants → populated results.
 */

export type ExchangeResultsMode =
  | "failure"
  | "stale"
  | "zero-matches"
  | "no-inventory"
  | "results"

/** Dev/preview-only URL override values (`previewState`). */
export const EXCHANGE_PREVIEW_STATES = [
  "zero-matches",
  "no-inventory",
  "failure",
] as const

export type ExchangePreviewState = (typeof EXCHANGE_PREVIEW_STATES)[number]

export const parseExchangePreviewState = (
  raw: string | string[] | undefined | null
): ExchangePreviewState | null => {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return null
  return (EXCHANGE_PREVIEW_STATES as readonly string[]).includes(value)
    ? (value as ExchangePreviewState)
    : null
}

export type ResolveExchangeResultsModeInput = {
  loadFailed: boolean
  isStale: boolean
  /** Items on the current committed page. */
  pageItemCount: number
  totalCount: number
  /** Search and/or discovery filters active on the committed query. */
  hasActiveCriteria: boolean
  /** Optional controlled fixture (never from production data edits). */
  previewState?: ExchangePreviewState | null
}

export const resolveExchangeResultsMode = ({
  loadFailed,
  isStale,
  pageItemCount,
  totalCount,
  hasActiveCriteria,
  previewState = null,
}: ResolveExchangeResultsModeInput): ExchangeResultsMode => {
  if (previewState === "failure") return "failure"
  if (previewState === "zero-matches") return "zero-matches"
  if (previewState === "no-inventory") return "no-inventory"

  if (loadFailed) return "failure"
  if (isStale) return "stale"

  const empty =
    pageItemCount === 0 && (totalCount === 0 || !Number.isFinite(totalCount))
  if (empty) {
    return hasActiveCriteria ? "zero-matches" : "no-inventory"
  }

  return "results"
}

/** Serialize discovery/search URL keys without pagination/view/preview. */
export const exchangeCommittedFilterKey = (search: URLSearchParams): string => {
  const next = new URLSearchParams(search)
  next.delete("pg")
  next.delete("view")
  next.delete("previewState")
  return next.toString()
}
