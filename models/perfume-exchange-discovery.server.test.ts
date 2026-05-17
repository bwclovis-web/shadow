import { describe, expect, it } from "vitest"

import { buildExchangeDiscoveryWhereFragments } from "@/models/perfume.server"
import { emptyDiscoveryFilters } from "@/utils/discovery-filters"

describe("buildExchangeDiscoveryWhereFragments", () => {
  it("returns only search OR when discovery empty", () => {
    const parts = buildExchangeDiscoveryWhereFragments(
      emptyDiscoveryFilters(),
      "rose"
    )
    expect(parts).toHaveLength(1)
    expect(parts[0]).toMatchObject({
      OR: expect.arrayContaining([
        { name: { contains: "rose", mode: "insensitive" } },
        { perfumeHouse: { name: { contains: "rose", mode: "insensitive" } } },
      ]),
    })
  })

  it("returns empty when no search and no discovery constraints", () => {
    expect(buildExchangeDiscoveryWhereFragments(emptyDiscoveryFilters(), "")).toEqual(
      []
    )
    expect(buildExchangeDiscoveryWhereFragments(undefined, "")).toEqual([])
  })

  it("adds note, season, and house fragments", () => {
    const discovery = {
      ...emptyDiscoveryFilters(),
      noteIds: ["note1note1note1note1note1"],
      seasons: ["spring", "winter"] as const,
      houseId: "house1house1house1house1h",
    }
    const parts = buildExchangeDiscoveryWhereFragments(discovery, undefined)
    expect(parts).toEqual(
      expect.arrayContaining([
        {
          perfumeNoteRelations: { some: { noteId: { in: discovery.noteIds } } },
        },
        {
          OR: [
            { userPerfumeSeasonVote: { some: { spring: true } } },
            { userPerfumeSeasonVote: { some: { winter: true } } },
          ],
        },
        { perfumeHouseId: discovery.houseId },
      ])
    )
    expect(parts).toHaveLength(3)
  })

  it("adds perfume id fragment when set", () => {
    const perfumeId = "clxxxxxxxxxxxxxxxxxxxxxx99"
    const parts = buildExchangeDiscoveryWhereFragments(
      { ...emptyDiscoveryFilters(), perfumeId },
      undefined
    )
    expect(parts).toContainEqual({ id: perfumeId })
  })
})
