import { describe, expect, it } from "vitest"

import {
  buildArchiveCatalogHref,
  buildHouseCatalogHref,
  CATALOG_MAX_SELECTIONS,
  parseArchiveCatalogState,
  parseCatalogLetter,
  parseCatalogPage,
  parseHouseCatalogState,
} from "./catalog-params"

const HOUSE_A = "clhouseaaaaaaaaaaaaaaaaaa"
const HOUSE_B = "clhousebbbbbbbbbbbbbbbbbb"
const NOTE_A = "clnoteaaaaaaaaaaaaaaaaaaa"

describe("catalog-params", () => {
  describe("parseCatalogLetter", () => {
    it("accepts a single letter and uppercases it", () => {
      expect(parseCatalogLetter("a")).toBe("A")
      expect(parseCatalogLetter("Z")).toBe("Z")
    })

    it("rejects anything else", () => {
      expect(parseCatalogLetter("ab")).toBeNull()
      expect(parseCatalogLetter("1")).toBeNull()
      expect(parseCatalogLetter("")).toBeNull()
      expect(parseCatalogLetter(undefined)).toBeNull()
    })
  })

  describe("parseCatalogPage", () => {
    it("falls back to page 1 for invalid or low values", () => {
      expect(parseCatalogPage("")).toBe(1)
      expect(parseCatalogPage("0")).toBe(1)
      expect(parseCatalogPage("-3")).toBe(1)
      expect(parseCatalogPage("abc")).toBe(1)
    })

    it("parses positive pages", () => {
      expect(parseCatalogPage("4")).toBe(4)
    })
  })

  describe("parseArchiveCatalogState", () => {
    it("returns defaults for empty params", () => {
      expect(parseArchiveCatalogState({}, null)).toEqual({
        letter: null,
        filters: { houseIds: [], noteIds: [], seasons: [] },
        sort: "created-desc",
        view: "grid",
        page: 1,
      })
    })

    it("parses filters, sort, view, and page from URLSearchParams", () => {
      const params = new URLSearchParams({
        house: `${HOUSE_A},${HOUSE_B}`,
        notes: NOTE_A,
        season: "winter,spring",
        sort: "name-asc",
        view: "list",
        pg: "3",
      })
      expect(parseArchiveCatalogState(params, "B")).toEqual({
        letter: "B",
        filters: {
          houseIds: [HOUSE_A, HOUSE_B],
          noteIds: [NOTE_A],
          seasons: ["winter", "spring"],
        },
        sort: "name-asc",
        view: "list",
        page: 3,
      })
    })

    it("drops invalid ids, duplicates, unknown seasons, and unknown sort/view", () => {
      const state = parseArchiveCatalogState(
        {
          house: `${HOUSE_A},not-an-id,${HOUSE_A}`,
          season: "monsoon,summer",
          sort: "type-asc",
          view: "table",
        },
        null
      )
      expect(state.filters.houseIds).toEqual([HOUSE_A])
      expect(state.filters.seasons).toEqual(["summer"])
      expect(state.sort).toBe("created-desc")
      expect(state.view).toBe("grid")
    })

    it("caps the number of accepted ids", () => {
      const ids = Array.from(
        { length: CATALOG_MAX_SELECTIONS + 5 },
        (_, index) => `clhouse${String(index).padStart(18, "0")}`
      )
      const state = parseArchiveCatalogState({ house: ids.join(",") }, null)
      expect(state.filters.houseIds).toHaveLength(CATALOG_MAX_SELECTIONS)
    })

    it("reads the first value of repeated record params", () => {
      const state = parseArchiveCatalogState({ view: ["list", "grid"] }, null)
      expect(state.view).toBe("list")
    })
  })

  describe("parseHouseCatalogState", () => {
    it("parses letter, house types, and the house-only sort", () => {
      expect(
        parseHouseCatalogState({
          letter: "d",
          type: "niche,indie,boutique",
          sort: "type-asc",
        })
      ).toEqual({
        letter: "D",
        houseTypes: ["niche", "indie"],
        sort: "type-asc",
        view: "grid",
        page: 1,
      })
    })
  })

  describe("buildArchiveCatalogHref", () => {
    it("omits defaults", () => {
      expect(
        buildArchiveCatalogHref(parseArchiveCatalogState({}, null))
      ).toBe("/the-archive")
    })

    it("puts the letter in the path and round-trips the state", () => {
      const state = parseArchiveCatalogState(
        {
          house: HOUSE_A,
          notes: NOTE_A,
          season: "fall",
          sort: "name-desc",
          view: "list",
          pg: "2",
        },
        "C"
      )
      const href = buildArchiveCatalogHref(state)
      expect(href.startsWith("/the-archive/c?")).toBe(true)

      const query = new URLSearchParams(href.split("?")[1])
      expect(parseArchiveCatalogState(query, "C")).toEqual(state)
    })

    it("keeps only q and view in search mode", () => {
      const state = parseArchiveCatalogState(
        { house: HOUSE_A, sort: "name-asc", view: "list", pg: "2" },
        "C"
      )
      expect(buildArchiveCatalogHref(state, "rose oud")).toBe(
        "/the-archive?q=rose+oud&view=list"
      )
    })
  })

  describe("buildHouseCatalogHref", () => {
    it("omits defaults", () => {
      expect(buildHouseCatalogHref(parseHouseCatalogState({}))).toBe("/houses")
    })

    it("round-trips the state", () => {
      const state = parseHouseCatalogState({
        letter: "m",
        type: "designer,celebrity",
        sort: "type-asc",
        view: "list",
        pg: "5",
      })
      const href = buildHouseCatalogHref(state)
      const query = new URLSearchParams(href.split("?")[1])
      expect(parseHouseCatalogState(query)).toEqual(state)
    })
  })
})
