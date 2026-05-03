import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { ScrapedItem } from "@/types/scraper"

const invokeMock = vi.fn()

vi.mock("@langchain/openai", () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    invoke: (...args: unknown[]) => invokeMock(...args),
  })),
}))

import { extractNotesForItems } from "./notes-graph"

/** Structured notes with 3 layers and enough notes to skip merge LLM; keeps Phase 1 free of invoke(). */
const NOTES_TEXT_NO_LLM = `Top: a, b
Heart: c, d
Base: e, f`

describe("notes pipeline (parallel phase 1 + sequential noir)", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "test-key")
    invokeMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("preserves result order and runs noir in index order when concurrency is 3", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "3")

    const items: ScrapedItem[] = [
      {
        name: "Alpha",
        description: "short",
        notesText: NOTES_TEXT_NO_LLM,
        image: "",
        detailURL: "https://example.com/p/alpha",
        perfumeHouse: "House",
      },
      {
        name: "Beta",
        description: "short",
        notesText: NOTES_TEXT_NO_LLM,
        image: "",
        detailURL: "https://example.com/p/beta",
        perfumeHouse: "House",
      },
      {
        name: "Gamma",
        description: "short",
        notesText: NOTES_TEXT_NO_LLM,
        image: "",
        detailURL: "https://example.com/p/gamma",
        perfumeHouse: "House",
      },
    ]

    const noteJson = JSON.stringify({
      openNotes: ["rose"],
      heartNotes: ["jasmine"],
      baseNotes: ["musk"],
    })
    let noirCall = 0
    invokeMock.mockImplementation(async (messages: unknown) => {
      const msgs = messages as { role: string; content: string }[]
      const sys = msgs.find(m => m.role === "system")?.content ?? ""
      if (sys.includes("film noir")) {
        noirCall++
        return { content: `Noir line for product ${noirCall}` }
      }
      return { content: noteJson }
    })

    const records = await extractNotesForItems(items, "House", { generateNoirDescriptions: true })

    expect(records).toHaveLength(3)
    expect(records.map(r => r.name)).toEqual(["Alpha", "Beta", "Gamma"])
    expect(noirCall).toBe(3)
    expect(records[0].description).toContain("product 1")
    expect(records[1].description).toContain("product 2")
    expect(records[2].description).toContain("product 3")
  })

  it("NOTES_PIPELINE_CONCURRENCY=1 processes all products with same noir ordering", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    const items: ScrapedItem[] = [
      {
        name: "One",
        description: "x",
        notesText: NOTES_TEXT_NO_LLM,
        image: "",
        detailURL: "https://example.com/p/1",
        perfumeHouse: "H",
      },
      {
        name: "Two",
        description: "x",
        notesText: NOTES_TEXT_NO_LLM,
        image: "",
        detailURL: "https://example.com/p/2",
        perfumeHouse: "H",
      },
    ]

    const noteJson = JSON.stringify({
      openNotes: ["rose"],
      heartNotes: ["jasmine"],
      baseNotes: ["musk"],
    })
    let noirCall = 0
    invokeMock.mockImplementation(async (messages: unknown) => {
      const msgs = messages as { role: string; content: string }[]
      const sys = msgs.find(m => m.role === "system")?.content ?? ""
      if (sys.includes("film noir")) {
        noirCall++
        return { content: `N${noirCall}` }
      }
      return { content: noteJson }
    })

    const records = await extractNotesForItems(items, "H", { generateNoirDescriptions: true })

    expect(records.map(r => r.name)).toEqual(["One", "Two"])
    expect(noirCall).toBe(2)
    expect(records[0].description).toBe("N1")
    expect(records[1].description).toBe("N2")
  })

  it("parses Shopify 'Scent notes include …' as flat open-only notes without calling the LLM", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    const littleGrimCollapsed = [
      "_Faded wallpaper and secrets._",
      "Scent notes include dark red roses, labdanum, black pepper, light patchouli, plum, vanilla, benzoin, and golden amber.**",
      "Available in perfume oil: 1 ml sample size.",
      "Originally a part of our Haunted House collection box.",
    ].join(" ")

    const items: ScrapedItem[] = [
      {
        name: "Attic Bedroom",
        description: littleGrimCollapsed,
        image: "",
        detailURL: "https://www.littleandgrim.com/products/attic-bedroom-perfume-oil",
        perfumeHouse: "Little And Grim",
      },
    ]

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when flat listing is detected from structured text")
    })

    const records = await extractNotesForItems(items, "Little And Grim", { generateNoirDescriptions: false })

    expect(invokeMock).not.toHaveBeenCalled()
    expect(records).toHaveLength(1)
    const open = JSON.parse(records[0].openNotes) as string[]
    expect(open).toContain("dark red roses")
    expect(open).toContain("golden amber")
    expect(open.length).toBeGreaterThanOrEqual(8)
    expect(records[0].heartNotes).toBe("[]")
    expect(records[0].baseNotes).toBe("[]")
  })

  it("parses 'Fragrance notes are …' and 'Key notes: …' without LLM", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    const collapsed = [
      "Intro prose here.",
      "Fragrance notes are bergamot, rose absolute, and sandalwood.",
      "Key notes: lemon, cedar — extra story text Sweet as a memory.",
    ].join(" ")

    const items: ScrapedItem[] = [
      {
        name: "Universal PDP",
        description: collapsed,
        image: "",
        detailURL: "https://example.com/p/u",
        perfumeHouse: "House",
      },
    ]

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run")
    })

    const records = await extractNotesForItems(items, "House", { generateNoirDescriptions: false })

    expect(invokeMock).not.toHaveBeenCalled()
    const open = [
      ...JSON.parse(records[0].openNotes),
      ...JSON.parse(records[0].heartNotes),
      ...JSON.parse(records[0].baseNotes),
    ] as string[]
    expect(open).toContain("bergamot")
    expect(open).toContain("rose absolute")
    expect(open).toContain("lemon")
    expect(open).toContain("cedar")
  })

  it("parses profile / accords / with-notes-of / composition phrasing without LLM", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    const collapsed = [
      "Olfactory profile: iris, ambrette, and white musk.",
      "Key accords: tobacco, honey, vanilla.",
      "With notes of lime, mandarin, and sea salt.",
      "The fragrance composition features cedarwood, oakmoss, and vetiver.",
      "Shipping info follows.",
    ].join(" ")

    const items: ScrapedItem[] = [
      {
        name: "Multi phrase",
        description: collapsed,
        image: "",
        detailURL: "https://example.com/p/multi",
        perfumeHouse: "House",
      },
    ]

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run")
    })

    const records = await extractNotesForItems(items, "House", { generateNoirDescriptions: false })

    expect(invokeMock).not.toHaveBeenCalled()
    const all = [
      ...JSON.parse(records[0].openNotes),
      ...JSON.parse(records[0].heartNotes),
      ...JSON.parse(records[0].baseNotes),
    ] as string[]
    expect(all).toContain("iris")
    expect(all).toContain("tobacco")
    expect(all).toContain("lime")
    expect(all).toContain("mandarin")
    expect(all).toContain("cedarwood")
  })
})
