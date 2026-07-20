import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  augmentNotesSourceWithLabeledLists,
  clearPdpCachesForTests,
  pdpNoteBootstrapCache,
} from "@/lib/scraper/stages/pdp-bootstrap"
import {
  extractNotesFromStructuredText,
  prepareMerchantNotesSource,
  collectMerchantTrustedNotes,
  filterNotesByTrust,
  finalizeNoteLayersForExport,
  extractFlatNotes,
  expandParentheticalLayers,
  dedupeNotesAcrossLayers,
} from "@/lib/scraper/stages/title-cleaning"
import {
  confirmNoteLayersAgainstSource,
} from "@/lib/scraper/note-source-confirmation"
import type { ScrapedItem } from "@/lib/scraper/scraper-types"
import { extractNotesForItems } from "@/lib/scraper/stages/extract-notes-node"

// Mock the bedrock LLM
vi.mock("@/lib/llm/bedrock", () => ({
  createBedrockLLM: vi.fn().mockReturnValue({}),
}))

const invokeMock = vi.fn()
vi.mock("@langchain/aws", () => ({
  BedrockChat: vi.fn().mockImplementation(() => ({
    invoke: invokeMock,
  })),
}))

describe("diag_mojave", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => "" }))
    clearPdpCachesForTests()
    pdpNoteBootstrapCache.clear()
    vi.stubEnv("OPENAI_API_KEY", "test-key")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")
    invokeMock.mockReset()
    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when em-dash pyramid is present")
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("trace Mojave Ghost steps including preferAuthoritativeFlatNoteList path", () => {
    const mojavePdp =
      "Inspired by Mojave Ghost Absolu Eau De Parfum Andromedas Moon Originally from Byredo Unisex Top — Sapodilla, Ambrette Heart — Magnolia, Violet, Sandalwood Base — Musk, Amber, Cedarwood Scent Story Radiant yet grounded creamy woods airy florals"
    const cssBleed =
      "body, .color-background-1 { font-family: -apple-system; background: radial-gradient(circle, #fff, #000); }"
    const rawDescription = `${mojavePdp}\n\n${cssBleed}`

    const mergedBase = prepareMerchantNotesSource(rawDescription)
    const notesSource = augmentNotesSourceWithLabeledLists(mergedBase)

    let notes = extractNotesFromStructuredText(notesSource, 2)
    console.log("After extract:", JSON.stringify(notes))

    // preferAuthoritativeFlatNoteList equivalent
    const flatAuth = extractFlatNotes(notesSource)
    console.log("flatAuth:", JSON.stringify(flatAuth))

    // Check what expandParentheticalLayers does
    notes = expandParentheticalLayers(notes)
    console.log("After expandParentheticalLayers:", JSON.stringify(notes))

    // Collect trusted and apply first filterNotesByTrust
    let merchantTrustedNotes = collectMerchantTrustedNotes(notes, notesSource)
    console.log("merchantTrustedNotes before 1st filter:", JSON.stringify([...merchantTrustedNotes]))

    notes = {
      openNotes: filterNotesByTrust(notes.openNotes, merchantTrustedNotes),
      heartNotes: filterNotesByTrust(notes.heartNotes, merchantTrustedNotes),
      baseNotes: filterNotesByTrust(notes.baseNotes, merchantTrustedNotes),
    }
    console.log("After 1st filterNotesByTrust:", JSON.stringify(notes))

    notes = dedupeNotesAcrossLayers(notes)
    console.log("After dedupeNotesAcrossLayers:", JSON.stringify(notes))

    // confirmNoteLayersAgainstSource
    notes = confirmNoteLayersAgainstSource(notes, notesSource, { merchantTrusted: merchantTrustedNotes })
    console.log("After confirmNoteLayersAgainstSource:", JSON.stringify(notes))

    // Second filterNotesByTrust (lines 811-816 in extract-notes-node.ts)
    merchantTrustedNotes = collectMerchantTrustedNotes(notes, notesSource)
    notes = {
      openNotes: filterNotesByTrust(notes.openNotes, merchantTrustedNotes),
      heartNotes: filterNotesByTrust(notes.heartNotes, merchantTrustedNotes),
      baseNotes: filterNotesByTrust(notes.baseNotes, merchantTrustedNotes),
    }
    console.log("After 2nd filterNotesByTrust:", JSON.stringify(notes))

    const finalized = finalizeNoteLayersForExport(notes, merchantTrustedNotes)
    console.log("finalized:", JSON.stringify(finalized))

    expect(finalized.openNotes).toContain("sapodilla")
  })

  it("trace Mojave Ghost full pipeline", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    const mojavePdp =
      "Inspired by Mojave Ghost Absolu Eau De Parfum Andromedas Moon Originally from Byredo Unisex Top — Sapodilla, Ambrette Heart — Magnolia, Violet, Sandalwood Base — Musk, Amber, Cedarwood Scent Story Radiant yet grounded creamy woods airy florals"
    const cssBleed =
      "body, .color-background-1 { font-family: -apple-system, BlinkMacSystemFont, Roboto, Inter, system-ui, Helvetica, Arial, sans-serif; background: radial-gradient(circle, #fff, #000); }"

    const items: ScrapedItem[] = [
      {
        name: "Mojave Ghost Absolu Byredo",
        description: `${mojavePdp}\n\n${cssBleed}`,
        image: "",
        detailURL:
          "https://www.andromedasmoon.com/products/andromeda-s-inspired-by-mojave-ghost-absolu-eau-de-parfum-byredo",
        perfumeHouse: "Andromeda's Moon",
      },
    ]

    const { records } = await extractNotesForItems(items, "Andromeda's Moon", {
      generateNoirDescriptions: false,
      fetchPdpNoteBootstrap: false,
    })

    const open = JSON.parse(records[0].openNotes) as string[]
    const heart = JSON.parse(records[0].heartNotes) as string[]
    const base = JSON.parse(records[0].baseNotes) as string[]
    console.log("Pipeline result - open:", open, "heart:", heart, "base:", base)
    console.log("_noteSource:", records[0]._noteSource)

    expect(open).toEqual(expect.arrayContaining(["sapodilla", "ambrette"]))
    expect(heart).toEqual(expect.arrayContaining(["magnolia", "violet", "sandalwood"]))
    expect(base).toEqual(expect.arrayContaining(["musk", "amber", "cedarwood"]))
  })
})
