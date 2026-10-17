import { beforeEach, describe, expect, it, vi } from "vitest"

const { sanityFetchMock, getLocaleMock, sanityEnv } = vi.hoisted(() => ({
  sanityFetchMock: vi.fn(),
  getLocaleMock: vi.fn(),
  sanityEnv: { isSanityConfigured: true },
}))

vi.mock("next-intl/server", () => ({ getLocale: getLocaleMock }))
vi.mock("@/sanity/env", () => ({
  get isSanityConfigured() {
    return sanityEnv.isSanityConfigured
  },
}))
vi.mock("./client", () => ({ sanityFetch: sanityFetchMock }))

import {
  getLatestPublishedArticles,
  getLatestPublishedArticlesOrEmpty,
} from "./articles.server"
import { latestArticlesQuery } from "./queries"

const article = { _id: "a-1", title: "My Adventure", slug: "my-adventure" }

describe("getLatestPublishedArticles", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sanityEnv.isSanityConfigured = true
    getLocaleMock.mockResolvedValue("en")
  })

  it("requests a bounded list for the viewer locale with article cache tags", async () => {
    getLocaleMock.mockResolvedValue("fr")
    sanityFetchMock.mockResolvedValue([article])

    const result = await getLatestPublishedArticles(3)

    expect(result).toEqual([article])
    expect(sanityFetchMock).toHaveBeenCalledTimes(1)
    expect(sanityFetchMock).toHaveBeenCalledWith({
      query: latestArticlesQuery,
      params: { language: "fr", limit: 3 },
      tags: ["articles", "articles:fr"],
    })
  })

  it("falls back to English when the locale has no articles", async () => {
    getLocaleMock.mockResolvedValue("it")
    sanityFetchMock.mockResolvedValueOnce([]).mockResolvedValueOnce([article])

    const result = await getLatestPublishedArticles(3)

    expect(result).toEqual([article])
    expect(sanityFetchMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        params: { language: "en", limit: 3 },
        tags: ["articles", "articles:en"],
      })
    )
  })

  it("does not refetch when English itself is empty", async () => {
    sanityFetchMock.mockResolvedValue([])

    const result = await getLatestPublishedArticles(3)

    expect(result).toEqual([])
    expect(sanityFetchMock).toHaveBeenCalledTimes(1)
  })

  it("returns nothing without Sanity configuration", async () => {
    sanityEnv.isSanityConfigured = false

    const result = await getLatestPublishedArticles(3)

    expect(result).toEqual([])
    expect(sanityFetchMock).not.toHaveBeenCalled()
  })

  it("caps the GROQ slice with the limit parameter", () => {
    expect(latestArticlesQuery).toContain("order(publishedAt desc)[0...$limit]")
  })
})

describe("getLatestPublishedArticlesOrEmpty", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sanityEnv.isSanityConfigured = true
    getLocaleMock.mockResolvedValue("en")
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  it("returns articles when Sanity responds", async () => {
    sanityFetchMock.mockResolvedValue([article])

    await expect(getLatestPublishedArticlesOrEmpty(3)).resolves.toEqual([article])
    expect(console.error).not.toHaveBeenCalled()
  })

  it("returns an empty list and logs when Sanity fails", async () => {
    sanityFetchMock.mockRejectedValue(new Error("Sanity unavailable"))

    await expect(getLatestPublishedArticlesOrEmpty(3)).resolves.toEqual([])
    expect(console.error).toHaveBeenCalledWith(
      "[journal] latest articles failed",
      expect.any(Error)
    )
  })

  it("returns an empty list when locale resolution fails", async () => {
    getLocaleMock.mockRejectedValue(new Error("no request scope"))

    await expect(getLatestPublishedArticlesOrEmpty(3)).resolves.toEqual([])
    expect(sanityFetchMock).not.toHaveBeenCalled()
  })
})
