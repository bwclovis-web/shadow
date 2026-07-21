/**
 * Golden PDP HTML snippets + skip/enrich/relayer matrix for note-accuracy regressions.
 */
import { describe, expect, it, vi } from "vitest"

import {
  confirmNoteLayersAgainstSource,
} from "./note-source-confirmation"
import {
  pythonMerchantNotesComplete,
  scrapedItemsNeedArtisticFragrancesRepair,
  scrapedItemsNeedEtatLibreEnrichment,
  scrapedItemsNeedPatternEtsyEnrichment,
} from "./map-scraped-items"
import { extractNotesFromStructuredText, filterNotesByTrust } from "./stages/title-cleaning"
import { htmlHasLabeledNotePyramid } from "./detect-platform"
import type { ScrapedItem } from "@/types/scraper"

vi.mock("@langchain/openai", () => ({
  ChatOpenAI: class MockChatOpenAI {
    constructor() {}
    invoke = vi.fn()
  },
}))

const NAVIGLIO_PYRAMID = `Head Notes: Marseille Soapbar Accord, Bergamot Calabria, Neroli
Heart Notes: Lavandin, Petitgrain, Vetiver Haiti
Base Notes: Cedarwood, White Musks, Acquatic notes.`

const NAVIGLIO_HTML = `
<div class="summary">
  <h2>Naviglio</h2>
  <p>Head Notes: Marseille Soapbar Accord, Bergamot Calabria, Neroli</p>
  <p>Heart Notes: Lavandin, Petitgrain, Vetiver Haiti</p>
  <p>Base Notes: Cedarwood, White Musks, Acquatic notes.</p>
</div>
`

const ETAT_MAIN_NOTES_HTML = `
<h3>MAIN NOTES</h3>
<p>Rose absolute, violet, leather, lily of the valley, tangerine, ginger, rice powder, amber, animal notes</p>
`

/** Damask-style flat Notes: plus PhotoSwipe zoom i18n that polluted heartNotes. */
const DAMASK_AGAPE_POLLUTED = `
Notes: Palo santo, blood orange, soft white florals, peach, copaiba balsam, cedar moss, vetiver, sandalwood
zoomClose: "Close (Esc)" zoomPrev: "Previous (Left arrow key)" zoomNext: "Next (Right arrow key)"
esc left arrow key right arrow key
`

const FRAGARIA_SOURCE =
  "Top Notes: Crushed Pink Pepper, Sparkling Mandarin, Zesty Bergamot Heart Notes: Wild Strawberry, Violet Veil, Orris Butter Base Notes: Smoked Vetiver, Cedarwood Shavings, Patchouli Resin, Fir Balsam"

describe("golden HTML fixtures", () => {
  it("Naviglio HTML has a labeled pyramid", () => {
    expect(htmlHasLabeledNotePyramid(NAVIGLIO_HTML)).toBe(true)
  })

  it("extracts Naviglio Head/Heart/Base materials from pyramid text", () => {
    const notes = extractNotesFromStructuredText(NAVIGLIO_PYRAMID, 2)
    expect(notes.openNotes.join(" ")).toMatch(/bergamot|neroli|marseille/i)
    expect(notes.heartNotes.join(" ")).toMatch(/lavandin|petitgrain|vetiver/i)
    expect(notes.baseNotes.join(" ")).toMatch(/cedarwood|musk|acquatic|aquatic/i)
  })

  it("Etat MAIN NOTES HTML is detected as note-list content", () => {
    expect(/\bMAIN NOTES\b/i.test(ETAT_MAIN_NOTES_HTML)).toBe(true)
    const notes = extractNotesFromStructuredText(
      "MAIN NOTES: Rose absolute, violet, leather, lily of the valley, tangerine, ginger",
      2,
    )
    expect(notes.openNotes.length + notes.heartNotes.length + notes.baseNotes.length).toBeGreaterThan(0)
  })

  it("Damask flat Notes: materials survive; gallery zoom chrome is filtered", () => {
    const extracted = extractNotesFromStructuredText(DAMASK_AGAPE_POLLUTED, 2)
    const all = [...extracted.openNotes, ...extracted.heartNotes, ...extracted.baseNotes]
    const trusted = new Set(all.map(n => n.trim().toLowerCase()))
    const kept = [
      ...filterNotesByTrust(extracted.openNotes, trusted),
      ...filterNotesByTrust(extracted.heartNotes, trusted),
      ...filterNotesByTrust(extracted.baseNotes, trusted),
    ].map(n => n.toLowerCase())

    expect(kept.join(" ")).toMatch(/palo santo|blood orange|vetiver|sandalwood/i)
    expect(kept).not.toContain("esc")
    expect(kept).not.toContain("left arrow key")
    expect(kept).not.toContain("right arrow key")
    expect(kept).not.toContain("ndash")
  })
})

describe("skip/enrich/relayer matrix", () => {
  it("complete-but-wrong prose notes fail pythonMerchantNotesComplete", () => {
    const item: ScrapedItem = {
      name: "Wrong",
      description: "noir prose",
      image: "",
      detailURL: "https://example.com/products/wrong",
      openNotes: ["notes swirl", "she replies", "like a faceted"],
      heartNotes: ["to the imagination", "or what", "rgba"],
      baseNotes: ["linear-gradient", "footer", "navigation"],
      _noteSource: "text_regex_layered",
    }
    expect(pythonMerchantNotesComplete([item])).toBe(false)
  })

  it("thin Pattern Etsy notes need enrichment", () => {
    const item: ScrapedItem = {
      name: "Pattern Accords",
      description: "",
      image: "",
      detailURL: "https://www.etsy.com/listing/123/pattern-by-etsy-perfume",
      openNotes: ["woody", "floral"],
      heartNotes: ["musky"],
      baseNotes: [],
      _noteSource: "html_flat",
    }
    expect(scrapedItemsNeedPatternEtsyEnrichment([item])).toBe(true)
  })

  it("Etat prose junk notes need enrichment", () => {
    const item: ScrapedItem = {
      name: "Putain",
      description: "FULL DESCRIPTION she replies",
      image: "",
      detailURL: "https://www.etatlibredorange.com/products/putain-des-palaces",
      openNotes: ["she replies", "notes swirl"],
      heartNotes: ["like a faceted"],
      baseNotes: ["to the imagination"],
      _noteSource: "llm_description",
    }
    expect(scrapedItemsNeedEtatLibreEnrichment([item])).toBe(true)
  })

  it("Milano empty open needs Artistic repair", () => {
    const item: ScrapedItem = {
      name: "Naviglio",
      description: "noir only",
      image: "",
      detailURL: "https://artisticfragrances.com/milano-fragranze/naviglio/",
      openNotes: [],
      heartNotes: ["lavandin", "petitgrain", "vetiver"],
      baseNotes: ["cedarwood", "musk", "aquatic"],
      _noteSource: "llm_description",
    }
    expect(scrapedItemsNeedArtisticFragrancesRepair([item])).toBe(true)
    expect(pythonMerchantNotesComplete([item])).toBe(false)
  })

  it("relayer keeps Fragaria heart materials in heart after mis-layer", () => {
    const mislayered = {
      openNotes: [
        "crushed pink pepper",
        "sparkling mandarin",
        "zesty bergamot",
        "wild strawberry",
        "violet veil",
        "orris butter",
      ],
      heartNotes: [],
      baseNotes: ["smoked vetiver", "cedarwood shavings", "patchouli resin", "fir balsam"],
    }
    const confirmed = confirmNoteLayersAgainstSource(mislayered, FRAGARIA_SOURCE)
    expect(confirmed.heartNotes).toEqual(
      expect.arrayContaining(["wild strawberry", "violet veil", "orris butter"]),
    )
  })

  it("filterNotesByTrust keeps trusted E.O. materials", () => {
    const trusted = new Set(["lavandin e.o.", "neroli e.o."])
    const kept = filterNotesByTrust(["lavandin e.o.", "neroli e.o.", "a whisper of"], trusted)
    expect(kept).toEqual(expect.arrayContaining(["lavandin e.o.", "neroli e.o."]))
  })
})
