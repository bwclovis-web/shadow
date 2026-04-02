import type { FilterChipStripItem } from "@/components/Molecules/FilterChipStrip"
import type { Tag } from "@/lib/queries/tags"
import type { SeasonKey } from "@/types/perfume-season-vote"
import {
  clearDiscoveryHouse,
  clearDiscoveryPrice,
  removeDiscoveryNoteId,
  removeDiscoverySeason,
  type PerfumeDiscoveryFilters,
} from "@/utils/discovery-filters"

export type ExchangeDiscoveryChipCopy = {
  removeFilterAria: (label: string) => string
  unknownNote: string
  priceChipMin: (min: number) => string
  priceChipMax: (max: number) => string
  priceChipRange: (min: number, max: number) => string
}

/**
 * Maps exchange discovery filters to generic strip items (CF-011).
 */
export function buildExchangeDiscoveryChipItems(
  filters: PerfumeDiscoveryFilters,
  options: {
    noteTags: Tag[]
    /** Resolved label for the selected house, or null to omit the house chip. */
    houseLabel: string | null
    apply: (next: PerfumeDiscoveryFilters) => void
    seasonLabel: (key: SeasonKey) => string
    copy: ExchangeDiscoveryChipCopy
  }
): FilterChipStripItem[] {
  const { noteTags, houseLabel, apply, seasonLabel, copy } = options
  const tagById = new Map(noteTags.map(t => [t.id, t.name]))
  const chips: FilterChipStripItem[] = []

  for (const noteId of filters.noteIds) {
    const label = tagById.get(noteId) ?? copy.unknownNote
    chips.push({
      id: `note-${noteId}`,
      label,
      removeAriaLabel: copy.removeFilterAria(label),
      onRemove: () => apply(removeDiscoveryNoteId(filters, noteId)),
    })
  }

  for (const season of filters.seasons) {
    const label = seasonLabel(season)
    chips.push({
      id: `season-${season}`,
      label,
      removeAriaLabel: copy.removeFilterAria(label),
      onRemove: () => apply(removeDiscoverySeason(filters, season)),
    })
  }

  if (filters.houseId && houseLabel) {
    chips.push({
      id: `house-${filters.houseId}`,
      label: houseLabel,
      removeAriaLabel: copy.removeFilterAria(houseLabel),
      onRemove: () => apply(clearDiscoveryHouse(filters)),
    })
  }

  const { minPrice, maxPrice } = filters
  if (minPrice != null || maxPrice != null) {
    let priceLabel: string
    if (minPrice != null && maxPrice != null) {
      priceLabel = copy.priceChipRange(minPrice, maxPrice)
    } else if (minPrice != null) {
      priceLabel = copy.priceChipMin(minPrice)
    } else {
      priceLabel = copy.priceChipMax(maxPrice!)
    }
    chips.push({
      id: "price",
      label: priceLabel,
      removeAriaLabel: copy.removeFilterAria(priceLabel),
      onRemove: () => apply(clearDiscoveryPrice(filters)),
    })
  }

  return chips
}
