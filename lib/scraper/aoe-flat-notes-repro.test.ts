import { beforeEach, describe, expect, it, vi } from "vitest"

const invokeMock = vi.fn()
vi.mock("@langchain/openai", () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    invoke: (...args: unknown[]) => invokeMock(...args),
  })),
}))

import { clearPdpCachesForTests, extractNotesForItems } from "./notes-graph"
import { scrapedItemsNeedNodeRepair, pythonMerchantNotesComplete } from "./map-scraped-items"
import type { ScrapedItem } from "@/types/scraper"

describe("AOE Wix html_flat enrichOnly", () => {
  beforeEach(() => {
    clearPdpCachesForTests()
    invokeMock.mockReset()
    process.env.OPENAI_API_KEY = "test-key"
  })

  const item: ScrapedItem = {
    name: "Garden Warfare",
    detailURL: "https://www.aoeperfumery.com/product-page/garden-warfare",
    description: "",
    notesText: "",
    openNotes: [
      "tomato leaf",
      "lemongrass",
      "ginger",
      "basil",
      "banana leaf",
      "lavender",
      "dirt",
      "cedarwood",
      "sun-dried tomato accord",
      "honeysuckle",
    ],
    heartNotes: [],
    baseNotes: [],
    _noteSource: "html_flat",
    image: "https://example.com/x.png",
    perfumeHouse: "Area Of Effect",
  }

  it("flags empty description for repair and does not treat flat as complete pyramid", () => {
    expect(scrapedItemsNeedNodeRepair([item])).toBe(true)
    expect(pythonMerchantNotesComplete([item])).toBe(false)
  })

  it("keeps Python html_flat openNotes through enrichOnly", async () => {
    invokeMock.mockResolvedValue({
      content: JSON.stringify({ openNotes: [], heartNotes: [], baseNotes: [] }),
    })
    const { records } = await extractNotesForItems([item], "Area Of Effect", {
      enrichOnly: true,
      noteInferenceMode: "strict",
      generateNoirDescriptions: false,
      fetchPdpNoteBootstrap: false,
      noteValidationMode: "off",
    })
    const open = JSON.parse(records[0].openNotes) as string[]
    const heart = JSON.parse(records[0].heartNotes) as string[]
    const base = JSON.parse(records[0].baseNotes) as string[]
    expect(open.length + heart.length + base.length).toBe(10)
    expect(open).toEqual(
      expect.arrayContaining([
        "tomato leaf",
        "basil",
        "honeysuckle",
        "sun-dried tomato accord",
      ]),
    )
    expect(records[0]._noteSource).toBe("html_flat")
  })

  it("keeps text_regex_flat the same way", async () => {
    invokeMock.mockResolvedValue({
      content: JSON.stringify({ openNotes: [], heartNotes: [], baseNotes: [] }),
    })
    const flat = { ...item, _noteSource: "text_regex_flat" }
    const { records } = await extractNotesForItems([flat], "Area Of Effect", {
      enrichOnly: true,
      noteInferenceMode: "strict",
      generateNoirDescriptions: false,
      fetchPdpNoteBootstrap: false,
      noteValidationMode: "off",
    })
    const open = JSON.parse(records[0].openNotes) as string[]
    console.log("FLAT RESULT", open, records[0]._noteSource)
    expect(open.length).toBeGreaterThanOrEqual(8)
  })
})
