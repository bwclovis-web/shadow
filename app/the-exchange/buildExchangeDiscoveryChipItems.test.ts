import { describe, expect, it, vi } from "vitest"

import { emptyDiscoveryFilters } from "@/utils/discovery-filters"

import { buildExchangeDiscoveryChipItems } from "./buildExchangeDiscoveryChipItems"

const copy = {
  removeFilterAria: (label: string) => `Remove ${label}`,
  unknownNote: "Note",
  priceChipMin: (min: number) => `Min ${min}`,
  priceChipMax: (max: number) => `Max ${max}`,
  priceChipRange: (min: number, max: number) => `${min}-${max}`,
}

describe("buildExchangeDiscoveryChipItems", () => {
  it("builds note, season, house, and price chips", () => {
    const apply = vi.fn()
    const filters = {
      ...emptyDiscoveryFilters(),
      noteIds: ["note1"],
      seasons: ["spring" as const],
      houseId: "house1",
      minPrice: 10,
      maxPrice: 50,
    }

    const chips = buildExchangeDiscoveryChipItems(filters, {
      noteTags: [{ id: "note1", name: "Rose" }],
      houseLabel: "Test House",
      apply,
      seasonLabel: () => "Spring",
      copy,
    })

    expect(chips).toHaveLength(4)
    expect(chips.map(c => c.label)).toEqual([
      "Rose",
      "Spring",
      "Test House",
      "10-50",
    ])

    chips[0].onRemove()
    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({ noteIds: [], seasons: ["spring"] })
    )
  })
})
