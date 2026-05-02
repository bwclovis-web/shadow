import { describe, expect, it } from "vitest"

import { getPaginationVisiblePages } from "./paginationVisiblePages"

describe("getPaginationVisiblePages", () => {
  it("returns [] when totalPages < 1", () => {
    expect(getPaginationVisiblePages(1, 0)).toEqual([])
  })

  it("returns [1] when totalPages is 1", () => {
    expect(getPaginationVisiblePages(1, 1)).toEqual([1])
    expect(getPaginationVisiblePages(5, 1)).toEqual([1])
  })

  it("returns [1, 2] for two pages", () => {
    expect(getPaginationVisiblePages(1, 2)).toEqual([1, 2])
    expect(getPaginationVisiblePages(2, 2)).toEqual([1, 2])
  })

  it("covers small totals without redundant ellipsis", () => {
    expect(getPaginationVisiblePages(1, 7, 1)).toEqual([
      1,
      2,
      "ellipsis",
      7,
    ])
    expect(getPaginationVisiblePages(4, 7, 1)).toEqual([
      1,
      "ellipsis",
      3,
      4,
      5,
      "ellipsis",
      7,
    ])
  })

  it("clamps current into range for large totals", () => {
    expect(getPaginationVisiblePages(50, 100, 1)).toEqual([
      1,
      "ellipsis",
      49,
      50,
      51,
      "ellipsis",
      100,
    ])
  })

  it("respects siblingCount", () => {
    expect(getPaginationVisiblePages(10, 30, 2)).toEqual([
      1,
      "ellipsis",
      8,
      9,
      10,
      11,
      12,
      "ellipsis",
      30,
    ])
  })

  it("handles start and end windows", () => {
    expect(getPaginationVisiblePages(2, 100, 1)).toEqual([
      1,
      2,
      3,
      "ellipsis",
      100,
    ])
    expect(getPaginationVisiblePages(99, 100, 1)).toEqual([
      1,
      "ellipsis",
      98,
      99,
      100,
    ])
  })
})
