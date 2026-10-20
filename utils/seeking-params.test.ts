import { describe, expect, it } from "vitest"

import {
  buildSeekingOwnedHref,
  buildSeekingPublicHref,
  parseSeekingOwnedState,
  parseSeekingPage,
  parseSeekingPublicState,
  seekingDataQueryKeyParts,
  seekingOwnedQueryKey,
  seekingPublicQueryKey,
  withSeekingAvailablePage,
  withSeekingFilterChange,
  withSeekingPublicPage,
  withSeekingSeekingPage,
  withSeekingViewChange,
} from "@/utils/seeking-params"

const base = {
  search: "",
  visibility: "all" as const,
  view: "grid" as const,
  availablePage: 1,
  seekingPage: 1,
}

describe("parseSeekingOwnedState", () => {
  it("applies defaults and validates enums", () => {
    expect(parseSeekingOwnedState({})).toEqual(base)
    expect(
      parseSeekingOwnedState({
        q: "  Rose ",
        vis: "nope",
        view: "table",
        pgAvail: "0",
        pgSeek: "abc",
      })
    ).toEqual({
      search: "Rose",
      visibility: "all",
      view: "grid",
      availablePage: 1,
      seekingPage: 1,
    })
  })

  it("accepts valid visibility, view, and pages", () => {
    expect(
      parseSeekingOwnedState({
        q: "oud",
        vis: "private",
        view: "list",
        pgAvail: "2",
        pgSeek: "3",
      })
    ).toEqual({
      search: "oud",
      visibility: "private",
      view: "list",
      availablePage: 2,
      seekingPage: 3,
    })
  })
})

describe("parseSeekingPage", () => {
  it("treats missing and invalid as 1", () => {
    expect(parseSeekingPage("")).toBe(1)
    expect(parseSeekingPage("1")).toBe(1)
    expect(parseSeekingPage("2")).toBe(2)
    expect(parseSeekingPage("-1")).toBe(1)
  })
})

describe("buildSeekingOwnedHref", () => {
  it("omits defaults from the query string", () => {
    expect(buildSeekingOwnedHref("/u/profile/wishlist", base)).toBe(
      "/u/profile/wishlist"
    )
  })

  it("serializes non-default params", () => {
    expect(
      buildSeekingOwnedHref(
        "/u/profile/wishlist",
        withSeekingViewChange(
          withSeekingFilterChange(base, {
            search: "rose",
            visibility: "public",
          }),
          "list"
        )
      )
    ).toBe("/u/profile/wishlist?q=rose&vis=public&view=list")
  })
})

describe("seeking state patches", () => {
  it("resets both pages when search or visibility changes", () => {
    const deep = {
      ...base,
      availablePage: 4,
      seekingPage: 5,
      search: "x",
      visibility: "public" as const,
    }
    expect(withSeekingFilterChange(deep, { search: "y" })).toEqual({
      ...deep,
      search: "y",
      availablePage: 1,
      seekingPage: 1,
    })
    expect(withSeekingFilterChange(deep, { visibility: "private" })).toEqual({
      ...deep,
      visibility: "private",
      availablePage: 1,
      seekingPage: 1,
    })
  })

  it("preserves pages when only view changes", () => {
    const deep = { ...base, availablePage: 2, seekingPage: 3 }
    expect(withSeekingViewChange(deep, "list")).toEqual({
      ...deep,
      view: "list",
    })
  })

  it("updates a single group page", () => {
    expect(withSeekingAvailablePage(base, 2).availablePage).toBe(2)
    expect(withSeekingSeekingPage(base, 0).seekingPage).toBe(1)
  })
})

describe("seeking query keys", () => {
  it("includes data-affecting params and view", () => {
    const state = {
      search: "oud",
      visibility: "public" as const,
      view: "list" as const,
      availablePage: 2,
      seekingPage: 1,
    }
    expect(seekingDataQueryKeyParts(state)).toEqual(["oud", "public", 2, 1])
    expect(seekingOwnedQueryKey("user-1", state)).toEqual([
      "seeking",
      "owned",
      "user-1",
      "oud",
      "public",
      2,
      1,
      "list",
    ])
  })
})

describe("parseSeekingPublicState", () => {
  it("defaults and validates page", () => {
    expect(parseSeekingPublicState({})).toEqual({ page: 1 })
    expect(parseSeekingPublicState({ pg: "3" })).toEqual({ page: 3 })
    expect(parseSeekingPublicState({ pg: "0" })).toEqual({ page: 1 })
    expect(parseSeekingPublicState({ pg: "nope" })).toEqual({ page: 1 })
  })
})

describe("buildSeekingPublicHref", () => {
  it("omits page 1 and serializes higher pages", () => {
    expect(buildSeekingPublicHref("/wishlist/u1", { page: 1 })).toBe(
      "/wishlist/u1"
    )
    expect(buildSeekingPublicHref("/wishlist/u1", { page: 2 })).toBe(
      "/wishlist/u1?pg=2"
    )
  })

  it("clamps page patches to at least 1", () => {
    expect(withSeekingPublicPage({ page: 3 }, 0)).toEqual({ page: 1 })
    expect(seekingPublicQueryKey("u1", { page: 2 })).toEqual([
      "seeking",
      "public",
      "u1",
      2,
    ])
  })
})
