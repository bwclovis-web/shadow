import { COMPARE_MAX_ITEMS } from "@/constants/compare"

/** Trim, drop empties, dedupe preserving first occurrence. */
export function normalizeCompareIds(ids: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of ids) {
    const id = typeof raw === "string" ? raw.trim() : ""
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export function compareIdsExceedMax(ids: string[]): boolean {
  return ids.length > COMPARE_MAX_ITEMS
}
