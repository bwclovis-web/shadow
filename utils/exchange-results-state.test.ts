import { describe, expect, it } from "vitest"

import {
  exchangeCommittedFilterKey,
  parseExchangePreviewState,
  resolveExchangeResultsMode,
} from "@/utils/exchange-results-state"

describe("resolveExchangeResultsMode", () => {
  it("never reports zero-matches on failure", () => {
    expect(
      resolveExchangeResultsMode({
        loadFailed: true,
        isStale: false,
        pageItemCount: 0,
        totalCount: 0,
        hasActiveCriteria: true,
      })
    ).toBe("failure")
  })

  it("prefers stale over empty while a navigation is in flight", () => {
    expect(
      resolveExchangeResultsMode({
        loadFailed: false,
        isStale: true,
        pageItemCount: 0,
        totalCount: 0,
        hasActiveCriteria: true,
      })
    ).toBe("stale")
  })

  it("distinguishes zero-matches from no-inventory", () => {
    expect(
      resolveExchangeResultsMode({
        loadFailed: false,
        isStale: false,
        pageItemCount: 0,
        totalCount: 0,
        hasActiveCriteria: true,
      })
    ).toBe("zero-matches")

    expect(
      resolveExchangeResultsMode({
        loadFailed: false,
        isStale: false,
        pageItemCount: 0,
        totalCount: 0,
        hasActiveCriteria: false,
      })
    ).toBe("no-inventory")
  })

  it("honors controlled preview fixtures over live counts", () => {
    expect(
      resolveExchangeResultsMode({
        loadFailed: false,
        isStale: false,
        pageItemCount: 12,
        totalCount: 12,
        hasActiveCriteria: false,
        previewState: "no-inventory",
      })
    ).toBe("no-inventory")
  })
})

describe("parseExchangePreviewState", () => {
  it("accepts known fixtures only", () => {
    expect(parseExchangePreviewState("failure")).toBe("failure")
    expect(parseExchangePreviewState("bogus")).toBeNull()
  })
})

describe("exchangeCommittedFilterKey", () => {
  it("drops pg, view, and previewState", () => {
    const params = new URLSearchParams(
      "q=rose&pg=2&view=list&previewState=failure&tradePref=cash"
    )
    expect(exchangeCommittedFilterKey(params)).toBe("q=rose&tradePref=cash")
  })
})
