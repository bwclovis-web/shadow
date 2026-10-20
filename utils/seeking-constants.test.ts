import { describe, expect, it } from "vitest"

import {
  clampSeekingPage,
  clampSeekingPageSize,
  normalizeSeekingSearch,
  SEEKING_GROUP_PAGE_SIZE,
  SEEKING_SEARCH_MAX_LENGTH,
} from "@/utils/seeking-constants"

describe("seeking-constants", () => {
  it("clamps page size to 1..SEEKING_GROUP_PAGE_SIZE", () => {
    expect(clampSeekingPageSize(undefined)).toBe(SEEKING_GROUP_PAGE_SIZE)
    expect(clampSeekingPageSize(0)).toBe(1)
    expect(clampSeekingPageSize(3)).toBe(3)
    expect(clampSeekingPageSize(999)).toBe(SEEKING_GROUP_PAGE_SIZE)
  })

  it("clamps page within total pages and computes skip", () => {
    expect(clampSeekingPage(1, 25, 12)).toEqual({
      currentPage: 1,
      totalPages: 3,
      skip: 0,
    })
    expect(clampSeekingPage(3, 25, 12)).toEqual({
      currentPage: 3,
      totalPages: 3,
      skip: 24,
    })
    expect(clampSeekingPage(99, 25, 12)).toEqual({
      currentPage: 3,
      totalPages: 3,
      skip: 24,
    })
    expect(clampSeekingPage(0, 25, 12)).toEqual({
      currentPage: 1,
      totalPages: 3,
      skip: 0,
    })
    expect(clampSeekingPage(2, 0, 12)).toEqual({
      currentPage: 1,
      totalPages: 0,
      skip: 0,
    })
  })

  it("normalizes and bounds search", () => {
    expect(normalizeSeekingSearch("  Rose  ")).toBe("Rose")
    expect(normalizeSeekingSearch(null)).toBe("")
    expect(normalizeSeekingSearch("x".repeat(SEEKING_SEARCH_MAX_LENGTH + 20)))
      .toHaveLength(SEEKING_SEARCH_MAX_LENGTH)
  })
})
