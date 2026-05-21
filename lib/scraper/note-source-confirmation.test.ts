import { describe, expect, it, vi } from "vitest"

import { extractNotesForItems } from "./notes-graph"
import type { ScrapedItem } from "@/types/scraper"
import {
  buildNoteConfirmationCorpus,
  confirmNoteLayersAgainstSource,
  extractUnlabeledFragranceNotesBlock,
  isNoteSubstantiatedInSource,
} from "./note-source-confirmation"

const invokeMock = vi.hoisted(() => vi.fn())

vi.mock("@langchain/openai", () => ({
  ChatOpenAI: class MockChatOpenAI {
    constructor() {}
    invoke = invokeMock
  },
}))

const BLACK_TIE_SOURCE = `
Inspired by Black Tie Originally by Celine
I was told there was an issue with the formula and it was found that it was a blend of two fragrances one being black tie and that's why there was an issue.
The Vibe A couture vanilla wrapped in powdery iris.
Fragrance Notes
White Orris / IrisSoft powder, elegant and refined
VanillaSmooth, tailored sweetness — never syrupy
CedarwoodClean structure and woody depth
MuskSoft, skin-like finish
Tree MossCool green shadow for depth
Main Accords: powdery • vanilla • iris • woody • musky • mossy
When to Wear
Perfect for evenings, polished office wear, or when you want to feel expensive and composed.A sophisticated vanilla with couture restraint.
Available Sizes 5ml • 15ml • 30ml • 60ml • 100ml
`

const INK_MARK_SOURCE = `
Inspired by Ink Mark Eau De Parfum
Notes Top: Inky violet air • aromatic lift Heart: Incense smoke • soft powdery woods Base: Sandalwood • amber warmth • lingering woody glow
How It Wears Projection: Medium
`

const GLUED_BLACK_TIE_SOURCE = `Inspired by Black Tie Originally by Celine The Vibe A couture vanilla wrapped in powdery iris. Fragrance Notes White Orris / IrisSoft powder, elegant and refined VanillaSmooth, tailored sweetness — never syrupy CedarwoodClean structure and woody depth MuskSoft, skin-like finish Tree MossCool green shadow for depth Main Accords: powdery • vanilla • iris • woody • musky • mossy When to Wear Perfect for evenings.`

describe("note-source-confirmation", () => {
  it("extractUnlabeledFragranceNotesBlock parses Andromeda Black Tie material lines", () => {
    expect(extractUnlabeledFragranceNotesBlock(BLACK_TIE_SOURCE)).toEqual(
      expect.arrayContaining(["white orris", "iris", "vanilla", "cedarwood", "musk", "tree moss"]),
    )
  })

  it("extractUnlabeledFragranceNotesBlock parses glued Shopify Fragrance Notes (no newlines)", () => {
    expect(extractUnlabeledFragranceNotesBlock(GLUED_BLACK_TIE_SOURCE)).toEqual(
      expect.arrayContaining(["white orris", "iris", "vanilla", "cedarwood", "musk", "tree moss"]),
    )
    expect(extractUnlabeledFragranceNotesBlock(GLUED_BLACK_TIE_SOURCE)).not.toEqual(
      expect.arrayContaining(["powdery", "woody", "musky"]),
    )
  })

  it("isNoteSubstantiatedInSource rejects When to Wear prose not in note corpus", () => {
    const corpus = buildNoteConfirmationCorpus(BLACK_TIE_SOURCE)
    expect(isNoteSubstantiatedInSource("vanilla", corpus, BLACK_TIE_SOURCE)).toBe(true)
    expect(isNoteSubstantiatedInSource("white orris", corpus, BLACK_TIE_SOURCE)).toBe(true)
    expect(isNoteSubstantiatedInSource("or when you want to feel expensive", corpus, BLACK_TIE_SOURCE)).toBe(
      false,
    )
    expect(isNoteSubstantiatedInSource("two fragrances one being black tie", corpus, BLACK_TIE_SOURCE)).toBe(
      false,
    )
  })

  it("confirmNoteLayersAgainstSource drops junk but keeps substantiated notes", () => {
    const result = confirmNoteLayersAgainstSource(
      {
        openNotes: [
          "white orris",
          "iris",
          "vanilla",
          "polished office wear",
          "or when you want to feel expensive",
          "two fragrances one being black tie",
        ],
        heartNotes: [],
        baseNotes: ["cedarwood", "musk"],
      },
      BLACK_TIE_SOURCE,
    )
    expect(result.openNotes).toEqual(expect.arrayContaining(["white orris", "iris", "vanilla"]))
    expect(result.openNotes).not.toEqual(expect.arrayContaining(["polished office wear"]))
    expect(result.baseNotes).toEqual(expect.arrayContaining(["cedarwood", "musk"]))
  })

  it("confirms parenthetical Top Notes materials (Pattern/Etsy)", () => {
    const source = `Top Notes: Atmosphere and Ocean Accord (Ozone, Salt Water)
Middle Notes: Verdant Earth Accord (Rich Soil, Green and Flowering Plants)`
    const corpus = buildNoteConfirmationCorpus(source)
    expect(isNoteSubstantiatedInSource("ozone", corpus, source)).toBe(true)
    expect(isNoteSubstantiatedInSource("salt water", corpus, source)).toBe(true)
    expect(isNoteSubstantiatedInSource("rich soil", corpus, source)).toBe(true)
    const confirmed = confirmNoteLayersAgainstSource(
      { openNotes: ["ozone", "salt water", "atmosphere and ocean accord"], heartNotes: ["rich soil"], baseNotes: [] },
      source,
    )
    expect(confirmed.openNotes).toEqual(expect.arrayContaining(["ozone", "salt water"]))
  })

  it("confirms Ink Mark labeled pyramid notes", () => {
    const layers = {
      openNotes: ["inky violet air", "aromatic lift"],
      heartNotes: ["incense smoke", "soft powdery woods"],
      baseNotes: ["sandalwood", "amber warmth", "lingering woody glow"],
    }
    const confirmed = confirmNoteLayersAgainstSource(layers, INK_MARK_SOURCE)
    expect(confirmed.openNotes).toEqual(expect.arrayContaining(["inky violet air", "aromatic lift"]))
    expect(confirmed.baseNotes).toEqual(
      expect.arrayContaining(["sandalwood", "amber warmth", "lingering woody glow"]),
    )
  })

  it("pipeline drops Black Tie When to Wear prose while keeping Fragrance Notes materials", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")
    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run")
    })

    const items: ScrapedItem[] = [
      {
        name: "Inspired By Black Tie Cline",
        description: BLACK_TIE_SOURCE,
        image: "",
        detailURL: "https://www.andromedasmoon.com/products/andromedas-inspired-by-black-tie-eau-de-parfum-celine",
        perfumeHouse: "Andromeda's Moon",
      },
    ]

    const { records } = await extractNotesForItems(items, "Andromeda's Moon", {
      generateNoirDescriptions: false,
      fetchPdpNoteBootstrap: false,
    })

    const open = JSON.parse(records[0].openNotes) as string[]
    expect(open).toEqual(expect.arrayContaining(["white orris", "iris", "vanilla"]))
    expect(open).not.toEqual(expect.arrayContaining(["powdery", "woody", "musky", "mossy"]))
    expect(open).not.toEqual(expect.arrayContaining(["polished office wear"]))
    expect(open).not.toEqual(expect.arrayContaining(["or when you want to feel expensive"]))
    vi.unstubAllEnvs()
  })
})
