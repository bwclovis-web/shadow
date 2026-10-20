import { describe, expect, it } from "vitest"

import {
  getCollectionOwnedDisplay,
  getFragranceListedMl,
} from "@/lib/collection-volume-display"

describe("getCollectionOwnedDisplay", () => {
  it("formats known numeric owned volume", () => {
    expect(getCollectionOwnedDisplay("50")).toEqual({
      kind: "known",
      ml: 50,
      labelMl: "50.0",
    })
    expect(getCollectionOwnedDisplay("12.5 ml")).toEqual({
      kind: "known",
      ml: 12.5,
      labelMl: "12.5",
    })
  })

  it("does not fabricate a number for unknown owned tokens", () => {
    expect(getCollectionOwnedDisplay("full")).toEqual({ kind: "unknown" })
    expect(getCollectionOwnedDisplay("partial")).toEqual({ kind: "unknown" })
    expect(getCollectionOwnedDisplay("about 30")).toEqual({ kind: "unknown" })
  })

  it("treats empty owned as known zero", () => {
    expect(getCollectionOwnedDisplay("")).toEqual({
      kind: "known",
      ml: 0,
      labelMl: "0.0",
    })
    expect(getCollectionOwnedDisplay(null)).toEqual({
      kind: "known",
      ml: 0,
      labelMl: "0.0",
    })
  })
})

describe("getFragranceListedMl", () => {
  it("sums active listed ml across the fragrance pool", () => {
    const rows = [
      { id: "a", perfumeId: "p1", amount: "100", available: "10" },
      { id: "b", perfumeId: "p1", amount: "0", available: "5" },
      { id: "c", perfumeId: "p2", amount: "50", available: "20" },
    ]
    expect(getFragranceListedMl("p1", rows)).toEqual({
      ml: 15,
      labelMl: "15.0",
    })
  })
})
