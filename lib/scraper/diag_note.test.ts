import { describe, it, vi, beforeEach, afterEach } from "vitest"
import type { ScrapedItem } from "@/types/scraper"
import { extractNotesForItems } from "./notes-graph"
import { clearPdpCachesForTests, pdpNoteBootstrapCache, augmentNotesSourceWithLabeledLists } from "@/lib/scraper/stages/pdp-bootstrap"
import { prepareMerchantNotesSource } from "@/lib/scraper/stages/title-cleaning"
import { buildNoteConfirmationCorpus } from "./note-source-confirmation"

const invokeMock = vi.hoisted(() => vi.fn())
vi.mock("@langchain/openai", () => ({
  ChatOpenAI: class MockChatOpenAI {
    constructor() {}
    invoke = invokeMock
  },
}))

describe("mojave ghost diag", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => "" }))
    clearPdpCachesForTests()
    pdpNoteBootstrapCache.clear()
    invokeMock.mockImplementation(() => { throw new Error("LLM should not run") })
    vi.stubEnv("OPENAI_API_KEY", "test-key")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("trace augmented source authoritative materials", () => {
    const mojavePdp = "Inspired by Mojave Ghost Absolu Eau De Parfum Andromedas Moon Originally from Byredo Unisex Top — Sapodilla, Ambrette Heart — Magnolia, Violet, Sandalwood Base — Musk, Amber, Cedarwood Scent Story Radiant yet grounded creamy woods airy florals"
    const cssBleed = "body, .color-background-1 { font-family: -apple-system, BlinkMacSystemFont, Roboto, Inter, system-ui, Helvetica, Arial, sans-serif; background: radial-gradient(circle, #fff, #000); }"
    const fullDesc = `${mojavePdp}\n\n${cssBleed}`
    
    const prepared = prepareMerchantNotesSource(fullDesc)
    console.log("prepared:", JSON.stringify(prepared.slice(0, 200)))
    
    const augmented = augmentNotesSourceWithLabeledLists(prepared)
    console.log("augmented (first 400):", JSON.stringify(augmented.slice(0, 400)))
    
    console.log("corpus (first 200):", JSON.stringify(buildNoteConfirmationCorpus(augmented).slice(0, 200)))
  })

  it("runs full pipeline and logs notes", async () => {
    const mojavePdp = "Inspired by Mojave Ghost Absolu Eau De Parfum Andromedas Moon Originally from Byredo Unisex Top — Sapodilla, Ambrette Heart — Magnolia, Violet, Sandalwood Base — Musk, Amber, Cedarwood Scent Story Radiant yet grounded creamy woods airy florals"
    const cssBleed = "body, .color-background-1 { font-family: -apple-system, BlinkMacSystemFont, Roboto, Inter, system-ui, Helvetica, Arial, sans-serif; background: radial-gradient(circle, #fff, #000); }"

    const items: ScrapedItem[] = [{
      name: "Mojave Ghost Absolu Byredo",
      description: `${mojavePdp}\n\n${cssBleed}`,
      image: "",
      detailURL: "https://www.andromedasmoon.com/products/andromeda-s-inspired-by-mojave-ghost-absolu-eau-de-parfum-byredo",
      perfumeHouse: "Andromeda's Moon",
    }]

    const { records } = await extractNotesForItems(items, "Andromeda's Moon", {
      generateNoirDescriptions: false,
      fetchPdpNoteBootstrap: false,
    })

    const open = JSON.parse(records[0].openNotes) as string[]
    const heart = JSON.parse(records[0].heartNotes) as string[]
    const base = JSON.parse(records[0].baseNotes) as string[]
    console.log("open:", JSON.stringify(open), "heart:", JSON.stringify(heart), "base:", JSON.stringify(base))
    console.log("record.ok:", records[0])
  })
})
