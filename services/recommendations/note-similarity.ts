/** Seasons aligned with UserPerfumeSeasonVote columns and quiz values. */
export type SeasonVoteKey = "winter" | "spring" | "summer" | "fall"

/** Exported for ranking tie-breaks (compare cosines before secondary keys). */
export const COSINE_TIE_EPSILON = 1e-9

const COSINE_EPSILON = COSINE_TIE_EPSILON

/**
 * IDF weight: log((N + 1) / (df + 1)) with N = total perfumes in catalog.
 */
export function idfForDf(df: number, totalPerfumeCount: number): number {
  if (totalPerfumeCount < 0 || !Number.isFinite(totalPerfumeCount)) return 0
  const d = Math.max(0, df)
  return Math.log((totalPerfumeCount + 1) / (d + 1))
}

/**
 * Build idf values for each noteId using precomputed document frequencies.
 */
export function buildIdfMap(
  noteIds: Iterable<string>,
  dfByNoteId: ReadonlyMap<string, number>,
  totalPerfumeCount: number
): Map<string, number> {
  const out = new Map<string, number>()
  for (const id of noteIds) {
    const df = dfByNoteId.get(id) ?? 0
    out.set(id, idfForDf(df, totalPerfumeCount))
  }
  return out
}

/**
 * Cosine similarity using IDF as the weight per note dimension (non-intersection dimensions are 0).
 * Returns 0 if either norm is zero.
 */
export function cosineSimilarityFromIdf(
  sourceNoteIds: ReadonlySet<string>,
  candidateNoteIds: ReadonlySet<string>,
  idfByNoteId: ReadonlyMap<string, number>
): number {
  let dot = 0
  let normS = 0
  let normC = 0

  for (const id of sourceNoteIds) {
    const w = idfByNoteId.get(id) ?? 0
    normS += w * w
  }
  for (const id of candidateNoteIds) {
    const w = idfByNoteId.get(id) ?? 0
    normC += w * w
  }
  for (const id of sourceNoteIds) {
    if (!candidateNoteIds.has(id)) continue
    const w = idfByNoteId.get(id) ?? 0
    dot += w * w
  }

  const denom = Math.sqrt(normS) * Math.sqrt(normC)
  if (denom <= COSINE_EPSILON) return 0
  return dot / denom
}

export function parseSeasonHint(hint: string | null | undefined): Set<SeasonVoteKey> {
  const out = new Set<SeasonVoteKey>()
  if (!hint || typeof hint !== "string") return out
  for (const token of hint.split(",")) {
    const s = token.trim().toLowerCase()
    if (
      s === "winter" ||
      s === "spring" ||
      s === "summer" ||
      s === "fall"
    ) {
      out.add(s)
    }
  }
  return out
}

export type PreferredPriceRange = { min: number | null; max: number | null }

/**
 * Parse ScentProfile.preferredPriceRange JSON; returns null if no usable numeric bounds.
 */
export function parsePreferredPriceRange(json: unknown): PreferredPriceRange | null {
  if (json == null || typeof json !== "object" || Array.isArray(json)) return null
  const o = json as Record<string, unknown>
  let min: number | null = null
  let max: number | null = null
  if (o.min != null && typeof o.min === "number" && Number.isFinite(o.min)) min = o.min
  if (o.max != null && typeof o.max === "number" && Number.isFinite(o.max)) max = o.max
  if (min == null && max == null) return null
  return { min, max }
}

export function isPreferredPriceRangeUsable(range: PreferredPriceRange | null): boolean {
  return range != null && (range.min != null || range.max != null)
}
