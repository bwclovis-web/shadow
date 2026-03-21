import { describe, expect, it } from "vitest"

import {
  buildPerfumeCatalogNameOrderBy,
  buildPerfumeCursorOrderBy,
  clampPerfumeListTake,
  isPerfumeListSortBy,
  PERFUME_LIST_DEFAULT_TAKE,
  PERFUME_LIST_MAX_TAKE,
} from "./perfume-cursor-order.server"

describe("clampPerfumeListTake", () => {
  it("uses default when undefined", () => {
    expect(clampPerfumeListTake(undefined)).toBe(PERFUME_LIST_DEFAULT_TAKE)
  })

  it("clamps to max take", () => {
    expect(clampPerfumeListTake(9999)).toBe(PERFUME_LIST_MAX_TAKE)
  })

  it("floors valid positive integers", () => {
    expect(clampPerfumeListTake(12.7)).toBe(12)
  })

  it("falls back for non-finite or below 1", () => {
    expect(clampPerfumeListTake(0)).toBe(PERFUME_LIST_DEFAULT_TAKE)
    expect(clampPerfumeListTake(NaN)).toBe(PERFUME_LIST_DEFAULT_TAKE)
  })
})

describe("isPerfumeListSortBy", () => {
  it("accepts allowlisted values", () => {
    expect(isPerfumeListSortBy("name-asc")).toBe(true)
    expect(isPerfumeListSortBy("type-asc")).toBe(true)
  })

  it("rejects unknown values", () => {
    expect(isPerfumeListSortBy("invalid")).toBe(false)
    expect(isPerfumeListSortBy("")).toBe(false)
    expect(isPerfumeListSortBy(null)).toBe(false)
    expect(isPerfumeListSortBy(undefined)).toBe(false)
  })
})

describe("buildPerfumeCursorOrderBy", () => {
  it("ends with id asc tie-breaker", () => {
    const orders = [
      undefined,
      "name-asc",
      "name-desc",
      "created-asc",
      "created-desc",
      "type-asc",
    ] as const
    for (const sortBy of orders) {
      const ob = buildPerfumeCursorOrderBy(sortBy)
      expect(ob[ob.length - 1]).toEqual({ id: "asc" })
    }
  })

  it("maps type-asc to perfumeHouse.type", () => {
    const ob = buildPerfumeCursorOrderBy("type-asc")
    expect(ob[0]).toEqual({ perfumeHouse: { type: "asc" } })
  })
})

describe("buildPerfumeCatalogNameOrderBy", () => {
  it("uses name then id ascending", () => {
    expect(buildPerfumeCatalogNameOrderBy()).toEqual([
      { name: "asc" },
      { id: "asc" },
    ])
  })
})
