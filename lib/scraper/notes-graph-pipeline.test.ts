import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { ScrapedItem } from "@/types/scraper"

const invokeMock = vi.fn()

vi.mock("@langchain/openai", () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    invoke: (...args: unknown[]) => invokeMock(...args),
  })),
}))

import {
  clearPdpCachesForTests,
  computeBatchNoteUniformityWarnings,
  detailUrlAlignsWithProductName,
  extractNotesForItems,
  extractNotesFromStructuredText,
  isEtatLibreProductUrl,
  isUnusableMerchantDescription,
  mergeFlatMaterialsIntoLayeredPyramid,
  normalizePdpDescription,
  sanitizeCopyForNotePipeline,
  stripEtatLibreUiNoise,
} from "./notes-graph"
import {
  scrapedItemsNeedEtatLibreEnrichment,
  scrapedItemsNeedNodeRepair,
  scrapedItemsNeedPatternEtsyEnrichment,
} from "./map-scraped-items"
import { canonicalizeNote, explodeSpaceSeparatedNoteBlob, splitGluedMerchantNoteRun } from "./canonical-notes"

/** Structured notes with 3 layers and enough notes to skip merge LLM; keeps Phase 1 free of invoke(). */
const NOTES_TEXT_NO_LLM = `Top: bergamot, lemon
Heart: rose, jasmine
Base: vetiver, sandalwood`

describe("sanitizeCopyForNotePipeline", () => {
  it("removes box-drawing and decorative lines but keeps labeled note lines", () => {
    const input = "════\nTop notes: bergamot, rose\n───"
    const out = sanitizeCopyForNotePipeline(input)
    expect(out).toContain("Top notes:")
    expect(out).toContain("bergamot")
    expect(out).not.toMatch(/═/)
  })

  it("fixes common LLM typo I cone → I come", () => {
    expect(sanitizeCopyForNotePipeline("I cone to this fragrance.")).toBe("I come to this fragrance.")
  })
})

describe("extractNotesFromStructuredText", () => {
  it("Juliet Rose hyphen pyramid keeps layers and drops Squarespace footer extras", () => {
    const text = `Super warm comforting vanilla patchouli with amber, musk and sandalwood.

Top notes - Orange, Mandarin,
Middle notes - Cardamom, Tonka, Geranium
Base notes - Amber, Sandalwood, Vanilla, Patchouli

Made with Squarespace`
    const notes = extractNotesFromStructuredText(text)
    expect(notes.openNotes).toEqual(expect.arrayContaining(["orange", "mandarin"]))
    for (const extra of ["amber", "sandalwood", "vanilla", "patchouli", "musk"]) {
      expect(notes.openNotes).not.toContain(extra)
    }
    expect(notes.heartNotes).toEqual(expect.arrayContaining(["cardamom", "tonka", "geranium"]))
    expect(notes.baseNotes).toEqual(expect.arrayContaining(["amber", "sandalwood", "vanilla", "patchouli"]))
    expect([...notes.openNotes, ...notes.heartNotes, ...notes.baseNotes].join(" ")).not.toMatch(/squarespace/)
  })
})

describe("explodeSpaceSeparatedNoteBlob", () => {
  it("splits space-joined single-word materials (Amaterasu base)", () => {
    expect(explodeSpaceSeparatedNoteBlob("vanilla caramel coffee litchi incense praline")).toEqual([
      "vanilla",
      "caramel",
      "coffee",
      "litchi",
      "incense",
      "praline",
    ])
  })

  it("splits space-joined top notes (Amaterasu open)", () => {
    expect(explodeSpaceSeparatedNoteBlob("pear bergamot tangerine")).toEqual([
      "pear",
      "bergamot",
      "tangerine",
    ])
  })

  it("explodeSpaceSeparatedNoteBlob splits Milk Orchid space-joined materials", () => {
    expect(explodeSpaceSeparatedNoteBlob("coconut fig milk almond blossom")).toEqual([
      "coconut",
      "fig milk",
      "almond blossom",
    ])
    expect(explodeSpaceSeparatedNoteBlob("vanilla orchid magnolia")).toEqual([
      "vanilla orchid",
      "magnolia",
    ])
  })

  it("explodeSpaceSeparatedNoteBlob splits decorative ✧ separators", () => {
    expect(explodeSpaceSeparatedNoteBlob("vanilla ✧ mimosa")).toEqual(["vanilla", "mimosa"])
    expect(explodeSpaceSeparatedNoteBlob("amber ✧ musk ✧ vetiver")).toEqual([
      "amber",
      "musk",
      "vetiver",
    ])
  })

  it("explodeSpaceSeparatedNoteBlob splits Andromeda Moon comma-less merchant blobs", () => {
    expect(explodeSpaceSeparatedNoteBlob("orange blossom candied almond")).toEqual([
      "orange blossom",
      "candied almond",
    ])
    expect(explodeSpaceSeparatedNoteBlob("musk ambroxan tonka bean")).toEqual([
      "musk",
      "ambroxan",
      "tonka bean",
    ])
    expect(explodeSpaceSeparatedNoteBlob("cotton candy marshmallow")).toEqual([
      "cotton candy",
      "marshmallow",
    ])
    expect(explodeSpaceSeparatedNoteBlob("marshmallow natural musk")).toEqual([
      "marshmallow",
      "natural musk",
    ])
    expect(explodeSpaceSeparatedNoteBlob("mahogany tonka bean")).toEqual([
      "mahogany",
      "tonka bean",
    ])
    expect(explodeSpaceSeparatedNoteBlob("Musk White Musk Sesame Mimosa Blonde Woods")).toEqual([
      "musk",
      "white musk",
      "sesame",
      "mimosa",
      "blonde woods",
    ])
  })

  it("splitGluedMerchantNoteRun parses Andromeda Main Notes runs without commas", () => {
    const lower = "bourbon vanilla orange blossom vanilla caviar lavender rum"
    expect(splitGluedMerchantNoteRun(lower)).toEqual([
      "bourbon vanilla",
      "orange blossom",
      "vanilla caviar",
      "lavender",
      "rum",
    ])
    expect(
      splitGluedMerchantNoteRun("Bourbon Vanilla Orange Blossom Vanilla Caviar Lavender Rum"),
    ).toEqual(["bourbon vanilla", "orange blossom", "vanilla caviar", "lavender", "rum"])
    expect(splitGluedMerchantNoteRun("Almond Amaretto Liqueur Accord")).toEqual([
      "almond",
      "amaretto liqueur accord",
    ])
    expect(splitGluedMerchantNoteRun("Amber Vanilla Moss")).toEqual(["amber", "vanilla", "moss"])
    expect(splitGluedMerchantNoteRun("Orange Bergamot Golden Mist")).toEqual(["orange", "bergamot"])
    expect(explodeSpaceSeparatedNoteBlob("orange bergamot golden mist")).toEqual(["orange", "bergamot"])
  })
})

describe("notes pipeline (parallel phase 1 + sequential noir)", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "test-key")
    /**
     * Tests assert exact LLM call counts (often "not called at all" for pure-regex paths). The bulk
     * note validator adds one call per scrape run; opt out at the env level so existing assertions
     * stay accurate. Tests that want to verify validator behavior can override the option per call.
     */
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")
    invokeMock.mockReset()
    clearPdpCachesForTests()
    /**
     * Default to returning 404 for all fetch calls so tests that don't need real HTTP don't make
     * real network requests. Tests that need specific PDP HTML must stub fetch themselves.
     */
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => "" }))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("Featured notes after long prelude: still extracts merchant list (augment + flat)", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    const longProse =
      "Softly illuminated by the flicker of a distant streetlamp, the intoxicating blend of ripe plum and blooming rose unfurls like a secret whispered in the night. "
    const featured =
      "Featured Notes : Apricot, Black Tea, Tunisian Neroli, Turkish Rose, Cabernet, Cognac, Oakwood, Honeyed Amber, Labdanum, Vanilla, Maple, Immortelle, Tobacco, Benzoin, Hay, and Leather."
    const tail = " Concentration: Eau de Parfum"

    const items: ScrapedItem[] = [
      {
        name: "Septamber",
        description: longProse + featured + tail,
        image: "",
        detailURL: "https://gallagherfragrances.com/products/septamber",
        perfumeHouse: "Gallagher Fragrances",
      },
    ]

    invokeMock.mockImplementation(() => {
      throw new Error("LLM must not run when Featured Notes line is present")
    })

    const { records } = await extractNotesForItems(items, "Gallagher Fragrances", {
      generateNoirDescriptions: false,
      titleDashSegment: "before",
    })

    expect(invokeMock).not.toHaveBeenCalled()
    const open = JSON.parse(records[0].openNotes) as string[]
    expect(open).toContain("apricot")
    expect(open).toContain("tunisian neroli")
    expect(open).toContain("leather")
    expect(open.length).toBeGreaterThanOrEqual(12)
    expect(records[0].heartNotes).toBe("[]")
    expect(records[0].baseNotes).toBe("[]")
  })

  it("metaphor prose with no labels: NOTE_SYSTEM is called and extracts the materials buried in the prose", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    const noirOnly = [
      "Beneath neon reflecting on rain-slick pavement, she wore a secret no one could name.",
      "Ripe plum and velvet rose open the story, brushed with brown sugar and golden honey, a warmth that clings like smoke in a dim hotel bar.",
      "Midnight waits in the wings; the city hums, indifferent, as amber light pools on lacquered wood.",
    ].join(" ")

    const items: ScrapedItem[] = [
      {
        name: "Lavender & Bourbon",
        description: noirOnly,
        image: "",
        detailURL: "https://gallagherfragrances.com/products/lavender-bourbon",
        perfumeHouse: "Gallagher Fragrances",
      },
    ]

    invokeMock.mockImplementation(async (messages: unknown) => {
      const msgs = messages as { role: string; content: string }[]
      const sys = msgs.find(m => m.role === "system")?.content ?? ""
      if (!sys.includes("master perfumer")) {
        throw new Error(`Expected NOTE_SYSTEM prompt; got system preview: "${sys.slice(0, 120)}"`)
      }
      return {
        content: JSON.stringify({
          openNotes: ["plum", "rose"],
          heartNotes: ["brown sugar", "honey"],
          baseNotes: ["amber", "lacquered wood"],
        }),
      }
    })

    const { records } = await extractNotesForItems(items, "Gallagher Fragrances", {
      generateNoirDescriptions: false,
      titleDashSegment: "before",
    })

    expect(invokeMock).toHaveBeenCalledTimes(1)
    const open = JSON.parse(records[0].openNotes) as string[]
    const heart = JSON.parse(records[0].heartNotes) as string[]
    const base = JSON.parse(records[0].baseNotes) as string[]
    expect(open).toContain("plum")
    expect(open).toContain("rose")
    expect(heart).toContain("brown sugar")
    expect(heart).toContain("honey")
    expect(base).toContain("amber")
    expect(base).toContain("lacquered wood")
  })

  it("prose-only description (no labels): LLM extracts materials and noir runs once notes are non-empty", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    const items: ScrapedItem[] = [
      {
        name: "Smoked Oak",
        description:
          "Bourbon, smoked oak, and a whisper of vanilla unfurl as midnight settles over the empty street.",
        image: "",
        detailURL: "https://example.com/p/smoked-oak",
        perfumeHouse: "Test House",
      },
    ]

    let noteCalls = 0
    let noirCalls = 0
    let fallbackCalls = 0
    invokeMock.mockImplementation(async (messages: unknown) => {
      const msgs = messages as { role: string; content: string }[]
      const sys = msgs.find(m => m.role === "system")?.content ?? ""
      if (sys.includes("film noir")) {
        noirCalls++
        return { content: "A bourbon-soaked confession beneath flickering neon." }
      }
      if (sys.includes("fragrance encyclopedia")) {
        fallbackCalls++
        throw new Error("Fallback should not run when NOTE_SYSTEM extracts materials from prose")
      }
      if (sys.includes("master perfumer")) {
        noteCalls++
        return {
          content: JSON.stringify({
            openNotes: ["bourbon"],
            heartNotes: ["oak"],
            baseNotes: ["vanilla"],
          }),
        }
      }
      throw new Error(`Unexpected system prompt: ${sys.slice(0, 80)}`)
    })

    const { records } = await extractNotesForItems(items, "Test House", { generateNoirDescriptions: true })

    expect(noteCalls).toBe(1)
    expect(fallbackCalls).toBe(0)
    expect(noirCalls).toBe(1)
    expect(JSON.parse(records[0].openNotes)).toContain("bourbon")
    expect(JSON.parse(records[0].heartNotes)).toContain("oak")
    expect(JSON.parse(records[0].baseNotes)).toContain("vanilla")
    expect(records[0].description).toContain("bourbon-soaked confession")
  })

  it("empty detailURL (DB refresh): noir still runs when 2+ notes are extracted", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    const items: ScrapedItem[] = [
      {
        name: "Smoked Oak",
        description: "Top notes: bourbon, oak. Base: vanilla.",
        image: "",
        detailURL: "",
        perfumeHouse: "Test House",
      },
    ]

    let noirCalls = 0
    invokeMock.mockImplementation(async (messages: unknown) => {
      const msgs = messages as { role: string; content: string }[]
      const sys = msgs.find(m => m.role === "system")?.content ?? ""
      if (sys.includes("film noir")) {
        noirCalls++
        return { content: "Neon rain on wet oak and bourbon smoke." }
      }
      if (sys.includes("master perfumer")) {
        return {
          content: JSON.stringify({
            openNotes: ["bourbon"],
            heartNotes: ["oak"],
            baseNotes: ["vanilla"],
          }),
        }
      }
      return { content: JSON.stringify({ openNotes: [], heartNotes: [], baseNotes: [] }) }
    })

    const { records } = await extractNotesForItems(items, "Test House", { generateNoirDescriptions: true })

    expect(noirCalls).toBe(1)
    expect(records[0].description).toContain("Neon rain")
  })

  it("Squarespace template-* PDP URL: hyphen pyramid stays layered and noir still runs", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    const items: ScrapedItem[] = [
      {
        name: "Vanilla Amber Patchouli",
        description: `Super warm comforting vanilla patchouli with amber, musk and sandalwood.

Top notes - Orange, Mandarin,
Middle notes - Cardamom, Tonka, Geranium
Base notes - Amber, Sandalwood, Vanilla, Patchouli

Made with Squarespace`,
        image: "",
        detailURL: "https://www.julietrose.online/store-AbxoL/p/template-t22ln-stxwc-kxg36-hjby8",
        perfumeHouse: "Juliet Rose",
      },
    ]

    let noirCalls = 0
    invokeMock.mockImplementation(async (messages: unknown) => {
      const msgs = messages as { role: string; content: string }[]
      const sys = msgs.find(m => m.role === "system")?.content ?? ""
      if (sys.includes("film noir")) {
        noirCalls++
        return { content: "Orange peel snaps in a dim corridor; patchouli waits at the far end." }
      }
      throw new Error("LLM must not extract notes when a hyphen pyramid is present")
    })

    const { records } = await extractNotesForItems(items, "Juliet Rose", {
      generateNoirDescriptions: true,
      fetchPdpNoteBootstrap: false,
    })

    expect(JSON.parse(records[0].openNotes)).toEqual(expect.arrayContaining(["orange", "mandarin"]))
    expect(JSON.parse(records[0].heartNotes)).toEqual(
      expect.arrayContaining(["cardamom", "tonka", "geranium"]),
    )
    expect(JSON.parse(records[0].baseNotes)).toEqual(
      expect.arrayContaining(["amber", "sandalwood", "vanilla", "patchouli"]),
    )
    expect(JSON.parse(records[0].openNotes)).not.toContain("amber")
    expect([...JSON.parse(records[0].openNotes), ...JSON.parse(records[0].heartNotes), ...JSON.parse(records[0].baseNotes)].join(" ")).not.toMatch(
      /squarespace/,
    )
    expect(noirCalls).toBe(1)
    expect(records[0].description).toContain("Orange peel snaps")
  })

  it("pure metaphor with no materials: NOTE_SYSTEM returns empty, name+house fallback runs and provides notes", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    const items: ScrapedItem[] = [
      {
        name: "Shadow Work",
        description:
          "A secret carried in the dark, a promise traced in shadow, the city humming far below the open window.",
        image: "",
        detailURL: "https://example.com/p/shadow-work",
        perfumeHouse: "Witch House",
      },
    ]

    let noteCalls = 0
    let fallbackCalls = 0
    let noirCalls = 0
    invokeMock.mockImplementation(async (messages: unknown) => {
      const msgs = messages as { role: string; content: string }[]
      const sys = msgs.find(m => m.role === "system")?.content ?? ""
      if (sys.includes("film noir")) {
        noirCalls++
        return { content: "Smoke and incense curl across an unlit room." }
      }
      if (sys.includes("fragrance encyclopedia")) {
        fallbackCalls++
        return {
          content: JSON.stringify({
            openNotes: ["lavender"],
            heartNotes: ["myrrh", "smoke"],
            baseNotes: ["patchouli"],
          }),
        }
      }
      if (sys.includes("master perfumer")) {
        noteCalls++
        return {
          content: JSON.stringify({ openNotes: [], heartNotes: [], baseNotes: [] }),
        }
      }
      throw new Error(`Unexpected system prompt: ${sys.slice(0, 80)}`)
    })

    const { records } = await extractNotesForItems(items, "Witch House", { generateNoirDescriptions: true })

    expect(noteCalls).toBeGreaterThanOrEqual(1)
    expect(fallbackCalls).toBe(1)
    expect(noirCalls).toBe(1)
    const open = JSON.parse(records[0].openNotes) as string[]
    const heart = JSON.parse(records[0].heartNotes) as string[]
    const base = JSON.parse(records[0].baseNotes) as string[]
    expect(open).toContain("lavender")
    expect(heart).toEqual(expect.arrayContaining(["myrrh", "smoke"]))
    expect(base).toContain("patchouli")
  })

  it("under-2 notes after full ladder: noir is skipped and the original description is preserved", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    const originalDescription =
      "An evening that refuses to be told, a hush in the corner where the light cannot reach."

    const items: ScrapedItem[] = [
      {
        name: "Untellable",
        description: originalDescription,
        image: "",
        detailURL: "https://example.com/p/untellable",
        perfumeHouse: "Mystery House",
      },
    ]

    let noirCalls = 0
    invokeMock.mockImplementation(async (messages: unknown) => {
      const msgs = messages as { role: string; content: string }[]
      const sys = msgs.find(m => m.role === "system")?.content ?? ""
      if (sys.includes("film noir")) {
        noirCalls++
        return { content: "this should never appear" }
      }
      // NOTE_SYSTEM and FALLBACK_LOOKUP both return empty so total notes stays at 0.
      return { content: JSON.stringify({ openNotes: [], heartNotes: [], baseNotes: [] }) }
    })

    const { records } = await extractNotesForItems(items, "Mystery House", { generateNoirDescriptions: true })

    expect(noirCalls).toBe(0)
    expect(records[0].openNotes).toBe("[]")
    expect(records[0].heartNotes).toBe("[]")
    expect(records[0].baseNotes).toBe("[]")
    expect(records[0].description).toBe(originalDescription)
  })

  it("single note + Wix cross-sell/CSS bleed: junk description cleared and noir still runs", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    const wixJunk =
      'Shea Butter & Aloe Lotion $18.00 click pic to see all 40 scentsSpray Mists $14.00 Vintage Inspired Fragrance #comp-khkuc2ru svg [data-color="1"] {fill: #EEE6C6;}'

    /** Pyramid lines after the Wix blob so inline extraction gets clean chunks; merchant-facing `description` still starts with junk (cleared before CSV). */
    const items: ScrapedItem[] = [
      {
        name: "Amber",
        description: `${wixJunk}\n\nTop: bergamot\nBase: amber`,
        image: "",
        detailURL: "https://www.seventhmuse.net/product-page/amber-roll-on",
        perfumeHouse: "Seventh Muse",
      },
    ]

    let noirCalls = 0
    invokeMock.mockImplementation(async (messages: unknown) => {
      const msgs = messages as { role: string; content: string }[]
      const sys = msgs.find(m => m.role === "system")?.content ?? ""
      if (sys.includes("film noir")) {
        noirCalls++
        return { content: "Neon rain on amber glass; the night remembers what morning forgets." }
      }
      if (sys.includes("rebalance a perfume note list")) {
        return {
          content: JSON.stringify({
            openNotes: ["bergamot"],
            heartNotes: [],
            baseNotes: ["amber"],
          }),
        }
      }
      throw new Error(`Unexpected LLM prompt: ${sys.slice(0, 90)}`)
    })

    const { records } = await extractNotesForItems(items, "Seventh Muse", { generateNoirDescriptions: true })

    expect(noirCalls).toBe(1)
    expect(records[0].description).toContain("Neon rain")
    const open = JSON.parse(records[0].openNotes) as string[]
    const base = JSON.parse(records[0].baseNotes) as string[]
    expect(open).toContain("bergamot")
    expect(base).toContain("amber")
  })

  it("single extracted note + Wix bleed: noir runs when merchant description is unusable", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    const wixJunk =
      'Shea Butter & Aloe Lotion $18.00 click pic to see all 40 scentsSpray Mists $14.00 #comp-abc123 svg [data-color="1"] {fill: #000;}'

    const items: ScrapedItem[] = [
      {
        name: "Musk",
        description: `${wixJunk}\n\nBase: musk`,
        image: "",
        detailURL: "https://www.seventhmuse.net/product-page/musk-roll-on",
        perfumeHouse: "Seventh Muse",
      },
    ]

    let noirCalls = 0
    invokeMock.mockImplementation(async (messages: unknown) => {
      const msgs = messages as { role: string; content: string }[]
      const sys = msgs.find(m => m.role === "system")?.content ?? ""
      if (sys.includes("film noir")) {
        noirCalls++
        return { content: "Smoke and streetlight pool in the hollow of your collarbone." }
      }
      if (sys.includes("rebalance a perfume note list")) {
        return { content: JSON.stringify({ openNotes: [], heartNotes: [], baseNotes: ["musk"] }) }
      }
      throw new Error(`Unexpected LLM prompt: ${sys.slice(0, 90)}`)
    })

    const { records } = await extractNotesForItems(items, "Seventh Muse", { generateNoirDescriptions: true })

    expect(noirCalls).toBe(1)
    expect(records[0].description).toContain("Smoke and streetlight")
    const base = JSON.parse(records[0].baseNotes) as string[]
    expect(base).toContain("musk")
  })

  it("single note + usable merchant prose: noir skipped and description preserved", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    /** Avoid the literal note token in prose so stripNotesFromDescription does not erase it. */
    const merchant =
      "Velvet petals on wet pavement, dusk gathering over the river while the city holds its breath."

    const items: ScrapedItem[] = [
      {
        name: "Solo Rose",
        description: `${merchant}\n\nHeart: rose`,
        image: "",
        detailURL: "https://example.com/p/solo-rose",
        perfumeHouse: "Test House",
      },
    ]

    let noirCalls = 0
    invokeMock.mockImplementation(async (messages: unknown) => {
      const msgs = messages as { role: string; content: string }[]
      const sys = msgs.find(m => m.role === "system")?.content ?? ""
      if (sys.includes("film noir")) {
        noirCalls++
        return { content: "should not appear" }
      }
      if (sys.includes("rebalance a perfume note list")) {
        return { content: JSON.stringify({ openNotes: [], heartNotes: ["rose"], baseNotes: [] }) }
      }
      throw new Error(`Unexpected LLM prompt: ${sys.slice(0, 90)}`)
    })

    const { records } = await extractNotesForItems(items, "Test House", { generateNoirDescriptions: true })

    expect(noirCalls).toBe(0)
    expect(records[0].description).toContain("Velvet petals")
    const heart = JSON.parse(records[0].heartNotes) as string[]
    expect(heart).toContain("rose")
  })

  it("Seventh Muse / Wix style 'sweet/spicy blend of … and a hint of …' extracts merchant notes (no LLM)", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    const items: ScrapedItem[] = [
      {
        name: "Autumn Fairy Roll-On",
        description:
          "Warm, exotic, sweet/spicy blend of Patchouli, Vanilla, Amber and a hint of Clove $16.00 Price",
        image: "",
        detailURL: "https://www.seventhmuse.net/product-page/new-scent-autumn-fairy",
        perfumeHouse: "Seventh Muse",
      },
    ]

    invokeMock.mockImplementation(() => {
      throw new Error("LLM must not run when blend-of line yields a flat list")
    })

    const { records } = await extractNotesForItems(items, "Seventh Muse", {
      generateNoirDescriptions: false,
    })

    expect(invokeMock).not.toHaveBeenCalled()
    const open = JSON.parse(records[0].openNotes) as string[]
    expect(open).toEqual(expect.arrayContaining(["patchouli", "vanilla", "amber", "clove"]))
    expect(records[0].heartNotes).toBe("[]")
    expect(records[0].baseNotes).toBe("[]")
  })

  it("Seventh Muse Spring Fairy ellipsis hook extracts Dew and Honeysuckle (no LLM)", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    const items: ScrapedItem[] = [
      {
        name: "Spring Fairy Perfume Oil",
        description:
          "Dew and Honeysuckle...just what we imagine a fairy garden would smell like $21.00 Price",
        image: "",
        detailURL: "https://www.seventhmuse.net/product-page/spring-fairy-perfume-oil",
        perfumeHouse: "Seventh Muse",
      },
    ]

    invokeMock.mockImplementation(() => {
      throw new Error("LLM must not run when ellipsis hook yields materials")
    })

    const { records } = await extractNotesForItems(items, "Seventh Muse", {
      generateNoirDescriptions: false,
    })

    expect(invokeMock).not.toHaveBeenCalled()
    const open = JSON.parse(records[0].openNotes) as string[]
    expect(open).toEqual(expect.arrayContaining(["dew", "honeysuckle"]))
    expect(records[0].heartNotes).toBe("[]")
    expect(records[0].baseNotes).toBe("[]")
  })

  it("PDP bootstrap extracts Seventh Muse blend-of line when scraped description is empty", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    const html = `<!DOCTYPE html><html><body>
      <h1>Autumn Fairy Roll-On</h1>
      <p>Warm, exotic, sweet/spicy blend of Patchouli, Vanilla, Amber and a hint of Clove</p>
      <p>$16.00 Price</p>
    </body></html>`
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => html,
    })
    vi.stubGlobal("fetch", fetchMock)

    const items: ScrapedItem[] = [
      {
        name: "Autumn Fairy Roll-On",
        description: "",
        image: "",
        detailURL: "https://www.seventhmuse.net/product-page/new-scent-autumn-fairy",
        perfumeHouse: "Seventh Muse",
      },
    ]

    invokeMock.mockImplementation(() => {
      throw new Error("LLM must not run when PDP HTML contains blend-of materials")
    })

    const { records } = await extractNotesForItems(items, "Seventh Muse", {
      generateNoirDescriptions: false,
      fetchPdpNoteBootstrap: true,
    })

    vi.unstubAllGlobals()
    expect(fetchMock).toHaveBeenCalled()
    const open = JSON.parse(records[0].openNotes) as string[]
    expect(open).toEqual(expect.arrayContaining(["patchouli", "vanilla", "amber", "clove"]))
    expect(records[0].heartNotes).toBe("[]")
    expect(records[0].baseNotes).toBe("[]")
  })

  it("Gallagher-style Featured Notes: skips merge LLM and uses merchant flat list in openNotes only", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    const description = [
      "Septamber opens with a bright blend of Apricot, Black Tea, and Tunisian Neroli.",
      "Featured Notes : Apricot, Black Tea, Tunisian Neroli, Turkish Rose, Cabernet, Cognac, Oakwood, Honeyed Amber, Labdanum, Vanilla, Maple, Immortelle, Tobacco, Benzoin, Hay, and Leather.",
      "Concentration: Eau de Parfum",
    ].join(" ")

    const items: ScrapedItem[] = [
      {
        name: "Septamber - Apricot, Black Tea, Oakwood, Maple, Honeyed Amber",
        description,
        image: "",
        detailURL: "https://gallagherfragrances.com/products/septamber",
        perfumeHouse: "Gallagher Fragrances",
      },
    ]

    invokeMock.mockImplementation(() => {
      throw new Error("merge / extract LLM must not run when Featured Notes list is authoritative")
    })

    const { records } = await extractNotesForItems(items, "Gallagher Fragrances", {
      generateNoirDescriptions: false,
      titleDashSegment: "before",
    })

    expect(invokeMock).not.toHaveBeenCalled()
    expect(records[0].name).toBe("Septamber")
    const open = JSON.parse(records[0].openNotes) as string[]
    expect(open.length).toBeGreaterThanOrEqual(12)
    expect(open).toContain("apricot")
    expect(open).toContain("tunisian neroli")
    expect(open).toContain("leather")
    expect(records[0].heartNotes).toBe("[]")
    expect(records[0].baseNotes).toBe("[]")
  })

  it("titleDashSegment before splits on en dash and em dash in product name (no LLM)", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    const items: ScrapedItem[] = [
      {
        name: "Velvet Vanilla – 50ml",
        description: "x",
        notesText: NOTES_TEXT_NO_LLM,
        image: "",
        detailURL: "https://example.com/p/en",
        perfumeHouse: "H",
      },
      {
        name: "Night Rose — limited",
        description: "x",
        notesText: NOTES_TEXT_NO_LLM,
        image: "",
        detailURL: "https://example.com/p/em",
        perfumeHouse: "H",
      },
    ]

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run")
    })

    const { records } = await extractNotesForItems(items, "H", {
      generateNoirDescriptions: false,
      titleDashSegment: "before",
    })

    expect(invokeMock).not.toHaveBeenCalled()
    expect(records.map(r => r.name)).toEqual(["Velvet Vanilla", "Night Rose"])
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

    const { records } = await extractNotesForItems(items, "House", { generateNoirDescriptions: true })

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

    const { records } = await extractNotesForItems(items, "H", { generateNoirDescriptions: true })

    expect(records.map(r => r.name)).toEqual(["One", "Two"])
    expect(noirCall).toBe(2)
    expect(records[0].description).toBe("N1")
    expect(records[1].description).toBe("N2")
  })

  it("finds 'Scent notes include …' when it lives in notesText but description is noir-only (no LLM)", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    const noirOnly =
      "Beneath the wooden beams of a forgotten attic, dark red roses entwine with black pepper, while warm sandalwood and patchouli evoke a clandestine rendezvous. Soft musk and rich amber wrap around you."

    const items: ScrapedItem[] = [
      {
        name: "Attic Bedroom",
        description: noirOnly,
        notesText:
          "Scent notes include dark red roses, labdanum, black pepper, light patchouli, plum, vanilla, benzoin, and golden amber.",
        image: "",
        detailURL: "https://www.littleandgrim.com/products/attic-bedroom-perfume-oil",
        perfumeHouse: "Little And Grim",
      },
    ]

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when notesText carries the authoritative list")
    })

    const { records } = await extractNotesForItems(items, "Little And Grim", { generateNoirDescriptions: false })

    expect(invokeMock).not.toHaveBeenCalled()
    expect(records).toHaveLength(1)
    const open = JSON.parse(records[0].openNotes) as string[]
    expect(open).toEqual(
      expect.arrayContaining([
        "dark red roses",
        "labdanum",
        "black pepper",
        "light patchouli",
        "plum",
        "vanilla",
        "benzoin",
        "golden amber",
      ]),
    )
    expect(open.length).toBe(8)
    expect(records[0].heartNotes).toBe("[]")
    expect(records[0].baseNotes).toBe("[]")
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

    const { records } = await extractNotesForItems(items, "Little And Grim", { generateNoirDescriptions: false })

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

    const { records } = await extractNotesForItems(items, "House", { generateNoirDescriptions: false })

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

    const { records } = await extractNotesForItems(items, "House", { generateNoirDescriptions: false })

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

  it("drops solvent, CSS, and prose junk from merge LLM output while keeping structured pyramid notes", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    // >100 chars for merge LLM; exactly 3 layers with 4 parsed notes so skipStructuredLlmMerge is false
    // (if total >= 5 with 3 layers, merge is skipped).
    const notesText = `Top: bergamot peel oil infusion, pink peppercorn extract
Heart: jasmine sambac grandiflorum
Base: white musk`

    const items: ScrapedItem[] = [
      {
        name: "Room Spray PDP",
        description: "",
        notesText,
        image: "",
        detailURL: "https://example.com/p/spray",
        perfumeHouse: "The Marvelous Candle Studio",
      },
    ]

    invokeMock.mockImplementation(async (messages: unknown) => {
      const msgs = messages as { role: string; content: string }[]
      const sys = msgs.find(m => m.role === "system")?.content ?? ""
      if (sys.includes("rebalance a perfume note list")) {
        return {
          content: JSON.stringify({
            openNotes: [],
            heartNotes: [],
            baseNotes: [
              "vegan augeo",
              "1rem",
              "made from renewable resources",
              "clothing",
              "which is colourless",
              "cedar",
            ],
          }),
        }
      }
      throw new Error(`Unexpected LLM call: ${sys.slice(0, 80)}`)
    })

    const { records } = await extractNotesForItems(items, "House", { generateNoirDescriptions: false })

    expect(records).toHaveLength(1)
    const base = JSON.parse(records[0].baseNotes) as string[]
    expect(base).toEqual(expect.arrayContaining(["white musk"]))
    expect(base).not.toEqual(
      expect.arrayContaining(["vegan augeo", "1rem", "clothing", "made from renewable resources"]),
    )
  })

  it("strips prose wrappers like 'hints of' and 'enhanced by' from structured notes", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    const items: ScrapedItem[] = [
      {
        name: "Wrapper phrases",
        description: "",
        notesText:
          "Top: hints of bergamot Heart: jasmine Base: enhanced by sandalwood, creating a rich amber trail",
        image: "",
        detailURL: "https://example.com/p/wrappers",
        perfumeHouse: "House",
      },
    ]

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run for this structured parse test")
    })

    const { records } = await extractNotesForItems(items, "House", { generateNoirDescriptions: false })
    expect(invokeMock).not.toHaveBeenCalled()
    expect(records).toHaveLength(1)

    const open = JSON.parse(records[0].openNotes) as string[]
    const base = JSON.parse(records[0].baseNotes) as string[]

    expect(open).toContain("bergamot")
    expect(base).toContain("sandalwood")
    expect(base).not.toEqual(expect.arrayContaining(["enhanced by sandalwood", "creating a rich"]))
  })

  it("Featured Notes list with 'Sweet Orange' is preserved end-to-end (no mid-list truncation)", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    const description =
      "Featured Notes: Aldehydes, Bergamot, Egyptian Bitter Red Orange, Italian Blood Orange, Sweet Orange, Italian Clementine, Tunisian Neroli, Oman Frankincense, Powdered Chocolate, Labdanum Resin from Spain, Honeyed Amber, Brazilian Tonka Bean Absolute, Cream Soda, Benzoin, Australian Sandalwood, Tonkin Musk*, and 8-year Aged Indonesian Patchouli."

    const items: ScrapedItem[] = [
      {
        name: "Behold, Patchouli",
        description,
        image: "",
        detailURL: "https://example.com/p/behold-patchouli",
        perfumeHouse: "Gallagher Fragrances",
      },
    ]

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when Featured Notes list is authoritative")
    })

    const { records } = await extractNotesForItems(items, "Gallagher Fragrances", { generateNoirDescriptions: false })

    expect(invokeMock).not.toHaveBeenCalled()
    const open = JSON.parse(records[0].openNotes) as string[]
    expect(open).toContain("aldehydes")
    expect(open).toContain("bergamot")
    expect(open).toContain("sweet orange")
    expect(open).toContain("tunisian neroli")
    expect(open).toContain("powdered chocolate")
    expect(open).toContain("brazilian tonka bean absolute")
    expect(open).toContain("australian sandalwood")
    expect(open).toContain("tonkin musk")
    expect(open).toContain("8-year aged indonesian patchouli")
    expect(open.length).toBeGreaterThanOrEqual(15)
    expect(open).not.toEqual(expect.arrayContaining(["tonkin musk*"]))
  })

  it("noir-prose-only description with mixed cliché extraction: PDP rescue replaces with full Featured Notes", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    /**
     * Simulates the Baklava/Glowberry bug: the saved description is noir prose that mentions exactly
     * the four-note "noir cliché" set, the merge LLM emits 4 cliché notes plus one extra real note,
     * and the strict `every() ∈ cliché` rescue trigger would have skipped this. The broadened
     * `shouldAttemptPdpRescue` heuristic must still fire because 4/5 are cliché in a list of ≤6.
     */
    const noirDescription =
      "A lone figure leans against the warm brick of a hidden café, the sweet scent of brown sugar and golden honey wrapping around them like a lover's embrace. As the night deepens, the sultry notes of ripe plum and blooming rose weave a tale of temptation."

    const fetchMock = vi.fn().mockImplementation(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        `<html><body><p>Featured Notes: Sweet Orange, Bergamot, Cherry, Almond, Pistachio, Neroli, Baklava, Honey, Vanilla, Patchouli, and Musk.</p><p>Concentration: Extrait de Parfum</p></body></html>`,
    }))
    vi.stubGlobal("fetch", fetchMock)

    invokeMock.mockImplementation(async (messages: unknown) => {
      const msgs = messages as { role: string; content: string }[]
      const sys = msgs.find(m => m.role === "system")?.content ?? ""
      if (sys.includes("master perfumer")) {
        return {
          content: JSON.stringify({
            openNotes: ["plum"],
            heartNotes: ["rose", "brown sugar"],
            baseNotes: ["golden honey", "vanilla"],
          }),
        }
      }
      throw new Error(`Unexpected LLM call: ${sys.slice(0, 80)}`)
    })

    const items: ScrapedItem[] = [
      {
        name: "Baklava",
        description: noirDescription,
        image: "",
        detailURL: "https://gallagherfragrances.com/products/baklava",
        perfumeHouse: "Gallagher Fragrances",
      },
    ]

    const { records } = await extractNotesForItems(items, "Gallagher Fragrances", {
      generateNoirDescriptions: false,
      fetchPdpNoteBootstrap: true,
    })

    expect(records).toHaveLength(1)
    const open = JSON.parse(records[0].openNotes) as string[]
    const heart = JSON.parse(records[0].heartNotes) as string[]
    const base = JSON.parse(records[0].baseNotes) as string[]
    const all = [...open, ...heart, ...base]
    expect(all).toEqual(
      expect.arrayContaining(["sweet orange", "bergamot", "cherry", "almond", "pistachio", "neroli"]),
    )
    expect(all.length).toBeGreaterThanOrEqual(10)
    expect(fetchMock).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it("PDP fetch with transient 500 then 200 still rescues the merchant note list", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    let pdpCallCount = 0
    const fetchMock = vi.fn().mockImplementation(async () => {
      pdpCallCount++
      if (pdpCallCount === 1) {
        return { ok: false, status: 500, text: async () => "" }
      }
      return {
        ok: true,
        status: 200,
        text: async () =>
          `<html><body><p>Featured Notes: Mandarin, Apricot, Raspberry, Strawberry Tart, Blackcurrant, Magnolia, Sandalwood, Vanilla, Patchouli, and Musk.</p></body></html>`,
      }
    })
    vi.stubGlobal("fetch", fetchMock)

    /** No description so the only path to notes is the PDP fetch — exercises the retry path. */
    const items: ScrapedItem[] = [
      {
        name: "Glowberry",
        description: "",
        image: "",
        detailURL: "https://gallagherfragrances.com/products/glowberry",
        perfumeHouse: "Gallagher Fragrances",
      },
    ]

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when PDP rescue retry succeeds")
    })

    const { records } = await extractNotesForItems(items, "Gallagher Fragrances", {
      generateNoirDescriptions: false,
      fetchPdpNoteBootstrap: true,
    })

    expect(records).toHaveLength(1)
    expect(pdpCallCount).toBeGreaterThanOrEqual(2)
    const open = JSON.parse(records[0].openNotes) as string[]
    expect(open).toEqual(
      expect.arrayContaining(["mandarin", "apricot", "raspberry", "strawberry tart", "magnolia"]),
    )
    expect(open.length).toBeGreaterThanOrEqual(8)
    vi.unstubAllGlobals()
  })

  it("Wix-style 'Dew and Honeysuckle…just what we imagine' prose: extracts clean ['dew', 'honeysuckle'] without 'Price' / duplicate-region leakage", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    /**
     * Reproduces the Seventh Muse "Spring Fairy" failure mode: Wix renders the price label inline
     * just before the description, the stripped plain text becomes "$21.00 Price Dew and
     * Honeysuckle…just what we imagine…", the ellipsisHook regex starts matching at the [A-Z] in
     * "Price", and the bootstrap-merge then duplicates the same prose region — producing notes
     * like ["price dew", "honeysuckle dew", "honeysuckle"]. After the fix the e-commerce label
     * prefix is stripped and the bootstrap is not double-merged when it's already in the source,
     * so the only notes that survive are the two real materials.
     */
    const wixHtml = `<html><head>
      <meta property="og:description" content="Dew and Honeysuckle...just what we imagine a fairy garden would smell like" />
      </head><body>
      <h1>Spring Fairy Perfume Oil</h1>
      <span>$21.00</span><span>Price</span>
      <p>Dew and Honeysuckle...just what we imagine a fairy garden would smell like</p>
      <button>Quantity</button><button>Add to Cart</button>
      </body></html>`
    const fetchMock = vi.fn().mockImplementation(async () => ({
      ok: true,
      status: 200,
      text: async () => wixHtml,
    }))
    vi.stubGlobal("fetch", fetchMock)

    const items: ScrapedItem[] = [
      {
        name: "Spring Fairy",
        description: "Dew and Honeysuckle...just what we imagine a fairy garden would smell like",
        image: "",
        detailURL: "https://www.seventhmuse.net/product-page/spring-fairy-perfume-oil",
        perfumeHouse: "Seventh Muse",
      },
    ]

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when 'Dew and Honeysuckle' parses cleanly from prose")
    })

    const { records } = await extractNotesForItems(items, "Seventh Muse", {
      generateNoirDescriptions: false,
      fetchPdpNoteBootstrap: true,
    })

    expect(records).toHaveLength(1)
    const all = [
      ...JSON.parse(records[0].openNotes),
      ...JSON.parse(records[0].heartNotes),
      ...JSON.parse(records[0].baseNotes),
    ] as string[]
    expect(all).toEqual(expect.arrayContaining(["dew", "honeysuckle"]))
    expect(all).not.toEqual(expect.arrayContaining(["price dew"]))
    expect(all).not.toEqual(expect.arrayContaining(["honeysuckle dew"]))
    expect(all).not.toEqual(expect.arrayContaining(["price"]))
    expect(all.length).toBe(2)
    vi.unstubAllGlobals()
  })

  it("Wix-style 'blend of …' prose followed by 'Quantity' button: keeps 'Persian Lime' clean (no 'persian lime quantity')", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    /**
     * Reproduces the Seventh Muse "Summer Fairy" failure mode: the Wix layout puts the
     * Quantity / Add to Cart buttons immediately after the description prose, so the
     * stripped plain text becomes "...blend of Magnolia Flowers, Apple Blossom and Persian
     * Lime Quantity * Add to Cart Details 1/2 ounce…". Before the fix the blendPhrase regex
     * consumed past "Persian Lime" into "Quantity" and emitted a fake "persian lime quantity"
     * note. After the fix the regex stops at the e-commerce label boundary AND `splitNoteList`
     * strips any residual UI label tail.
     */
    const items: ScrapedItem[] = [
      {
        name: "Summer Fairy",
        description:
          "Soft, youthful, lovely blend of Magnolia Flowers, Apple Blossom and Persian Lime Quantity * Add to Cart Details 1/2 ounce oil",
        image: "",
        detailURL: "https://example.com/p/summer-fairy",
        perfumeHouse: "Seventh Muse",
      },
    ]

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when blend phrase parses cleanly")
    })

    const { records } = await extractNotesForItems(items, "Seventh Muse", {
      generateNoirDescriptions: false,
    })

    expect(records).toHaveLength(1)
    const all = [
      ...JSON.parse(records[0].openNotes),
      ...JSON.parse(records[0].heartNotes),
      ...JSON.parse(records[0].baseNotes),
    ] as string[]
    expect(all).toEqual(expect.arrayContaining(["magnolia flowers", "apple blossom", "persian lime"]))
    expect(all).not.toEqual(expect.arrayContaining(["persian lime quantity"]))
    expect(all).not.toEqual(expect.arrayContaining(["quantity"]))
    expect(all).not.toEqual(expect.arrayContaining(["add to cart"]))
    expect(all.length).toBe(3)
  })

  it("Featured Notes ending with marketing copy: drops 'experiment for yourself' tail", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    const description =
      "Featured Notes: tulip, white amber musk, blackcurrant, jasmine, lavender, mandarin, orange blossom, sandalwood, tobacco, experiment for yourself"

    const items: ScrapedItem[] = [
      {
        name: "Tulip Silk",
        description,
        image: "",
        detailURL: "https://example.com/p/tulip-silk",
        perfumeHouse: "Gallagher Fragrances",
      },
    ]

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run for this flat-list test")
    })

    const { records } = await extractNotesForItems(items, "Gallagher Fragrances", { generateNoirDescriptions: false })

    expect(invokeMock).not.toHaveBeenCalled()
    const open = JSON.parse(records[0].openNotes) as string[]
    expect(open).toContain("tulip")
    expect(open).toContain("white amber musk")
    expect(open).toContain("tobacco")
    expect(open).not.toEqual(expect.arrayContaining(["experiment for yourself"]))
    expect(open).not.toEqual(expect.arrayContaining(["for yourself"]))
  })

  it("strict mode with blank PDP yields empty notes and empty _noteSource", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    invokeMock.mockImplementation(() => ({
      content: '{"openNotes":[],"heartNotes":[],"baseNotes":[]}',
    }))
    const items: ScrapedItem[] = [
      {
        name: "Xyzzynoingredients987",
        description: "",
        image: "",
        detailURL: "",
        perfumeHouse: "House",
      },
    ]
    const { records } = await extractNotesForItems(items, "House", {
      generateNoirDescriptions: false,
      fetchPdpNoteBootstrap: false,
      noteInferenceMode: "strict",
    })
    expect(records[0].openNotes).toBe("[]")
    expect(records[0]._noteSource).toBe("empty")
  })

  it("canonicalizeNote maps vetivert and vanille", () => {
    expect(canonicalizeNote("vetivert")).toBe("vetiver")
    expect(canonicalizeNote("vanille")).toBe("vanilla")
  })

  it("computeBatchNoteUniformityWarnings flags when >=30% share same 3+ notes", () => {
    const same = {
      openNotes: ["plum", "rose", "honey"],
      heartNotes: [] as string[],
      baseNotes: [] as string[],
    }
    const layers = Array.from({ length: 10 }, () => ({ ...same }))
    const w = computeBatchNoteUniformityWarnings(layers)
    expect(w.length).toBe(1)
    expect(w[0]).toMatch(/10\/10/)
  })

  it("bulk LLM validator drops non-material strings and rewrites prose-adjective phrases", async () => {
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "llm")
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    /**
     * Four invocations expected (in order):
     *   1. extractNotesFromDescription for the first product (description path)
     *   2. extractNotesFromDescription for the second product (name-only path — description is
     *      policy-only at 64 chars). Returns junk notes that all get filtered by isScraperKeptNote
     *      and looksLikeProseNotePhrase, leaving 0 notes.
     *   3. extractNotesFallbackLookup for the second product (triggered because it has 0 notes
     *      after filtering and inferenceMode is "standard"). Returns empty.
     *   4. validateNotesWithLlm (bulk) — runs over product 1's surviving notes only:
     *      - "bergamot" → "bergamot" (kept)
     *      - "delicate apple blossom" → "apple blossom" (prose stripped)
     *      - "creamy vanilla" → "creamy vanilla" (olfactory adjective kept)
     *      - "sandalwood" → "sandalwood" (kept)
     *      - "a sweet" → omitted (pure prose — already dropped before validator)
     *      - "glowing amber warmth" → omitted (no material core — already dropped before validator)
     */
    const responses = [
      '{"openNotes":["bergamot","a sweet","delicate apple blossom"],"heartNotes":["creamy vanilla"],"baseNotes":["sandalwood","glowing amber warmth"]}',
      '{"openNotes":["a sweet"],"heartNotes":[],"baseNotes":["glowing amber warmth"]}',
      '{"openNotes":[],"heartNotes":[],"baseNotes":[]}',
      '{"valid":[{"in":"bergamot","out":"bergamot"},{"in":"delicate apple blossom","out":"apple blossom"},{"in":"creamy vanilla","out":"creamy vanilla"},{"in":"sandalwood","out":"sandalwood"}]}',
    ]
    let i = 0
    invokeMock.mockImplementation(() => ({ content: responses[i++] ?? '{"valid":[]}' }))

    const items: ScrapedItem[] = [
      {
        name: "Real Notes Product",
        description: "Some product copy that lacks a labeled note list but mentions bergamot and rose.",
        image: "",
        detailURL: "",
        perfumeHouse: "House",
      },
      {
        name: "All Junk Product",
        description: "Marketing prose without any actual scent materials worth keeping.",
        image: "",
        detailURL: "",
        perfumeHouse: "House",
      },
    ]
    const { records } = await extractNotesForItems(items, "House", {
      generateNoirDescriptions: false,
      fetchPdpNoteBootstrap: false,
    })

    const r0Open = JSON.parse(records[0].openNotes) as string[]
    const r0Heart = JSON.parse(records[0].heartNotes) as string[]
    const r0Base = JSON.parse(records[0].baseNotes) as string[]
    // Prose stripped from "delicate apple blossom" → "apple blossom"
    expect(r0Open).toContain("bergamot")
    expect(r0Open).toContain("apple blossom")
    expect(r0Open).not.toContain("delicate apple blossom")
    expect(r0Open).not.toContain("a sweet")
    // Olfactory adjective ("creamy") preserved
    expect(r0Heart).toContain("creamy vanilla")
    expect(r0Base).toEqual(["sandalwood"])
    expect(r0Base).not.toContain("glowing amber warmth")
    expect(records[0]._noteSource).not.toBe("empty")

    // Product with only prose-junk notes is fully emptied + _noteSource flipped
    const r1All = [
      ...(JSON.parse(records[1].openNotes) as string[]),
      ...(JSON.parse(records[1].heartNotes) as string[]),
      ...(JSON.parse(records[1].baseNotes) as string[]),
    ]
    expect(r1All).toEqual([])
    expect(records[1]._noteSource).toBe("empty")
  })

  it("policy-only merchant description gets wiped so noir gen kicks in when notes exist", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    /**
     * Mirrors the Andromedas Moon "Love Don't Be Shy" PDP — every sentence is operational /
     * legal boilerplate (size options, processing time, trademarks, sugarcane alcohol ingredient
     * disclosure). With notes empty, noir is skipped; with notes present, descriptionForRecord
     * must be wiped so noir replaces it.
     */
    invokeMock.mockImplementation(() => ({
      content: '{"openNotes":["vanilla","tonka bean"],"heartNotes":["jasmine"],"baseNotes":["musk"]}',
    }))
    const policyDesc = `Inspired by Love, Dont Be Shy EDP. ORIGINAL MANUFACTURERS PICTURES OF BOTTLE IS FOR REFERENCE ONLY- ALL PRODUCTS SENT WILL USE OUR COMPANIES BOTTLES AND FORMULA. Size options- 5ml glass spray bottle (EDP) Sample Size 15ml glass perfume bottle (EDP) Travel Size 30ml glass perfume bottle (EDP) 1 oz 60ml glass perfume bottle (EDP) 2 oz 100ml glass perfume bottle (EDP) 3.4 oz. As with any fragrance, as it matures you will get a stronger scent. Name trademarks and copyrights are properties of their respective manufacturers and/or designers. Andromedas Moon has no affiliation with the manufacturers / designers. Ingredients: Sugarcane Alcohol (Ethyl Alcohol) Carcinogen & Phthalate-Free Fragrance.`
    const items: ScrapedItem[] = [
      {
        name: "Love Dont Be Shy",
        description: policyDesc,
        image: "",
        detailURL: "",
        perfumeHouse: "Andromedas Moon",
      },
    ]
    const { records } = await extractNotesForItems(items, "Andromedas Moon", {
      generateNoirDescriptions: false,
      fetchPdpNoteBootstrap: false,
      noteInferenceMode: "strict",
    })
    // Description must NOT contain any of the policy phrases.
    const d = records[0].description
    expect(d).not.toMatch(/ORIGINAL MANUFACTURERS/i)
    expect(d).not.toMatch(/no\s+changes/i)
    expect(d).not.toMatch(/sugarcane\s+alcohol/i)
    expect(d).not.toMatch(/trademarks/i)
    // With noir disabled and policy-only original, description is wiped to "".
    expect(d).toBe("")
  })

  it("Andromedas Moon Silky Woods Elixir: policy-only PDP must not emit ingredients/compliance as notes", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    const silkyDesc = `Inspired by Silky Woods Elixir EDP
 ORIGINAL MANUFACTURERS PICTURES OF BOTTLE IS FOR REFERENCE ONLY- ALL PRODUCTS SENT WILL USE OUR COMPANIES BOTTLES AND FORMULA
 Size options-
5ml glass spray bottle (EDP)
15ml glass perfume bottle (EDP)
30ml glass perfume bottle (EDP)
60ml glass perfume bottle (EDP)
100ml glass perfume bottle (EDP)

As with any fragrance, as it matures you will get a stronger scent. However, your fragrance has been pre macerated as well!

Please note: These fragrances are all poured by hand and slight differences can be seen bottle to bottle example: more perfume oil to perfumers diluent.
I also do not use the same chemicals as what most marketed fragrances use. It is a bi- phase fragrance that does require shaking before use to make sure the oil to diluent is mixed properly.


We specialize in making and using uncut, organic and sustainably sourced perfume oil to make your Eau De Parfum. We do not sell straight perfume oil at this time. Our list of available fragrances continues to grow as well as the types of products we offer. We have never compromised our quality and never will. You may find that other companies may offer lower prices, but they cannot match or provide the quality we offer. We encourage you to do your own research and make your own decision. We will always honor our commitment in offering the highest quality fragrances. Thank you for giving us your time and becoming part of Andromeda's Moon!

Name trademarks and copyrights are properties of their respective manufacturers and/or designers. Andromeda's Moon has no affiliation with the manufacturers / designers. Our interpretation of these fragrances was created through chemical analysis and reproduction, and the purpose of this description and original manufactures picture of fragrance is to give the customer an idea of scent character, not to mislead or confuse the customer. It is not intended to infringe on the manufacturers / designer's name and valuable trademark.

We are not responsible for lost or stolen packages, nor items damaged upon delivery. We are not responsible for customs fees. Please read our Policy page for more info or contact us with any questions.

Ingredients:
•Organic Sugarcane Alcohol (Ethyl
Alcohol) Carcinogen & Phthalate-Free
Fragrance
Organic Sugarcane Alcohol Benefits
•Environmentally Friendly | Grown
Organically |
• Non-GMO | Sourced Sustainably & Ethically | No Pesticides, Fertilizers`
    invokeMock.mockImplementation(() => ({
      content: JSON.stringify({
        openNotes: [],
        heartNotes: [
          "using uncut",
          "organic",
          "reproduction",
          "designers name",
          "grown organically",
          "non-gmo",
          "sourced sustainably",
          "ethically",
          "no pesticides",
          "fertilizers",
        ],
        baseNotes: [],
      }),
    }))
    const items: ScrapedItem[] = [
      {
        name: "Silky Woods Elixir",
        description: silkyDesc,
        image: "",
        detailURL:
          "https://www.andromedasmoon.com/products/andromeda-s-inspired-by-silky-woods-elixir-eau-de-parfum-goldfield-banks",
        perfumeHouse: "Andromeda's Moon",
      },
    ]
    const { records } = await extractNotesForItems(items, "Andromeda's Moon", {
      generateNoirDescriptions: false,
      fetchPdpNoteBootstrap: false,
      noteInferenceMode: "strict",
    })
    const all = [
      ...(JSON.parse(records[0].openNotes) as string[]),
      ...(JSON.parse(records[0].heartNotes) as string[]),
      ...(JSON.parse(records[0].baseNotes) as string[]),
    ]
    expect(all).toEqual([])
    expect(records[0]._noteSource).toBe("empty")
  })

  it("detailUrlAlignsWithProductName rejects sampler URLs and accepts matching fragrance slugs", () => {
    expect(
      detailUrlAlignsWithProductName(
        "Vanille Diabolique Renoir",
        "https://www.andromedasmoon.com/products/fragrance-sampler-set-with-15-coupon",
      ),
    ).toBe(false)
    expect(
      detailUrlAlignsWithProductName(
        "Vanille Diabolique Renoir",
        "https://www.andromedasmoon.com/products/andromeda-s-inspired-by-vanille-diabolique-eau-de-parfum-gucci",
      ),
    ).toBe(true)
    expect(
      detailUrlAlignsWithProductName(
        "Vanilla Amber Patchouli",
        "https://www.julietrose.online/store-AbxoL/p/template-t22ln-stxwc-kxg36-hjby8",
      ),
    ).toBe(true)
    expect(
      detailUrlAlignsWithProductName(
        "Single Note Vanilla",
        "https://www.julietrose.online/store-AbxoL/p/single-note-vanilla",
      ),
    ).toBe(true)
  })

  it("Andromedas Moon Vanille Diabolique: parses Top notes are / middle notes are pyramid", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    invokeMock.mockImplementation(() => {
      throw new Error("LLM must not run when merchant pyramid is present")
    })
    const vanilleDesc =
      "Inspired by Vanille Diabolique EDP Renoir Parfums Top notes are Coca-Cola, Orange and Pink Pepper; middle notes are Rum, Dark Chocolate, Cinnamon and Cardamom; base notes are Bourbon Vanilla, Sandalwood and Amber. ORIGINAL MANUFACTURERS PICTURES OF BOTTLE IS FOR REFERENCE ONLY"
    const items: ScrapedItem[] = [
      {
        name: "Vanille Diabolique Renoir",
        description: vanilleDesc,
        image: "",
        detailURL:
          "https://www.andromedasmoon.com/products/andromeda-s-inspired-by-vanille-diabolique-eau-de-parfum-gucci",
        perfumeHouse: "Andromeda's Moon",
      },
    ]
    const { records } = await extractNotesForItems(items, "Andromeda's Moon", {
      generateNoirDescriptions: false,
      fetchPdpNoteBootstrap: false,
      noteInferenceMode: "strict",
    })
    const open = JSON.parse(records[0].openNotes) as string[]
    const heart = JSON.parse(records[0].heartNotes) as string[]
    const base = JSON.parse(records[0].baseNotes) as string[]
    expect(open).toEqual(expect.arrayContaining(["coca-cola", "orange", "pink pepper"]))
    expect(heart).toEqual(
      expect.arrayContaining(["rum", "dark chocolate", "cinnamon", "cardamom"]),
    )
    expect(base).toEqual(expect.arrayContaining(["bourbon vanilla", "sandalwood", "amber"]))
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it("Andromedas Moon Maui Kayali: strips encoded &lt;head&gt; HTML bleed from base notes", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    invokeMock.mockImplementation(() => {
      throw new Error("LLM must not run when merchant pyramid is present")
    })
    const mauiDesc =
      "Inspired by Maui in a Bottle Sweet Banana EDP Kayali Floral Fruity Fragrance Top notes are Banana and Pear; middle notes are Coconut and Jasmine; base notes are Vanilla and Sandalwood &lt;head&gt;&lt;meta charset=\"UTF-8\" /&gt;&lt;/head&gt; Please note: These fragrances are all poured by hand and slight differences can be seen bottle to bottle."
    const items: ScrapedItem[] = [
      {
        name: "Maui In A Bottle Sweet Banana Kayali",
        description: mauiDesc,
        image: "",
        detailURL:
          "https://www.andromedasmoon.com/products/andromeda-s-inspired-by-maui-in-a-bottle-eau-de-parfum-kayali",
        perfumeHouse: "Andromeda's Moon",
      },
    ]
    const { records } = await extractNotesForItems(items, "Andromeda's Moon", {
      generateNoirDescriptions: false,
      fetchPdpNoteBootstrap: false,
      noteInferenceMode: "strict",
    })
    const open = JSON.parse(records[0].openNotes) as string[]
    const heart = JSON.parse(records[0].heartNotes) as string[]
    const base = JSON.parse(records[0].baseNotes) as string[]
    expect(open).toEqual(expect.arrayContaining(["banana", "pear"]))
    expect(heart).toEqual(expect.arrayContaining(["coconut", "jasmine"]))
    expect(base).toEqual(expect.arrayContaining(["vanilla", "sandalwood"]))
    expect(base).not.toEqual(expect.arrayContaining(["/head", "head", "charset"]))
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it("Andromedas Moon MallowBerry Brulee: strips Description section header from Soft Musk note", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    invokeMock.mockImplementation(() => {
      throw new Error("LLM must not run when merchant pyramid is present")
    })
    const mallowDesc =
      "MallowBerry Brulee A dreamy dessert fantasy where silky vanilla custard meets caramelized sugar and glossy strawberry glaze. Fragrance Notes Top: Strawberry Glaze, Caramelized Sugar Middle: Creme Brulee Custard, Marshmallow, Madagascar Vanilla Bean Base: White Vanilla, Tonka Bean, Soft Musk Description This fragrance leans sweet, creamy, and dessert-forward with a smooth, airy vanilla finish. Processing: AT LEAST 7 business days"
    const items: ScrapedItem[] = [
      {
        name: "Mallowberry Brulee",
        description: mallowDesc,
        image: "",
        detailURL:
          "https://www.andromedasmoon.com/products/andromeda-s-mallowberry-brulee-eau-de-parfum-original-fragrance",
        perfumeHouse: "Andromeda's Moon",
      },
    ]
    const { records } = await extractNotesForItems(items, "Andromeda's Moon", {
      generateNoirDescriptions: false,
      fetchPdpNoteBootstrap: false,
      noteInferenceMode: "strict",
    })
    const open = JSON.parse(records[0].openNotes) as string[]
    const heart = JSON.parse(records[0].heartNotes) as string[]
    const base = JSON.parse(records[0].baseNotes) as string[]
    const all = [...open, ...heart, ...base]
    expect(open).toEqual(expect.arrayContaining(["strawberry glaze", "caramelized sugar"]))
    expect(heart).toEqual(
      expect.arrayContaining(["creme brulee custard", "marshmallow", "madagascar vanilla bean"]),
    )
    expect(base).toEqual(expect.arrayContaining(["white vanilla", "tonka bean", "soft musk"]))
    expect(all.some(n => /\bdescription\b/i.test(n))).toBe(false)
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it("Andromedas Moon Vanille Diabolique: wipes sampler-set scrape bleed and resolves notes from PDP URL", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    const samplerBleed =
      "Get a four piece, glass, 5ml fragrance sampler set.Now arriving in a vegan faux suede bag. PLEASE PICK 6-8 CHOICES IN CASE SOME ARE OUT OF STOCK."
    invokeMock.mockImplementation(() => {
      throw new Error("LLM must not run when merchant pyramid is present")
    })
    const items: ScrapedItem[] = [
      {
        name: "Vanille Diabolique Renoir",
        description: samplerBleed,
        image: "",
        detailURL:
          "https://www.andromedasmoon.com/products/fragrance-sampler-set-with-15-coupon?utm_source=show-recent-order",
        perfumeHouse: "Andromeda's Moon",
      },
    ]
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        const u = String(url)
        if (/andromedasmoon\.com\/search/i.test(u)) {
          return {
            ok: true,
            text: async () =>
              '<a href="/products/inspired-by-vanille-diabolique-renoir">Vanille Diabolique</a>',
          }
        }
        if (/vanille-diabolique/i.test(u)) {
          return {
            ok: true,
            text: async () =>
              "<h3>Top notes</h3><p>Coca-Cola, Rum, Cherry, Orange Blossom</p>" +
              "<h3>Heart notes</h3><p>Bourbon Vanilla, Caramel, Milk</p>" +
              "<h3>Base notes</h3><p>Benzoin, Sandalwood</p>",
          }
        }
        return { ok: false, status: 404, text: async () => "" }
      }),
    )
    const { records } = await extractNotesForItems(items, "Andromeda's Moon", {
      generateNoirDescriptions: false,
      fetchPdpNoteBootstrap: false,
      noteInferenceMode: "strict",
    })
    expect(records[0].description).toBe("")
    expect(records[0].detailURL).toMatch(/vanille-diabolique/i)
    const all = [
      ...(JSON.parse(records[0].openNotes) as string[]),
      ...(JSON.parse(records[0].heartNotes) as string[]),
      ...(JSON.parse(records[0].baseNotes) as string[]),
    ]
    expect(all.length).toBeGreaterThanOrEqual(6)
    expect(all).toEqual(expect.arrayContaining(["coca-cola", "rum", "bourbon vanilla"]))
  }, 30_000)

  it("Ellis Brooklyn Vanilla Milk: extracts Top/Mid/Dry dt/dd pyramid from PDP HTML", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    invokeMock.mockImplementation(() => {
      throw new Error("LLM must not run when dt/dd pyramid is present")
    })
    const ellisHtml = `<html><body>
      <dl>
        <dt class="h5">Top</dt><dd>Creamy Milk Accord, Frangipani, Peony Rose</dd>
        <dt class="h5">Mid</dt><dd>Bourbon Vanilla Bean, Madagascar Vanilla Bean Extract, Upcycled Cocoa Shell Extract</dd>
        <dt class="h5">Dry</dt><dd>Benzoin Resinoid, Amyris, Sandalwood, Musk</dd>
      </dl>
    </body></html>`
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => ellisHtml,
    })
    vi.stubGlobal("fetch", fetchMock)

    const items: ScrapedItem[] = [
      {
        name: "Vanilla Milk",
        description: "",
        image: "",
        detailURL: "https://www.ellisbrooklyn.com/products/eau-de-parfum-vanilla-milk",
        perfumeHouse: "Ellis Brooklyn",
      },
    ]
    const { records } = await extractNotesForItems(items, "Ellis Brooklyn", {
      generateNoirDescriptions: false,
      fetchPdpNoteBootstrap: true,
      noteInferenceMode: "strict",
    })
    const open = JSON.parse(records[0].openNotes) as string[]
    const heart = JSON.parse(records[0].heartNotes) as string[]
    const base = JSON.parse(records[0].baseNotes) as string[]
    expect(open).toEqual(
      expect.arrayContaining(["creamy milk accord", "frangipani", "peony", "rose"]),
    )
    expect(heart).toEqual(
      expect.arrayContaining(["bourbon vanilla bean", "madagascar vanilla bean extract"]),
    )
    expect(base).toEqual(expect.arrayContaining(["benzoin resinoid", "amyris", "sandalwood", "musk"]))
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it("Ellis Brooklyn Forever Pistachio: extracts Top/Mid/Dry dt/dd pyramid from PDP HTML", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    invokeMock.mockImplementation(() => {
      throw new Error("LLM must not run when dt/dd pyramid is present")
    })
    const ellisHtml = `<html><body>
      <dl>
        <dt>Top</dt><dd>Pistachio, Almond Milk, Clove Bud</dd>
        <dt>Mid</dt><dd>Lily of the Valley, Buttermilk, Salted Caramel</dd>
        <dt>Dry</dt><dd>Tonka Bean, Madagascar Vanilla, Musks</dd>
      </dl>
    </body></html>`
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => ellisHtml,
    })
    vi.stubGlobal("fetch", fetchMock)

    const items: ScrapedItem[] = [
      {
        name: "Forever Pistachio",
        description: "Philosophy Founder's Note literary lions",
        image: "",
        detailURL: "https://www.ellisbrooklyn.com/products/forever-pistachio-perfume-mist",
        perfumeHouse: "Ellis Brooklyn",
      },
    ]
    const { records } = await extractNotesForItems(items, "Ellis Brooklyn", {
      generateNoirDescriptions: false,
      fetchPdpNoteBootstrap: true,
      noteInferenceMode: "strict",
    })
    const open = JSON.parse(records[0].openNotes) as string[]
    const heart = JSON.parse(records[0].heartNotes) as string[]
    const base = JSON.parse(records[0].baseNotes) as string[]
    expect(open).toEqual(
      expect.arrayContaining(["pistachio", "almond milk", "clove bud"]),
    )
    expect(heart).toEqual(
      expect.arrayContaining(["lily of the valley", "buttermilk", "salted caramel"]),
    )
    expect(base).toEqual(
      expect.arrayContaining(["tonka bean", "madagascar vanilla", "musk"]),
    )
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it("Andromedas Moon Cheirosa 71: repairs sampler URL and extracts notes of flat list", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    invokeMock.mockImplementation(() => {
      throw new Error("LLM must not run when merchant note list is present on PDP")
    })
    const items: ScrapedItem[] = [
      {
        name: "Cheirosa Sol De Janerio",
        description: "",
        image: "",
        detailURL:
          "https://www.andromedasmoon.com/products/fragrance-sampler-set-with-15-coupon?pr_prod_strat=jac",
        perfumeHouse: "Andromeda's Moon",
      },
    ]
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        const u = String(url)
        if (/andromedasmoon\.com\/search/i.test(u)) {
          return {
            ok: true,
            text: async () =>
              '<a href="/products/inspired-by-cheirosa-71-sol-de-janerio">Cheirosa 71</a>',
          }
        }
        if (/cheirosa-71/i.test(u)) {
          return {
            ok: true,
            text: async () =>
              "<h3>Top notes</h3><p>Sea Salt, Coconut Water, Pistachio</p>" +
              "<h3>Heart notes</h3><p>Caramelized Vanilla, Toasted Macadamia Nut</p>" +
              "<h3>Base notes</h3><p>Sandalwood, Warm Musk</p>",
          }
        }
        return { ok: false, status: 404, text: async () => "" }
      }),
    )
    const { records } = await extractNotesForItems(items, "Andromeda's Moon", {
      generateNoirDescriptions: false,
      fetchPdpNoteBootstrap: false,
      noteInferenceMode: "strict",
    })
    expect(records[0].detailURL).toMatch(/cheirosa-71/i)
    const all = [
      ...(JSON.parse(records[0].openNotes) as string[]),
      ...(JSON.parse(records[0].heartNotes) as string[]),
      ...(JSON.parse(records[0].baseNotes) as string[]),
    ]
    expect(all.length).toBeGreaterThanOrEqual(4)
    expect(all).toEqual(
      expect.arrayContaining(["caramelized vanilla", "toasted macadamia nut", "sea salt"]),
    )
    expect(records[0].description).not.toMatch(/fragrance\s+sampler/i)
  }, 30_000)

  it("Andromedas Moon London Fog PDP: extracts layered notes and strips template copy from description", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    const londonFogDesc =
      "Inspired by London Fog Eau De Parfum London Fog A cozy, moody gourmand that feels like sipping hot tea in a foggy London eveningsweet honey drizzles into a warm cup, with soft lavender floating through the steam. Scent Vibe Warm black tea golden honey airy lavender foggy, comforting ambiance Notes Top: Steaming Black Tea Heart: Lavender Mist Base: Honeyed Sweetness How it wears Opens with a realistic tea-steam warmth, quickly sweetened by honey, then settles into a smooth lavender haze that stays soft and cozy (never sharp). Sizes 5ml 15ml 30ml 60ml 100ml *Roller balls are never sold. Application Spray on pulse points. Processing & Shipping Processing: At least 7 business days and COULD TAKE LONGER. Important Shop Policy No changes, no cancellations, and no refunds."
    const items: ScrapedItem[] = [
      {
        name: "London Fog Brandt",
        description: londonFogDesc,
        image: "",
        detailURL: "",
        perfumeHouse: "Andromedas Moon",
      },
    ]
    const { records } = await extractNotesForItems(items, "Andromedas Moon", {
      generateNoirDescriptions: false,
      fetchPdpNoteBootstrap: false,
      noteInferenceMode: "strict",
    })
    const open = JSON.parse(records[0].openNotes) as string[]
    const heart = JSON.parse(records[0].heartNotes) as string[]
    const base = JSON.parse(records[0].baseNotes) as string[]
    expect(
      { open, heart, base, description: records[0].description, invokeCalls: invokeMock.mock.calls.length },
      "London Fog extraction snapshot",
    ).toMatchObject({
      open: expect.arrayContaining([expect.stringMatching(/black tea|steaming/i)]),
      heart: expect.arrayContaining([expect.stringMatching(/lavender/i)]),
      base: expect.arrayContaining([expect.stringMatching(/honey/i)]),
      invokeCalls: expect.any(Number),
    })
    expect(invokeMock.mock.calls.length).toBeLessThanOrEqual(1)
    const d = records[0].description
    expect(d).toMatch(/cozy|gourmand|lavender/i)
    expect(d).not.toMatch(/scent\s+vibe/i)
    expect(d).not.toMatch(/notes\s+top/i)
    expect(d).not.toMatch(/how\s+it\s+wears/i)
    expect(d).not.toMatch(/sizes\s+5\s*ml/i)
    expect(d).not.toMatch(/processing/i)
    expect(d).not.toMatch(/roller\s+balls/i)
  })

  it("Andromedas Moon Ink Mark: keeps all merchant Top/Heart/Base notes including warmth phrasing", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "llm")
    const inkMarkDesc =
      "Inspired by Ink Mark Eau De Parfum A smooth inky swirl of sandalwood, incense, and amber. The Vibe Picture a drop of deep violet ink touching water. Notes Top: Inky violet air • aromatic lift Heart: Incense smoke • soft powdery woods Base: Sandalwood • amber warmth • lingering woody glow How It Wears Projection: Medium Available Sizes 5ml"
    invokeMock.mockImplementation((input: { messages?: { content?: string }[] }) => {
      const sys = String(input?.messages?.[0]?.content ?? "")
      if (sys.includes("perfumery expert")) {
        return { content: '{"valid":[]}' }
      }
      return { content: '{"openNotes":[],"heartNotes":[],"baseNotes":[]}' }
    })
    const items: ScrapedItem[] = [
      {
        name: "Andromedas Ink Mark Louis Vuitton",
        description: inkMarkDesc,
        image: "",
        detailURL:
          "https://www.andromedasmoon.com/products/andromeda-s-inspired-by-ink-mark-eau-de-parfum-louis-vuitton",
        perfumeHouse: "Andromeda's Moon",
      },
    ]
    const { records } = await extractNotesForItems(items, "Andromeda's Moon", {
      generateNoirDescriptions: false,
      fetchPdpNoteBootstrap: false,
      noteInferenceMode: "strict",
      noteValidationMode: "llm",
    })
    const open = JSON.parse(records[0].openNotes) as string[]
    const heart = JSON.parse(records[0].heartNotes) as string[]
    const base = JSON.parse(records[0].baseNotes) as string[]
    expect(open).toEqual(expect.arrayContaining(["inky violet air", "aromatic lift"]))
    expect(heart).toEqual(expect.arrayContaining(["incense smoke"]))
    expect(heart.some(n => /soft powdery wood/i.test(n))).toBe(true)
    expect(base).toEqual(expect.arrayContaining(["sandalwood", "amber warmth", "lingering woody glow"]))
    expect(records[0]._noteSource).toBe("labeled_list")
  })

  it("Andromedas Black Tie glued Fragrance Notes: materials not Main Accords", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")
    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run")
    })
    const gluedDesc = `ANDROMEDAS MOON EAU DE PARFUM Inspired by Black Tie Originally by Celine I was told there was an issue with the formula. The Vibe A couture vanilla wrapped in powdery iris. Fragrance Notes White Orris / IrisSoft powder, elegant and refined VanillaSmooth, tailored sweetness CedarwoodClean structure and woody depth MuskSoft, skin-like finish Tree MossCool green shadow for depth Main Accords: powdery • vanilla • iris • woody • musky • mossy When to Wear Perfect for evenings. Available Sizes 5ml • 15ml`
    const items: ScrapedItem[] = [
      {
        name: "Inspired By Black Tie Cline",
        description: gluedDesc,
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
    expect(open).toEqual(expect.arrayContaining(["white orris", "iris", "vanilla", "cedarwood", "musk"]))
    expect(open).not.toEqual(expect.arrayContaining(["powdery", "woody", "musky", "mossy"]))
    vi.unstubAllEnvs()
  })

  it("Andromedas Mochi Milk: layered Scent Notes without marketing bullet junk", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")
    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run")
    })
    const mochiDesc =
      "Inspired by Mochi Milk A delicate daydream. Scent Notes Top: Marshmallow, Peach Nectar, Soft Incense Heart: Steamed Milk, Vanilla Bean, Jasmine, Creamy Rice Base: White Musk, Australian Sandalwood, Golden Amber Cozy and soft For milk lovers, pastel girls, and fans of soft skin scents Extrait de Parfum strength for long-lasting wear and gentle projection Hand-blended with care by Andromedas Moon ORIGINAL MANUFACTURERS PICTURES"
    const items: ScrapedItem[] = [
      {
        name: "Mochi Milk Dedcool",
        description: mochiDesc,
        image: "",
        detailURL: "https://www.andromedasmoon.com/products/andromedas-inspired-by-mochi-milk-eau-de-parfum-dedcool-1",
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
    const all = [...open, ...heart, ...base]
    expect(open).toEqual(expect.arrayContaining(["marshmallow", "peach nectar", "soft incense"]))
    expect(heart).toEqual(expect.arrayContaining(["steamed milk", "vanilla bean", "jasmine", "creamy rice"]))
    expect(base).toEqual(expect.arrayContaining(["white musk", "australian sandalwood", "golden amber"]))
    expect(all).not.toEqual(expect.arrayContaining(["with", "pastel girls", "fans", "gentle projection"]))
    vi.unstubAllEnvs()
  })

  it("Andromedas Fantasmagory: PDP rescue replaces contaminated LLM notes", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        `<html><body><p>Inspired by Fantasmagory Eau De Parfum Notes: Anise • Ginger • Almond • Floral Notes • Vanilla • Leather Note Breakdown Top Anise • Ginger Middle Almond • Floral Notes Base Vanilla • Leather Available Sizes 5ml</p></body></html>`,
    })
    vi.stubGlobal("fetch", fetchMock)

    invokeMock.mockImplementation(async (input: { messages?: { role?: string; content?: string }[] }) => {
      const sys = String(input?.messages?.find(m => m.role === "system")?.content ?? "")
      if (sys.includes("master perfumer")) {
        return {
          content: JSON.stringify({
            openNotes: ["tahitian vanilla", "vetiver scent description tihota on fire", "fluffy glow"],
            heartNotes: ["brown sugar", "almond", "milk"],
            baseNotes: ["amber", "a soft golden sweetness", "glowing"],
          }),
        }
      }
      return { content: '{"openNotes":[],"heartNotes":[],"baseNotes":[]}' }
    })

    const items: ScrapedItem[] = [
      {
        name: "Fantasmagory Lv",
        description:
          "A flickering streetlamp casts a warm glow. tahitian vanilla and vetiver scent description tihota on fire. brown sugar almond milk marshmallow.",
        image: "",
        detailURL: "https://www.andromedasmoon.com/products/andromedas-inspired-by-fantasmagory-eau-de-parfum-lv",
        perfumeHouse: "Andromeda's Moon",
      },
    ]
    const { records } = await extractNotesForItems(items, "Andromeda's Moon", {
      generateNoirDescriptions: false,
      fetchPdpNoteBootstrap: true,
    })
    const open = JSON.parse(records[0].openNotes) as string[]
    const heart = JSON.parse(records[0].heartNotes) as string[]
    const base = JSON.parse(records[0].baseNotes) as string[]
    const all = [...open, ...heart, ...base]
    expect(all).toEqual(expect.arrayContaining(["anise", "ginger", "almond", "vanilla", "leather"]))
    expect(all.some(n => /tihota|scent description/i.test(n))).toBe(false)
    expect(fetchMock).toHaveBeenCalled()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("Andromedas Powder Love: splits comma-less heart/base blobs and drops prose junk", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    const powderDesc =
      "Inspired by Powder Love Eau De Parfum Notes Top: Cotton Candy • Marshmallow Heart: Orange Blossom • Candied Almond Base: Musk • Ambroxan • Tonka Bean Available Sizes 5ml"

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run for labeled Scent Notes pyramid")
    })

    const items: ScrapedItem[] = [
      {
        name: "Powder Love Juliette Has A Gun",
        description: powderDesc,
        image: "",
        detailURL: "https://www.andromedasmoon.com/products/andromedas-inspired-by-powder-love-eau-de-parfum-juliette-has-a-gun",
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
    expect(open).toEqual(expect.arrayContaining(["cotton candy", "marshmallow"]))
    expect(heart).toEqual(expect.arrayContaining(["orange blossom", "candied almond"]))
    expect(base).toEqual(expect.arrayContaining(["musk", "ambroxan", "tonka bean"]))
    expect([...open, ...heart, ...base]).not.toEqual(
      expect.arrayContaining(["orange blossom candied almond", "musk ambroxan tonka bean"]),
    )
  })

  it("drops CSS bleed and noir prose fragments from note layers", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    invokeMock.mockImplementation(async (input: { messages?: { role?: string; content?: string }[] }) => {
      const sys = String(input?.messages?.find(m => m.role === "system")?.content ?? "")
      if (sys.includes("master perfumer")) {
        return {
          content: JSON.stringify({
            openNotes: [],
            heartNotes: [],
            baseNotes: ["touch", "rum-like warmth f note"],
          }),
        }
      }
      if (sys.includes("rebalance a perfume note list")) {
        return {
          content: JSON.stringify({
            openNotes: [],
            heartNotes: [],
            baseNotes: ["rgba", "linear-gradient", "h2", "margin", "sandalwood"],
          }),
        }
      }
      return { content: '{"openNotes":[],"heartNotes":[],"baseNotes":[]}' }
    })

    const cssDesc =
      "/* .am-wrapper { max-width: 1200px; margin: 0 auto; background: linear-gradient(rgba(0,0,0,.5), rgba(0,0,0,.5)); } h2 { margin: 0; } */ Top: sandalwood Base: warm skin"

    const noirDesc =
      "Rain-soaked curbs glisten under flickering streetlights as whispers of bourbon vanilla fill the air. A warm, rum-like embrace wraps around you, promising secrets best kept in the shadows."

    const items: ScrapedItem[] = [
      {
        name: "Santal De Paris",
        description: cssDesc,
        image: "",
        detailURL: "https://www.andromedasmoon.com/products/inspired-by-santal-de-paris",
        perfumeHouse: "Andromeda's Moon",
      },
      {
        name: "Libre Vanille",
        description: noirDesc,
        image: "",
        detailURL: "https://www.andromedasmoon.com/products/libre-vanille",
        perfumeHouse: "Andromeda's Moon",
      },
    ]

    const { records } = await extractNotesForItems(items, "Andromeda's Moon", {
      generateNoirDescriptions: false,
      fetchPdpNoteBootstrap: false,
    })

    const cssBase = JSON.parse(records[0].baseNotes) as string[]
    expect(cssBase).not.toEqual(expect.arrayContaining(["rgba", "linear-gradient", "h2", "margin"]))

    const libreAll = [
      ...JSON.parse(records[1].openNotes),
      ...JSON.parse(records[1].heartNotes),
      ...JSON.parse(records[1].baseNotes),
    ] as string[]
    expect(libreAll).not.toEqual(expect.arrayContaining(["touch", "rum-like warmth f note"]))
  })

  it("Andromedas Libre Vanille: Main Notes block (no colon) extracts materials and cleans description", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    const libreDesc =
      "Andromedas Moon Inspired by Libre Vanille Couture Eau De Parfum Inspired by Yves Saint Laurent A rich, elegant vanilla with a golden couture feel smooth, upscale, and softly sensual. This scent wraps warm bourbon vanilla around glowing orange blossom and airy lavender, then finishes with a touch of rum or a polished gourmand-floral impression that feels dressed in black and gold. Fragrance Profile Main Notes Bourbon Vanilla Orange Blossom Vanilla Caviar Lavender Rum Overall Vibe Golden vanilla White floral glow Soft lavender elegance Sweet warmth Refined evening glamour"

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when Main Notes block is present")
    })

    const items: ScrapedItem[] = [
      {
        name: "Andromedas Inspired By Libre Vanille Couture Yves Saint Laurent",
        description: libreDesc,
        image: "",
        detailURL:
          "https://www.andromedasmoon.com/products/andromeda-s-inspired-by-libre-vanille-couture-eau-de-parfum-yves-saint-laurent",
        perfumeHouse: "Andromeda's Moon",
      },
    ]

    const { records } = await extractNotesForItems(items, "Andromeda's Moon", {
      generateNoirDescriptions: false,
      fetchPdpNoteBootstrap: false,
    })

    expect(invokeMock).not.toHaveBeenCalled()
    const open = JSON.parse(records[0].openNotes) as string[]
    const all = [
      ...open,
      ...(JSON.parse(records[0].heartNotes) as string[]),
      ...(JSON.parse(records[0].baseNotes) as string[]),
    ]
    expect(all).toEqual(
      expect.arrayContaining(["bourbon vanilla", "orange blossom", "vanilla caviar", "lavender", "rum"]),
    )
    expect(all).not.toEqual(expect.arrayContaining(["rum-like warmth f", "touch"]))
    expect(records[0].description).not.toMatch(/fragrance\s+profile|main\s+notes|overall\s+vibe/i)
    expect(records[0].description).not.toMatch(/touch\s+of\s+or\s+a/i)
  })

  it("Andromedas Orgasmo: stacked Notes block and amaretto prose fallback extract both materials", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    const fullPdpDesc =
      "Inspired by Orgasmo Eau De Parfum A dreamy amaretto-almond gourmand with a silky, sweet glow. Scent Vibe Think amaretto on the rocks and sweet almond warmth. Notes Almond Amaretto Liqueur Accord Wear & Layer Gorgeous solo for an almond-gourmand moment. Available Sizes 5ml 15ml"

    const thinScrapeDesc =
      "Andromedas Moon Inspired by Orgasmo Eau De Parfum A dreamy amaretto- gourmand with a silky, sweet glow cozy, addictive, and cloud-soft."

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when merchant Notes block or amaretto prose is present")
    })

    for (const [label, description] of [
      ["full PDP", fullPdpDesc],
      ["thin scrape", thinScrapeDesc],
    ] as const) {
      const items: ScrapedItem[] = [
        {
          name: "Andromeda's Inspired By Orgasmo Hildi Soliani",
          description,
          image: "",
          detailURL:
            "https://www.andromedasmoon.com/products/andromedas-inspired-by-orgasmo-eau-de-parfum-hildi-soliani",
          perfumeHouse: "Andromeda's Moon",
        },
      ]

      const { records } = await extractNotesForItems(items, "Andromeda's Moon", {
        generateNoirDescriptions: false,
        fetchPdpNoteBootstrap: false,
      })

      const open = JSON.parse(records[0].openNotes) as string[]
      expect(open, label).toEqual(
        expect.arrayContaining(["almond", "amaretto liqueur accord"]),
      )
    }

    expect(invokeMock).not.toHaveBeenCalled()
  })

  it("Andromedas Impadia: emoji Fragrance Notes block extracts all merchant materials", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    const impadiaPdp =
      "Inspired by Impadia Eau De Parfum Fragrance Description A radiant fusion of pear and bergamot unfolds into blooming roses and orange blossom, anchored by creamy vanilla absolute and smooth sandalwood. Fragrance Notes 🍐 Pear 🍋 Bergamot 🍊 Mandarin 🌹 Bulgarian Rose 🌷 Turkish Rose 🤍 Orange Blossom 🪵 Akigalawood 🌿 Vanilla Absolute 🪵 Sandalwood Available Sizes 5 mL 15 mL"

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when emoji Fragrance Notes block is present")
    })

    const items: ScrapedItem[] = [
      {
        name: "Impadia Bdk",
        description: impadiaPdp,
        image: "",
        detailURL: "https://www.andromedasmoon.com/products/andromeda-s-inspired-by-impadia-eau-de-parfum-bdk",
        perfumeHouse: "Andromeda's Moon",
      },
    ]

    const { records } = await extractNotesForItems(items, "Andromeda's Moon", {
      generateNoirDescriptions: false,
      fetchPdpNoteBootstrap: false,
    })

    const open = JSON.parse(records[0].openNotes) as string[]
    expect(open).toEqual(
      expect.arrayContaining([
        "pear",
        "bergamot",
        "mandarin",
        "bulgarian rose",
        "turkish rose",
        "orange blossom",
        "akigalawood",
        "vanilla absolute",
        "sandalwood",
      ]),
    )
    expect(open).not.toContain("body")
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it("Andromedas Mojave Ghost Absolu: em-dash Top/Heart/Base pyramid and no CSS font junk", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    const mojavePdp =
      "Inspired by Mojave Ghost Absolu Eau De Parfum Andromedas Moon Originally from Byredo Unisex Top — Sapodilla, Ambrette Heart — Magnolia, Violet, Sandalwood Base — Musk, Amber, Cedarwood Scent Story Radiant yet grounded creamy woods airy florals"

    const cssBleed =
      "body, .color-background-1 { font-family: -apple-system, BlinkMacSystemFont, Roboto, Inter, system-ui, Helvetica, Arial, sans-serif; background: radial-gradient(circle, #fff, #000); }"

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when em-dash pyramid is present")
    })

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

    expect(open).toEqual(expect.arrayContaining(["sapodilla", "ambrette"]))
    expect(heart).toEqual(expect.arrayContaining(["magnolia", "violet", "sandalwood"]))
    expect(base).toEqual(expect.arrayContaining(["musk", "amber", "cedarwood"]))
    expect([...open, ...heart, ...base]).not.toEqual(
      expect.arrayContaining(["body", "roboto", "radial-gradient", "blinkmacsystemfont"]),
    )
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it("Andromedas Not Vanilla: keeps layers separated without duplicated cross-layer notes", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    const notVanillaPdp =
      "Top notes of Camphor, Nutmeg, Bergamot Middle notes of Vanilla, Juniper Berries, Cedar, Violet Base notes of Praline, Cetalox, Musk, Guaiac Wood, Moss, Amber"

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when clear layered notes are present")
    })

    const items: ScrapedItem[] = [
      {
        name: "Not Vanilla Borntostandout",
        description: notVanillaPdp,
        image: "",
        detailURL: "https://www.andromedasmoon.com/products/andromedas-inspired-by-eladaria-eau-de-parfum-creed",
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

    expect(open).toEqual(expect.arrayContaining(["camphor", "nutmeg", "bergamot"]))
    expect(open).not.toEqual(expect.arrayContaining(["praline", "cetalox", "musk", "amber"]))
    expect(heart).toEqual(expect.arrayContaining(["vanilla", "juniper berries", "cedar", "violet"]))
    expect(base).toEqual(
      expect.arrayContaining(["praline", "cetalox", "musk", "guaiac wood", "moss", "amber"]),
    )
    expect(heart).not.toEqual(expect.arrayContaining(["cetalox", "amber", "praline"]))
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it("Andromedas Fragaria: removes merged heart blob and adjective-only duplicate tokens", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    const fragariaPdp =
      "Top Notes: Crushed Pink Pepper, Sparkling Mandarin, Zesty Bergamot Heart Notes: Wild Strawberry, Violet Veil, Orris Butter Base Notes: Smoked Vetiver, Cedarwood Shavings, Patchouli Resin, Fir Balsam"

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when clear layered notes are present")
    })

    const items: ScrapedItem[] = [
      {
        name: "Fragaria Creed",
        description: fragariaPdp,
        image: "",
        detailURL: "https://www.andromedasmoon.com/products/inspired-by-fragaria",
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

    expect(open).toEqual(expect.arrayContaining(["crushed pink pepper", "sparkling mandarin", "zesty bergamot"]))
    expect(open).not.toEqual(expect.arrayContaining(["wild strawberry", "violet veil", "orris butter"]))
    expect(heart).toEqual(expect.arrayContaining(["wild strawberry", "violet veil", "orris butter"]))
    expect(heart).not.toEqual(
      expect.arrayContaining(["wild", "wild strawberry violet veil orris butter"]),
    )
    expect(base).toEqual(
      expect.arrayContaining(["smoked vetiver", "cedarwood shavings", "patchouli resin", "fir balsam"]),
    )
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it("Andromedas Donna Born In Roma: Key Notes list overrides sparse noir prose extraction", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    const donnaPdp =
      "Key Notes: Blackcurrant, Jasmine, Bourbon Vanilla, Amber A bold Valentino-inspired extradose with dark fruit sparkle and creamy vanilla depth."

    invokeMock.mockResolvedValue({
      openNotes: [],
      heartNotes: [],
      baseNotes: ["amber", "musk"],
    })

    const items: ScrapedItem[] = [
      {
        name: "Donna Born In Roma Extradose Valentino",
        description: donnaPdp,
        image: "",
        detailURL:
          "https://www.andromedasmoon.com/products/andromeda-s-inspired-by-donna-born-in-roma-extradose-eau-de-parfum-valentino",
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

    expect(open).toEqual(
      expect.arrayContaining(["blackcurrant", "jasmine", "bourbon vanilla", "amber"]),
    )
    expect(heart).toEqual([])
    expect(base).toEqual([])
    expect(open).not.toEqual(expect.arrayContaining(["musk"]))
  })

  it("Andromedas Donna Born In Roma: drops marketing adjectives from Key Notes bleed", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    const donnaMarketingBleed =
      "Key Notes: Blackcurrant, Jasmine, Bourbon Vanilla, Amber, Musk, Rebellious, Sensual, Seductive, Drenched in warmth, Creating an unforgettable, Sparkling Bergamot A bold Valentino-inspired extradose."

    invokeMock.mockResolvedValue({
      openNotes: [],
      heartNotes: [],
      baseNotes: [
        "rebellious",
        "jasmine",
        "bourbon vanilla",
        "amber",
        "blackcurrant",
        "sensual",
        "sparkling bergamot",
        "drenched in warmth",
        "creating an unforgettable",
        "seductive",
        "musk",
      ],
    })

    const items: ScrapedItem[] = [
      {
        name: "Donna Born In Roma Extradose Valentino",
        description: donnaMarketingBleed,
        image: "",
        detailURL:
          "https://www.andromedasmoon.com/products/andromeda-s-inspired-by-donna-born-in-roma-extradose-eau-de-parfum-valentino",
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
    const all = [...open, ...heart, ...base]

    expect(all).toEqual(
      expect.arrayContaining(["blackcurrant", "jasmine", "bourbon vanilla", "amber", "musk"]),
    )
    expect(all).not.toEqual(
      expect.arrayContaining([
        "rebellious",
        "sensual",
        "seductive",
        "drenched in warmth",
        "creating an unforgettable",
      ]),
    )
  })

  it("Andromedas Yum Marshmallow: drops marketing color and -kissed prose from notes", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    const yumPdp =
      "Top Notes: Strawberry, Milk, Cotton Candy Mist Heart Notes: Fluffy Marshmallow, Whipped Vanilla Cream Base Notes: Powdered Sugar, Cozy Musk, Pink, Fairy-Kissed A sweet pastel gourmand drenched in nostalgia."

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when layered notes are present")
    })

    const items: ScrapedItem[] = [
      {
        name: "Yum Marshmallow Dust Hybrid Blend",
        description: yumPdp,
        image: "",
        detailURL: "https://www.andromedasmoon.com/products/andromeda-s-yum-marshmallow-duet-eau-de-parfum-hybrid-blend",
        perfumeHouse: "Andromeda's Moon",
      },
    ]

    const { records } = await extractNotesForItems(items, "Andromeda's Moon", {
      generateNoirDescriptions: false,
      fetchPdpNoteBootstrap: false,
    })

    const all = [
      ...(JSON.parse(records[0].openNotes) as string[]),
      ...(JSON.parse(records[0].heartNotes) as string[]),
      ...(JSON.parse(records[0].baseNotes) as string[]),
    ]

    expect(all).toEqual(expect.arrayContaining(["strawberry", "fluffy marshmallow", "cozy musk"]))
    expect(all).not.toEqual(expect.arrayContaining(["pink", "fairy-kissed"]))
  })

  it("Andromedas Musk Kayali: drops skin signature and vague wood/floral prose", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    const muskPdp =
      "Top Notes: Lotus Flower, Freesia Heart Notes: Jasmine, Musk Base Notes: Vanilla, Sandalwood, Softened with creamy florals, Warm wood, Becomes your skins signature, Cashmeran"

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when layered notes are present")
    })

    const items: ScrapedItem[] = [
      {
        name: "Musk Kayali",
        description: muskPdp,
        image: "",
        detailURL: "https://www.andromedasmoon.com/products/andromeda-s-inspired-by-musk-12-eau-d1e-parfum-kayali",
        perfumeHouse: "Andromeda's Moon",
      },
    ]

    const { records } = await extractNotesForItems(items, "Andromeda's Moon", {
      generateNoirDescriptions: false,
      fetchPdpNoteBootstrap: false,
    })

    const all = [
      ...(JSON.parse(records[0].openNotes) as string[]),
      ...(JSON.parse(records[0].heartNotes) as string[]),
      ...(JSON.parse(records[0].baseNotes) as string[]),
    ]

    expect(all).toEqual(
      expect.arrayContaining(["lotus flower", "freesia", "jasmine", "musk", "vanilla", "sandalwood", "cashmeran"]),
    )
    expect(all).not.toEqual(
      expect.arrayContaining([
        "becomes your skins signature",
        "softened with creamy florals",
        "warm wood",
        "creamy florals",
      ]),
    )
  })

  it("Andromedas Milk Orchid: layered Top/Heart/Base notes without prose junk", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    const milkOrchidPdp =
      "Inspired by Milk Orchid Eau De Parfum Originally from Commodity Top Notes: Coconut, Fig Milk, Almond Blossom Heart Notes: Vanilla Orchid, Magnolia Base Notes: Milk, Sandalwood, Macadamia Imagine a soft white sweater, a mug of warm coconut milk and petals of vanilla orchid drifting over the surface."

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when layered Top/Heart/Base notes are present")
    })

    const items: ScrapedItem[] = [
      {
        name: "Milk Orchid Commodity",
        description: milkOrchidPdp,
        image: "",
        detailURL: "https://www.andromedasmoon.com/products/andromedas-inspired-by-milk-orchid-eau-de-parfum-commodity",
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

    expect(open).toEqual(expect.arrayContaining(["coconut", "fig milk", "almond blossom"]))
    expect(heart).toEqual(expect.arrayContaining(["vanilla orchid", "magnolia"]))
    expect(base).toEqual(expect.arrayContaining(["milk", "sandalwood", "macadamia"]))
    expect([...open, ...heart, ...base]).not.toEqual(expect.arrayContaining(["a mug", "top", "blossom"]))
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it("Andromedas Tihota: Scent Profile block and no prose junk in notes", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    const tihotaPdp =
      "Inspired by Tihota Eau de Parfum Andromeda's Moon Originally from Indult A luminous creamy vanilla that feels like skin kissed by starlight. Tahitian vanilla is wrapped in soft sugar cane and almond milk. Scent Profile Tahitian Vanilla Tonka Bean Sugar Cane Almond Milk White Musk Amber Vibe Clean vanilla aura creamy comfort warm amber glow Wear It When Everyday signature Strength Eau de Parfum concentration Available Sizes 5 ml 15 ml"

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when Scent Profile merchant list is present")
    })

    const items: ScrapedItem[] = [
      {
        name: "Tihota Indult",
        description: tihotaPdp,
        image: "",
        detailURL: "https://www.andromedasmoon.com/products/inspired-by-tihota-eau-de-parfum",
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
    const all = [...open, ...heart, ...base]

    expect(all).toEqual(
      expect.arrayContaining([
        "tahitian vanilla",
        "tonka bean",
        "sugar cane",
        "almond milk",
        "white musk",
        "amber",
      ]),
    )
    expect(all).not.toEqual(
      expect.arrayContaining([
        "tihota",
        "fluffy glow",
        "then deepens into warm brown sugar",
        "tonka",
      ]),
    )
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it("Andromedas Portofino: Wear & Performance season copy does not bleed into base notes", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    const portofinoPdp =
      "Top Notes Bergamot, Mandarin Orange, Lemon, Bitter Orange, Lavender, Rosemary, Myrtle Heart Notes African Orange Flower, Neroli, Jasmine, Pitosporum Base Notes Amber, Ambrette (Musk Mallow), Angelica Citrus Aromatic White Floral Amber-Musky Drydown Seaside Breeze Wear & Performance Season: Spring / Summer • warm days, resort evenings Projection: Airy to moderate Longevity: ~6–8 hrs on skin"

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when layered Top/Heart/Base notes are present")
    })

    const items: ScrapedItem[] = [
      {
        name: "Portofino",
        description: portofinoPdp,
        image: "",
        detailURL:
          "https://www.andromedasmoon.com/products/andromedas-portofino-98-neroli-portofino-x-portofino-97-eau-de-parfum",
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
    const all = [...open, ...heart, ...base]

    expect(open).toEqual(
      expect.arrayContaining(["bergamot", "mandarin orange", "lemon", "bitter orange", "lavender"]),
    )
    expect(heart).toEqual(
      expect.arrayContaining(["african orange flower", "neroli", "jasmine", "pitosporum"]),
    )
    expect(base).toEqual(expect.arrayContaining(["amber", "ambrette", "musk mallow", "angelica"]))
    expect(all).not.toEqual(expect.arrayContaining(["resort evenings", "warm days"]))
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it("Andromedas Ginger Biscuit: blending/base-melts prose extracts pyramid without LLM", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    const gingerBiscuitPdp =
      "Inspired by Ginger Biscuit Eau de Parfum Originally from Jo Malone Andromedas Moon Inspired by Ginger Biscuit is warm, cozy, and sweetly spiced blending ginger, cinnamon, and nutmeg with the comforting richness of caramel and toasted hazelnut. The base melts into soft vanilla and smooth tonka bean, creating an edible-sweet hug in a bottle. Please note: This fragrance is a true skin scent very light, delicate, and intimate, just like the original Jo Malone. Perfect for those who enjoy subtle perfumes that sit close to the skin rather than projecting strongly."

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when blending/base-melts prose lists materials")
    })

    const items: ScrapedItem[] = [
      {
        name: "Ginger Biscuit Jo Malone",
        description: gingerBiscuitPdp,
        image: "",
        detailURL:
          "https://www.andromedasmoon.com/products/andromeda-s-inspired-by-ginger-biscuit-eau-de-parfum-jo-malone",
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
    const all = [...open, ...heart, ...base]

    expect(open).toEqual(expect.arrayContaining(["ginger", "cinnamon", "nutmeg"]))
    expect(heart).toEqual(expect.arrayContaining(["caramel", "toasted hazelnut"]))
    expect(base).toEqual(expect.arrayContaining(["vanilla", "tonka bean"]))
    expect(all).not.toEqual(expect.arrayContaining(["delicate", "intimate", "cozy"]))
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it("Andromedas Dolce Di Luna: Wear Guide prose does not bleed into pyramid notes", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    const dolcePdp =
      "Dolce di Luna is a celestial gourmand fantasy. Fragrance Notes Top Notes: Marshmallow, Sugar, Yeast, Almond, Milk, Saffron Heart Notes: Vanilla, Toffee Base Notes: Musk, Sandalwood, Cedar Wear Guide Perfect for cozy nights, starry date evenings, or whenever you want to feel wrapped in a soft, celestial hug. Good to Know: Hand-poured, cruelty-free, and made with a special blend of gourmand ingredients."

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when Top/Heart/Base notes are present")
    })

    const items: ScrapedItem[] = [
      {
        name: "Dolce Di Luna",
        description: dolcePdp,
        image: "",
        detailURL: "https://www.andromedasmoon.com/products/andromedas-dolce-di-luna-eau-de-parfum",
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
    const all = [...open, ...heart, ...base]

    expect(open).toEqual(
      expect.arrayContaining(["marshmallow", "sugar", "yeast", "almond", "milk", "saffron"]),
    )
    expect(heart).toEqual(expect.arrayContaining(["vanilla", "toffee"]))
    expect(base).toEqual(expect.arrayContaining(["musk", "sandalwood", "cedar"]))
    expect(all).not.toEqual(
      expect.arrayContaining([
        "starry date evenings",
        "celestial hug",
        "celestial",
        "cedar wear guide",
        "wear guide",
      ]),
    )
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it("Andromedas Dallachai: Notes Top/Heart/Base bullet pyramid parses without LLM", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    const dallachaiPdp =
      "DALLACHAI honors the golden ritual. Notes Top Passionfruit • Cardamom • Saffron • Clove Heart Arabian Blonde Coffee • Milk Base Amber • Fluffy Musk Scent Story DALLACHAI honors Middle Eastern warmth with a touch of European elegance. Delicate blonde coffee with a touch of milk — smooth, creamy, aromatic. Golden amber and airy musk wrap the skin. Wear Guide Sillage Moderate Longevity 6-10 hrs"

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when Notes Top/Heart/Base bullet pyramid is present")
    })

    const items: ScrapedItem[] = [
      {
        name: "Dallachai Montale",
        description: dallachaiPdp,
        image: "",
        detailURL:
          "https://www.andromedasmoon.com/products/andromedas-inspired-by-dallachai-eau-de-parfum-montale",
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
    const all = [...open, ...heart, ...base]

    expect(open).toEqual(
      expect.arrayContaining(["passionfruit", "cardamom", "saffron", "clove"]),
    )
    expect(heart).toEqual(expect.arrayContaining(["arabian blonde coffee", "milk"]))
    expect(base).toEqual(expect.arrayContaining(["amber", "fluffy musk"]))
    expect(all).not.toEqual(
      expect.arrayContaining([
        "milk — smooth",
        "creamy",
        "european elegance",
        "smooth",
      ]),
    )
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it("Andromedas Gioiosa: Notes Pyramid Top/Heart/Base parses without prose bleed", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    const gioiosaPdp =
      "INSPIRED BY Gioiosa Eau De Parfum Profumum Roma. Notes Pyramid Top Orange Bergamot Golden Mist Heart Jasmine Coconut Cream Vanilla Orchid Base Amber Vanilla Moss Vibe & Wear Projection radiant arm's-length. Scent Story Think sun-kissed coconut through jasmine petals, joyfully luminous and candy-drip sparkle. Layering Ideas Sugar-Vanilla mists."

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when Notes Pyramid Top/Heart/Base is present")
    })

    const items: ScrapedItem[] = [
      {
        name: "Gioiosa Profumum Roma",
        description: gioiosaPdp,
        image: "",
        detailURL:
          "https://www.andromedasmoon.com/products/andromedas-inspired-by-gioiosa-eau-de-parfum-profumum-roma",
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
    const all = [...open, ...heart, ...base]

    expect(open).toEqual(expect.arrayContaining(["orange", "bergamot"]))
    expect(heart).toEqual(
      expect.arrayContaining(["jasmine", "coconut cream", "vanilla orchid"]),
    )
    expect(base).toEqual(expect.arrayContaining(["amber", "vanilla", "moss"]))
    expect(all).not.toEqual(
      expect.arrayContaining(["joyfully", "golden mist", "luminous", "candy-drip"]),
    )
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it("Andromedas Gioiosa: enrichOnly drops stale Python top blob when PDP bootstrap is stronger", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    const noirOnly =
      "Fog drapes the night like a sultry secret, wrapping the air in whispers of citrus and jasmine. Coconut cream and amber intertwine, casting a warm, inviting glow amidst the shadows of the alley."

    const gioiosaHtml = `<html><body><p>INSPIRED BY Gioiosa Eau De Parfum Profumum Roma. Notes Pyramid Top Orange Bergamot Golden Mist Heart Jasmine Coconut Cream Vanilla Orchid Base Amber Vanilla Moss Vibe &amp; Wear Projection radiant. Scent Story Think sun-kissed coconut through jasmine petals, joyfully luminous.</p></body></html>`

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => gioiosaHtml,
    })
    vi.stubGlobal("fetch", fetchMock)

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when enrichOnly gets stronger Andromeda PDP structure")
    })

    const items: ScrapedItem[] = [
      {
        name: "Gioiosa Profumum Roma",
        description: noirOnly,
        image: "",
        detailURL:
          "https://www.andromedasmoon.com/products/andromedas-inspired-by-gioiosa-eau-de-parfum-profumum-roma",
        perfumeHouse: "Andromeda's Moon",
        openNotes: ["orange bergamot golden mist"],
        heartNotes: ["jasmine", "coconut cream", "vanilla orchid"],
        baseNotes: ["amber", "vanilla", "moss"],
      },
    ]

    const { records } = await extractNotesForItems(items, "Andromeda's Moon", {
      generateNoirDescriptions: false,
      enrichOnly: true,
      fetchPdpNoteBootstrap: true,
    })

    const open = JSON.parse(records[0].openNotes) as string[]
    const heart = JSON.parse(records[0].heartNotes) as string[]
    const base = JSON.parse(records[0].baseNotes) as string[]
    const all = [...open, ...heart, ...base]

    expect(open).toEqual(expect.arrayContaining(["orange", "bergamot"]))
    expect(all).not.toEqual(expect.arrayContaining(["orange bergamot golden mist", "golden mist"]))
    expect(heart).toEqual(
      expect.arrayContaining(["jasmine", "coconut cream", "vanilla orchid"]),
    )
    expect(base).toEqual(expect.arrayContaining(["amber", "vanilla", "moss"]))
    expect(fetchMock).toHaveBeenCalled()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("Andromedas Gioiosa: enrichOnly repairs bad Python notesText blob without PDP fetch", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when enrichOnly reparses Python notesText")
    })

    const items: ScrapedItem[] = [
      {
        name: "Gioiosa Profumum Roma",
        description:
          "Golden mist swirls through the heavy, humid air, mingling with the scent of orange bergamot as night falls. Jasmine seduces from the shadows, while the rich embrace of coconut cream and warm vanilla orchid wraps around you like a lover's whisper.",
        notesText:
          "open notes: orange bergamot golden mist\nheart notes: jasmine, coconut cream, vanilla orchid\nbase notes: amber, vanilla, moss",
        image: "",
        detailURL:
          "https://www.andromedasmoon.com/products/andromedas-inspired-by-gioiosa-eau-de-parfum-profumum-roma",
        perfumeHouse: "Andromeda's Moon",
        openNotes: ["orange bergamot golden mist"],
        heartNotes: ["jasmine", "coconut cream", "vanilla orchid"],
        baseNotes: ["amber", "vanilla", "moss"],
      },
    ]

    const { records } = await extractNotesForItems(items, "Andromeda's Moon", {
      generateNoirDescriptions: false,
      enrichOnly: true,
      fetchPdpNoteBootstrap: false,
    })

    const open = JSON.parse(records[0].openNotes) as string[]
    const heart = JSON.parse(records[0].heartNotes) as string[]
    const base = JSON.parse(records[0].baseNotes) as string[]
    const all = [...open, ...heart, ...base]

    expect(open).toEqual(expect.arrayContaining(["orange", "bergamot"]))
    expect(all).not.toEqual(expect.arrayContaining(["orange bergamot golden mist", "golden mist"]))
    expect(heart).toEqual(
      expect.arrayContaining(["jasmine", "coconut cream", "vanilla orchid"]),
    )
    expect(base).toEqual(expect.arrayContaining(["amber", "vanilla", "moss"]))
  })

  it("Obvious Parfums: enrichOnly keeps Python PrestaShop pyramid notes when description was noir-wiped", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run for a trusted Python html_prestashop_pyramid extraction")
    })

    const items: ScrapedItem[] = [
      {
        // Scoville shape: 3/1/3 pyramid; Python wipes description once noir exists,
        // and no notesText was emitted — the Node pass previously dropped every note.
        name: "Scoville By Obvious",
        description: "",
        image: "",
        detailURL:
          "https://www.obviousparfums.com/en/eaux-de-parfum/162-scoville-by-obvious-50ml-eau-parfum.html",
        perfumeHouse: "Obvious Parfums",
        openNotes: ["red chili pepper", "sichuan pepper", "black pepper"],
        heartNotes: ["priprioca"],
        baseNotes: ["woody notes", "vanilla", "musk"],
        _noteSource: "html_prestashop_pyramid",
      },
      {
        // Une Vanille shape: 1/1/3 = 5 notes — fails the >=6 rule used for
        // text_regex_layered but must still be trusted for theme pyramid DOM.
        name: "Une Vanille",
        description: "",
        image: "",
        detailURL: "https://www.obviousparfums.com/en/eaux-de-parfum/141-une-vanille.html",
        perfumeHouse: "Obvious Parfums",
        openNotes: ["tonka bean absolute from venezuela"],
        heartNotes: ["black vanilla absolute from madagascar"],
        baseNotes: ["globalide", "muscenone", "clean macrocyclic musk"],
        _noteSource: "html_prestashop_pyramid",
      },
    ]

    const { records } = await extractNotesForItems(items, "Obvious Parfums", {
      generateNoirDescriptions: false,
      enrichOnly: true,
      fetchPdpNoteBootstrap: false,
    })

    const scoville = records.find(r => r.name.includes("Scoville"))
    const vanille = records.find(r => r.name.includes("Vanille"))
    expect(scoville).toBeDefined()
    expect(vanille).toBeDefined()

    expect(JSON.parse(scoville!.openNotes)).toEqual(
      expect.arrayContaining(["red chili pepper", "sichuan pepper", "black pepper"]),
    )
    expect(JSON.parse(scoville!.heartNotes)).toEqual(expect.arrayContaining(["priprioca"]))
    expect(JSON.parse(scoville!.baseNotes)).toEqual(
      expect.arrayContaining(["woody notes", "vanilla", "musk"]),
    )

    expect(JSON.parse(vanille!.openNotes).length).toBeGreaterThan(0)
    expect(JSON.parse(vanille!.heartNotes).length).toBeGreaterThan(0)
    expect(JSON.parse(vanille!.baseNotes).length).toBeGreaterThan(0)
  })

  it("Andromedas Gioiosa: noir-only description rescues notes from PDP fetch", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    const noirOnly =
      "A flickering neon sign casts a ghostly glow on wet asphalt, mirroring the electric pulse of the night. Subtle notes of bergamot dance with the allure of jasmine and peony, while an undercurrent of amber and musk wraps the atmosphere in an intoxicating haze."

    const gioiosaHtml = `<html><body><p>INSPIRED BY Gioiosa Eau De Parfum Profumum Roma. Notes Pyramid Top Orange Bergamot Golden Mist Heart Jasmine Coconut Cream Vanilla Orchid Base Amber Vanilla Moss Vibe &amp; Wear Projection radiant. Scent Story Think sun-kissed coconut through jasmine petals, joyfully luminous.</p></body></html>`

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => gioiosaHtml,
    })
    vi.stubGlobal("fetch", fetchMock)

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when PDP bootstrap supplies Notes Pyramid")
    })

    const items: ScrapedItem[] = [
      {
        name: "Gioiosa Profumum Roma",
        description: noirOnly,
        image: "",
        detailURL:
          "https://www.andromedasmoon.com/products/andromedas-inspired-by-gioiosa-eau-de-parfum-profumum-roma",
        perfumeHouse: "Andromeda's Moon",
      },
    ]

    const { records } = await extractNotesForItems(items, "Andromeda's Moon", {
      generateNoirDescriptions: false,
      fetchPdpNoteBootstrap: true,
    })

    const open = JSON.parse(records[0].openNotes) as string[]
    const heart = JSON.parse(records[0].heartNotes) as string[]
    const base = JSON.parse(records[0].baseNotes) as string[]
    const all = [...open, ...heart, ...base]

    expect(open).toEqual(expect.arrayContaining(["orange", "bergamot"]))
    expect(open).not.toEqual(expect.arrayContaining(["moss"]))
    expect(heart).toEqual(
      expect.arrayContaining(["jasmine", "coconut cream", "vanilla orchid"]),
    )
    expect(base).toEqual(expect.arrayContaining(["amber", "vanilla", "moss"]))
    expect(all).not.toEqual(
      expect.arrayContaining(["green tea", "peony", "joyfully", "golden mist"]),
    )
    expect(fetchMock).toHaveBeenCalled()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("Andromedas Marshmallow Cloud Candy: Scent Profile middot list parses without LLM", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    const marshmallowPdp =
      "Andromeda's Marshmallow Cloud Candy Eau De Parfum Original Fragrance. Scent Profile Spun Sugar · Whipped Marshmallow · Creamy Vanilla · Warm Sweetness Vibe Soft, cozy, addictive. Fragrance Description A fluffy cloud of spun sugar and marshmallow. Wear It When You want a sweeter, smoother trail. Important Information Hand-poured."

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when Scent Profile bullet list is present")
    })

    const items: ScrapedItem[] = [
      {
        name: "Marshmallow Cloud Candy",
        description: marshmallowPdp,
        image: "",
        detailURL:
          "https://www.andromedasmoon.com/products/andromeda-s-marshmallow-cloud-candy-eau-de-parfum-original-fragrance",
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
    const all = [...open, ...heart, ...base]

    expect(open).toEqual(
      expect.arrayContaining([
        "spun sugar",
        "whipped marshmallow",
        "creamy vanilla",
      ]),
    )
    expect(all).not.toEqual(
      expect.arrayContaining([
        "sugary marshmallow clouds",
        "smoother",
        "warm sweetness",
        "sugary",
      ]),
    )
    expect(heart).toHaveLength(0)
    expect(base).toHaveLength(0)
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it("Andromedas Ruby Kajal: marketing adjectives after base notes do not bleed in", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    const rubyPdp =
      "Inspired by Ruby Eau De Parfum Kajal. Top Notes: Cherry, Red Berries, Pineapple, Coconut, Almond Heart Notes: Whipped Cream, Brown Sugar, Ice Cream Base Notes: Vanilla, Tonka Bean, Amber, Musk, Benzoin Whether you're lounging in a pastel candy diner, Ruby surrounds you in a delicious, flirtatious cloud that lasts all day. Sweet, Glamorous & Addictive Inspired by Ruby by Kajal ORIGINAL MANUFACTURERS"

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when Top/Heart/Base notes are present")
    })

    const items: ScrapedItem[] = [
      {
        name: "Ruby Kajal",
        description: rubyPdp,
        image: "",
        detailURL: "https://www.andromedasmoon.com/products/andromedas-inspired-by-ruby-eau-de-parfum-kajal",
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
    const all = [...open, ...heart, ...base]

    expect(open).toEqual(
      expect.arrayContaining(["cherry", "red berries", "pineapple", "coconut", "almond"]),
    )
    expect(heart).toEqual(expect.arrayContaining(["whipped cream", "brown sugar", "ice cream"]))
    expect(base).toEqual(
      expect.arrayContaining(["vanilla", "tonka bean", "amber", "musk", "benzoin"]),
    )
    expect(all).not.toEqual(
      expect.arrayContaining(["flirtatious", "glamorous", "ruby", "addictive"]),
    )
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it("Andromedas L Eau Papier: Notes then Description parses comma-less merchant list", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    const lEauPapierPdp =
      "Inspired by LEau Papier Eau De Parfum By Andromedas Moon Scent Type: Clean Musk Paper Soft Skin-Close Floral-Woody Notes:Musk White Musk Sesame Mimosa Blonde Woods Description:Like ink soaking into handmade paper, Inspired by LEau Papier melts into your skin with quiet grace. This scent is a delicate, minimalist poem - a whisper of soft white musks, milky sesame, and powdery mimosa. Clean and abstract, yet deeply comforting, it evokes the warmth of a sunlit studio filled with sketchbooks, rice steam, and memory. As the scent unfolds, it reveals a barely-there sweetness, like mimosa pollen dusting a page. Blonde woods add a gentle texture, grounding the fragrance in something soft and woody - like holding a well-loved novel close to your chest. Perfect for: Those who adore clean skin scents with artistic nuance."

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when Andromeda merchant notes are present")
    })

    const items: ScrapedItem[] = [
      {
        name: "L Eau Papier Diptyque",
        description: lEauPapierPdp,
        image: "",
        detailURL:
          "https://www.andromedasmoon.com/products/andromedas-inspired-by-leau-papier-eau-de-parfum-diptyque",
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
    const all = [...open, ...heart, ...base]

    expect(all).toEqual(
      expect.arrayContaining(["musk", "white musk", "sesame", "mimosa", "blonde woods"]),
    )
    expect(all).not.toEqual(expect.arrayContaining(["minimalist poem", "clean musk paper"]))
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it("Andromedas Yum Yum Dream: layered notes stop before sugar-dusted prose", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    const yumYumDreamPdp =
      "sprinkles - this dreamy, fruity gourmand is a carnival of flavor in perfume form! Top Notes: Banana, Apricot, Peach, Red Fruits Heart Notes: Strawberry, Coconut, Marshmallow, Vanilla Base Notes: Whipped Cream, Cookie Crust, Caramel, Toffee, Musk Like a sugar-dusted daydream, Yum Yum Dream melts juicy fruits into marshmallow swirls and creamy vanilla clouds."

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when Andromeda layered notes are present")
    })

    const items: ScrapedItem[] = [
      {
        name: "Yum Yum Dream",
        description: yumYumDreamPdp,
        image: "",
        detailURL: "https://www.andromedasmoon.com/products/andromedas-yum-yum-dream-eau-de-parfum",
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
    const all = [...open, ...heart, ...base]

    expect(open).toEqual(expect.arrayContaining(["banana", "apricot", "peach", "red fruits"]))
    expect(heart).toEqual(expect.arrayContaining(["strawberry", "coconut", "marshmallow", "vanilla"]))
    expect(base).toEqual(
      expect.arrayContaining(["whipped cream", "cookie crust", "caramel", "toffee", "musk"]),
    )
    expect(all).not.toEqual(
      expect.arrayContaining(["sprinkles this dreamy", "creamy vanilla clouds", "sugar-dusted daydream"]),
    )
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it("Andromedas Latte e Biscotti: layered notes stop before wrap-yourself and gourmand prose", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    const latteEBiscottiPdp =
      "Top Note: Fresh Baked Biscotti Heart Notes: Steamed Milk, Sugar Crystals Base Notes: Vanilla Cream, Cozy Woods Wrap yourself in the soft sweetness of Inspired by Latte e Biscotti - a fragrance that feels like fresh pastries, golden hour light, and cozy cafe conversations. The scent opens with the buttery crunch of almond biscotti, dipped into warm, frothy milk. As it melts into sugar-dusted vanilla cream, a soft whisper of wood grounds the experience - like the scent of a rustic coffee shop in the morning air. This perfume is pure comfort - milky, sugary, and a little bit dreamy. If you love cozy gourmands, nostalgic desserts, or just want to smell like the world's sweetest hug... this is it."

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when Andromeda layered notes are present")
    })

    const items: ScrapedItem[] = [
      {
        name: "Latte E Biscotti Cerchi Nellacqua",
        description: latteEBiscottiPdp,
        image: "",
        detailURL:
          "https://www.andromedasmoon.com/products/andromedas-inspired-by-guava-granita-eau-de-parfum-ellis-brooklyn",
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
    const all = [...open, ...heart, ...base]

    expect(open).toEqual(expect.arrayContaining(["fresh baked biscotti"]))
    expect(heart).toEqual(expect.arrayContaining(["steamed milk", "sugar crystals"]))
    expect(base).toEqual(expect.arrayContaining(["vanilla cream", "cozy woods"]))
    expect(all).not.toEqual(
      expect.arrayContaining(["cozy wood wrap yourself", "gourmands", "nostalgic desserts"]),
    )
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it("Andromedas Zucchero Filato: base notes stop before pastel dreams prose", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    const zuccheroFilatoPdp =
      "Top Notes: Spun Sugar, Bergamot, Heliotrope Heart Notes: Cotton Flower, Caramel, Almond Milk Base Notes: Vanilla, Powdered Musk, Soft Woods Float into a world spun from sugar clouds and pastel dreams with Inspired by Zucchero Filato Eau de Parfum - our interpretation of the cult-favorite from Cerchi Nell'Acqua. This fragrance captures the nostalgic magic of freshly spun cotton candy, elevated by sophisticated gourmand touches and a soft, powdery finish."

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when Andromeda layered notes are present")
    })

    const items: ScrapedItem[] = [
      {
        name: "Zucchero Filato Cerchi Nellacqua",
        description: zuccheroFilatoPdp,
        image: "",
        detailURL: "https://www.andromedasmoon.com/products/andromeda-s-inspired-by-zucchero-filato-eau-de-parfum",
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
    const all = [...open, ...heart, ...base]

    expect(open).toEqual(expect.arrayContaining(["spun sugar", "bergamot", "heliotrope"]))
    expect(heart).toEqual(expect.arrayContaining(["cotton flower", "caramel", "almond milk"]))
    expect(base).toEqual(expect.arrayContaining(["vanilla", "powdered musk", "soft woods"]))
    expect(all).not.toEqual(expect.arrayContaining(["pastel dreams with"]))
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it("Andromedas Vanilla Skin: notes stop before creamy softness prose", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    const vanillaSkinPdp =
      "Notes: Top: Pink Pepper, Apple Heart: Jasmine, Lily Base: Vanilla, Sandalwood, Sugar Wrap your senses in the warm, creamy softness of Inspired by Vanilla Skin, our interpretation of the beloved fragrance from Phlur. This enchanting Eau de Parfum blends comforting sweetness with a delicate touch of sensuality - like skin kissed by sun and sugar."

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when Andromeda layered notes are present")
    })

    const items: ScrapedItem[] = [
      {
        name: "Vanilla Skin Phlur",
        description: vanillaSkinPdp,
        image: "",
        detailURL: "https://www.andromedasmoon.com/products/andromeda-s-inspired-by-vanilla-skin-eau-de-parfum-phlur",
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
    const all = [...open, ...heart, ...base]

    expect(open).toEqual(expect.arrayContaining(["pink pepper", "apple"]))
    expect(heart).toEqual(expect.arrayContaining(["jasmine", "lily"]))
    expect(base).toEqual(expect.arrayContaining(["vanilla", "sandalwood", "sugar"]))
    expect(all).not.toEqual(expect.arrayContaining(["creamy softness of"]))
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it("Andromedas Not Vanilla: layer-label fragments and hand-blended tails are rejected", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    const notVanillaPdp =
      "Top - Camphor, Nutmeg, Bergamot Heart - Vanilla, Juniper Berries, Cedar, Violet Base - Praline, Cetalox, Musk, Guaiac Wood, Moss, Amber Hand-blended and bottled by Andromeda's Moon. Each bottle is made to order with care and intention."

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when Andromeda layered notes are present")
    })

    const items: ScrapedItem[] = [
      {
        name: "Not Vanilla Borntostandout",
        description: notVanillaPdp,
        image: "",
        detailURL:
          "https://www.andromedasmoon.com/products/andromedas-inspired-by-eladaria-eau-de-parfum-creed",
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
    const all = [...open, ...heart, ...base]

    expect(open).toEqual(expect.arrayContaining(["camphor", "nutmeg", "bergamot"]))
    expect(heart).toEqual(expect.arrayContaining(["vanilla", "juniper berries", "cedar", "violet"]))
    expect(base).toEqual(expect.arrayContaining(["praline", "cetalox", "musk", "guaiac wood", "moss", "amber"]))
    expect(all).not.toEqual(
      expect.arrayContaining(["top camphor", "bergamot heart", "violet base praline", "bottled by", "intention"]),
    )
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it("Andromedas Wavechild: emoji Top/Middle/Base notes of layers parse without LLM", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    const wavechildPdp =
      "Inspired by Wavechild Eau De Parfum Andromeda's Moon Originally by Room 1015 Dive into a neon splash. Top notes of mandarin orange, lemon, and fresh watermelon hit first. Middle notes of coconut and sea breeze wrap you in a haze. Base notes of amber, amberwood, cacao, and musk melt into skin. Why You'll Love It Bright. Tropical. Addictive."

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when Top/Middle/Base notes of layers are present")
    })

    const items: ScrapedItem[] = [
      {
        name: "Wavechild Room",
        description: wavechildPdp,
        image: "",
        detailURL:
          "https://www.andromedasmoon.com/products/andromedas-inspired-by-wavechild-eau-de-parfum-room-1015",
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
    const all = [...open, ...heart, ...base]

    expect(open).toEqual(expect.arrayContaining(["mandarin orange", "lemon", "fresh watermelon"]))
    expect(heart).toEqual(expect.arrayContaining(["coconut", "sea breeze"]))
    expect(base).toEqual(expect.arrayContaining(["amber", "amberwood", "cacao", "musk"]))
    expect(all).not.toEqual(expect.arrayContaining(["middle notes", "base notes are ebony"]))
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it("relayers flat openNotes when layer markers were comma-glued (Wavechild CSV bleed)", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when enrichOnly relayers embedded markers")
    })

    const items: ScrapedItem[] = [
      {
        name: "Wavechild Room",
        description: "Marketing prose only.",
        image: "",
        detailURL:
          "https://www.andromedasmoon.com/products/andromedas-inspired-by-wavechild-eau-de-parfum-room-1015",
        perfumeHouse: "Andromeda's Moon",
        openNotes: [
          "bright citrus",
          "beach nights",
          "caramel",
          "hawthorn",
          "middle notes",
          "madagascar vanilla",
          "night blooming cereus",
          "base notes are ebony",
          "benzoin",
          "musk",
          "ambergris",
          "madagascar vetiver",
        ],
        heartNotes: [],
        baseNotes: [],
      },
    ]

    const { records } = await extractNotesForItems(items, "Andromeda's Moon", {
      generateNoirDescriptions: false,
      enrichOnly: true,
      fetchPdpNoteBootstrap: false,
    })

    const open = JSON.parse(records[0].openNotes) as string[]
    const heart = JSON.parse(records[0].heartNotes) as string[]
    const base = JSON.parse(records[0].baseNotes) as string[]
    const all = [...open, ...heart, ...base]

    expect(open).toEqual(expect.arrayContaining(["bright citrus", "caramel", "hawthorn"]))
    expect(heart).toEqual(expect.arrayContaining(["madagascar vanilla", "night blooming cereus"]))
    expect(base).toEqual(
      expect.arrayContaining(["ebony", "benzoin", "musk", "ambergris", "madagascar vetiver"]),
    )
    expect(all).not.toEqual(expect.arrayContaining(["middle notes", "base notes are ebony"]))
  })

  it("stripPolicyBoilerplate truncates Processing/Packing/Shipping trail", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    /**
     * Mirrors line 34 of the CSV — real scent narrative + structured notes + trailing
     * "Processing: AT LEAST 7 business days... no changes, no cancellations..." boilerplate.
     * After processing, the description retains the scent narrative but drops everything from
     * "Processing:" onward.
     */
    const realDesc =
      "A golden overdose of vanilla wrapped in amber warmth. Plush vanilla bean, softly powdered, and balsamic resins. A smooth musk veil lingers in the background."
    const desc = `${realDesc} Processing: AT LEAST 7 business days and COULD TAKE LONGER. Packing: Hand-filled and inspected. Shipping & Insurance: USPS/UPS include up to $100 insurance automatically. Once an order is placed, there are no changes, no cancellations, and no refunds.`
    invokeMock.mockImplementation(() => ({
      content: '{"openNotes":["vanilla"],"heartNotes":["amber"],"baseNotes":["musk"]}',
    }))
    const items: ScrapedItem[] = [
      {
        name: "Vanille Planifolia",
        description: desc,
        image: "",
        detailURL: "",
        perfumeHouse: "Andromedas Moon",
      },
    ]
    const { records } = await extractNotesForItems(items, "Andromedas Moon", {
      generateNoirDescriptions: false,
      fetchPdpNoteBootstrap: false,
      noteInferenceMode: "strict",
    })
    const d = records[0].description
    // Real narrative preserved
    expect(d).toMatch(/golden overdose|plush vanilla bean|musk veil/i)
    // Policy trail dropped
    expect(d).not.toMatch(/processing\s*:/i)
    expect(d).not.toMatch(/no\s+changes/i)
    expect(d).not.toMatch(/usps?\s*\/?\s*ups/i)
    expect(d).not.toMatch(/business days/i)
  })

  it("bulk LLM validator fails open when the call errors", async () => {
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "llm")
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    /**
     * First call: extraction returns real notes. Second call (validator): throws. Pipeline must
     * preserve the original notes — validator outages should never drop notes.
     */
    let call = 0
    invokeMock.mockImplementation(() => {
      call++
      if (call === 1) return { content: '{"openNotes":["bergamot"],"heartNotes":["rose"],"baseNotes":["sandalwood"]}' }
      throw new Error("Simulated validator outage")
    })

    const items: ScrapedItem[] = [
      {
        name: "Outage Product",
        description: "Description hinting at bergamot, rose, and sandalwood.",
        image: "",
        detailURL: "",
        perfumeHouse: "House",
      },
    ]
    const { records } = await extractNotesForItems(items, "House", {
      generateNoirDescriptions: false,
      fetchPdpNoteBootstrap: false,
    })

    expect(JSON.parse(records[0].openNotes)).toEqual(["bergamot"])
    expect(JSON.parse(records[0].heartNotes)).toEqual(["rose"])
    expect(JSON.parse(records[0].baseNotes)).toEqual(["sandalwood"])
  })

  it("expands parenthetical accord materials into separate notes without parentheses", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    const items: ScrapedItem[] = [
      {
        name: "Mezcal & Masa",
        description: `Top: pineapple sage accord
Heart: roasted corn, smokey mezcal accord
Base: mesoamerican incense (copal & palo santo), south american wood (guaiacwood & vetiver)`,
        image: "",
        detailURL: "https://aetherartsperfume.patternbyetsy.com/listing/4299882856/mezcal-masa",
        perfumeHouse: "Aether Arts",
      },
    ]

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when layered parenthetical notes parse cleanly")
    })

    const { records } = await extractNotesForItems(items, "Aether Arts", {
      generateNoirDescriptions: false,
    })

    const base = JSON.parse(records[0].baseNotes) as string[]
    expect(base).toEqual(
      expect.arrayContaining(["copal", "palo santo", "guaiacwood", "vetiver", "mesoamerican incense"]),
    )
    expect(base.some(n => n.includes("("))).toBe(false)
  })

  it("Pattern/Etsy Top and Middle note lines in boilerplate description extract without LLM", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    const items: ScrapedItem[] = [
      {
        name: "Earthrise",
        description: `Original, Artisan Perfumes, Unique ScentsArt in Air
The Scent StoryThey say an image is worth a thousand words.
Top Notes: Atmosphere and Ocean Accord (Ozone, Salt Water)
Middle Notes: Verdant Earth Accord (Rich Soil, Green and Flowering Plants)`,
        image: "",
        detailURL:
          "https://aetherartsperfume.patternbyetsy.com/listing/1196922082/earthrise-an-homage-to-earth-day-and-a",
        perfumeHouse: "Aether Arts",
      },
    ]

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when Top/Middle note lines are present")
    })

    const { records } = await extractNotesForItems(items, "Aether Arts", {
      generateNoirDescriptions: false,
    })

    const open = JSON.parse(records[0].openNotes) as string[]
    const heart = JSON.parse(records[0].heartNotes) as string[]
    expect(open).toEqual(expect.arrayContaining(["ozone", "salt water"]))
    expect(heart).toEqual(expect.arrayContaining(["rich soil", "green and flowering plants"]))
    expect([...open, ...heart].some(n => n.includes("("))).toBe(false)
    expect(records[0].description).toBe("")
  })

  it("prefers full Etsy listing slug when scraped title truncates before the number", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    const items: ScrapedItem[] = [
      {
        name: "Burner Perfume No",
        description: NOTES_TEXT_NO_LLM,
        image: "",
        detailURL:
          "https://aetherartsperfume.patternbyetsy.com/listing/623994128/burner-perfume-no9b-android-a-future",
        perfumeHouse: "Aether Arts",
      },
    ]

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run for simple layered notes")
    })

    const { records } = await extractNotesForItems(items, "Aether Arts", {
      generateNoirDescriptions: false,
    })

    expect(records[0].name).toMatch(/Burner Perfume No\.?\s*9B/i)
    expect(records[0].name).not.toBe("Burner Perfume No")
  })

  it("Zarafa: merges Note Structure accords with explicit materials from prose and title", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    const items: ScrapedItem[] = [
      {
        name:
          "Zarafa, a Giraffe-inspired, Animalic-Foral perfume with notes of Bergamot, Orange, Honey, Orange Blosson, Jasmine, Saffron, Turmeric, Musk",
        description: `The Scent Story I created an animalic-floral with a honey-musk base. Notes of Bergamot, Orange, Turmeric, and Saffron give the scent a tawny, opening glow that mimics the colors of the giraffe's coat. Rich, indolic florals follow: Orange Blossom and Jasmine Absolute. A touch of Liatrix adds a subtle grass note. A lavish Honey-Musk accord with a bit of Amber completes the composition.
Note Structure: Top Notes: Tawny Coat Accord Middle Notes: Indolic Floral Accord Base Notes: Honey-Musk Accord Series: No`,
        image: "",
        detailURL:
          "https://aetherartsperfume.patternbyetsy.com/listing/1702274035/zarafa-a-giraffe-inspired-animalic-foral",
        perfumeHouse: "Aether Arts",
      },
    ]

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when Note Structure and explicit materials are present")
    })

    const { records } = await extractNotesForItems(items, "Aether Arts", {
      generateNoirDescriptions: false,
    })

    const open = JSON.parse(records[0].openNotes) as string[]
    const heart = JSON.parse(records[0].heartNotes) as string[]
    const base = JSON.parse(records[0].baseNotes) as string[]
    expect(open).toEqual(
      expect.arrayContaining([
        "bergamot",
        "orange",
        "turmeric",
        "saffron",
        "tawny coat accord",
      ]),
    )
    expect(heart).toEqual(
      expect.arrayContaining(["orange blossom", "jasmine absolute", "indolic floral accord"]),
    )
    expect(base).toEqual(
      expect.arrayContaining(["honey-musk accord", "amber", "liatrix"]),
    )
  })

  it("Mayan Chocolate: Note Structure pyramid beats noir-only prose contamination", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    const items: ScrapedItem[] = [
      {
        name: "Mayan Chocolate, An Exotic, Spicy, Green, Chocolate Perfume Inspired By The Jungles Of Mesoamerica Where The Cacao Tree Grows",
        description: `Footsteps echo softly on damp stone as hints of rich cacao rise like steam. Notes of lush jungle greenery intermingle with a haunting orchid accord, weaving through the heavy scent of incense.
Note Structure: Top Notes: Chilies and Spice Accord Middle Notes: Green Jungle and Orchid Accord Base Notes: Rich Chocolate, Exotic Woods and Incense Accord Series: No`,
        image: "",
        detailURL:
          "https://aetherartsperfume.patternbyetsy.com/listing/1043798530/mayan-chocolate-an-exotic-spicy-green",
        perfumeHouse: "Aether Arts",
      },
    ]

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when merchant Note Structure is in the source text")
    })

    const { records } = await extractNotesForItems(items, "Aether Arts", {
      generateNoirDescriptions: false,
    })

    const open = JSON.parse(records[0].openNotes) as string[]
    const heart = JSON.parse(records[0].heartNotes) as string[]
    const base = JSON.parse(records[0].baseNotes) as string[]
    expect(open).toEqual(expect.arrayContaining(["chilies and spice accord"]))
    expect(heart).toEqual(expect.arrayContaining(["green jungle and orchid accord"]))
    expect(base).toEqual(
      expect.arrayContaining(["rich chocolate", "exotic wood and incense accord"]),
    )
    expect(open).not.toEqual(expect.arrayContaining(["orchid accord"]))
    expect(base).not.toEqual(expect.arrayContaining(["orchid accord"]))
  })

  it("mergeFlatMaterialsIntoLayeredPyramid keeps accord layers and adds missing flat materials", () => {
    const merged = mergeFlatMaterialsIntoLayeredPyramid(
      {
        openNotes: ["tawny coat accord"],
        heartNotes: ["indolic floral accord"],
        baseNotes: ["honey-musk accord"],
      },
      ["bergamot", "orange", "turmeric", "saffron", "tawny coat accord"],
    )
    expect(merged.openNotes).toEqual(
      expect.arrayContaining(["tawny coat accord", "bergamot", "orange", "turmeric", "saffron"]),
    )
    expect(merged.heartNotes).toEqual(["indolic floral accord"])
    expect(merged.baseNotes).toEqual(["honey-musk accord"])
  })

  it("enrichOnly merges thin Python accord pyramid with explicit materials from description", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")

    const items: ScrapedItem[] = [
      {
        name:
          "Zarafa, a Giraffe-inspired, Animalic-Foral perfume with notes of Bergamot, Orange, Honey, Orange Blosson, Jasmine, Saffron, Turmeric, Musk",
        description: `Notes of Bergamot, Orange, Turmeric, and Saffron give the scent a tawny glow. Rich, indolic florals follow: Orange Blossom and Jasmine Absolute. A touch of Liatrix adds a subtle grass note. A lavish Honey-Musk accord with a bit of Amber completes the composition.
Note Structure: Top Notes: Tawny Coat Accord Middle Notes: Indolic Floral Accord Base Notes: Honey-Musk Accord Series: No`,
        image: "",
        detailURL:
          "https://aetherartsperfume.patternbyetsy.com/listing/1702274035/zarafa-a-giraffe-inspired-animalic-foral",
        perfumeHouse: "Aether Arts",
        openNotes: ["tawny coat accord"],
        heartNotes: ["indolic floral accord"],
        baseNotes: ["honey-musk accord"],
      },
    ]

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when enrichOnly merges merchant structure")
    })

    const { records } = await extractNotesForItems(items, "Aether Arts", {
      generateNoirDescriptions: false,
      enrichOnly: true,
    })

    const open = JSON.parse(records[0].openNotes) as string[]
    const heart = JSON.parse(records[0].heartNotes) as string[]
    const base = JSON.parse(records[0].baseNotes) as string[]
    expect(open).toEqual(
      expect.arrayContaining(["tawny coat accord", "bergamot", "orange", "turmeric", "saffron"]),
    )
    expect(heart).toEqual(
      expect.arrayContaining(["indolic floral accord", "orange blossom", "jasmine absolute"]),
    )
    expect(base).toEqual(
      expect.arrayContaining(["honey-musk accord", "amber", "liatrix"]),
    )
  })
})

describe("scrapedItemsNeedPatternEtsyEnrichment", () => {
  it("flags thin Pattern/Etsy pyramids and skips rich or non-Pattern listings", () => {
    expect(
      scrapedItemsNeedPatternEtsyEnrichment([
        {
          name: "Zarafa",
          description: "",
          image: "",
          detailURL:
            "https://aetherartsperfume.patternbyetsy.com/listing/1702274035/zarafa",
          openNotes: ["accord a"],
          heartNotes: ["accord b"],
          baseNotes: ["accord c"],
        },
      ]),
    ).toBe(true)

    expect(
      scrapedItemsNeedPatternEtsyEnrichment([
        {
          name: "Zarafa",
          description: "",
          image: "",
          detailURL:
            "https://aetherartsperfume.patternbyetsy.com/listing/1702274035/zarafa",
          openNotes: ["a", "b", "c", "d"],
          heartNotes: ["e", "f"],
          baseNotes: ["g"],
        },
      ]),
    ).toBe(false)

    expect(
      scrapedItemsNeedPatternEtsyEnrichment([
        {
          name: "Shopify scent",
          description: "",
          image: "",
          detailURL: "https://example.com/products/foo",
          openNotes: ["rose"],
          heartNotes: [],
          baseNotes: [],
        },
      ]),
    ).toBe(false)
  })
})

describe("Vivamor Parfums (WooCommerce OLFACTORY NOTES pyramid)", () => {
  const VIVAMOR_AURA_DESCRIPTION =
    "Aura Celeste (100ml) exudes elegance and modernity where the freshness from the Calabrian bergamot, Spanish lemon and Flordian grapefruit is perfectly balanced with Brazilian rosewood, Madagascan black pepper, Egyptian jasmin and Guatemalan cardamom. The base of Madagascan vanilla , Indian olibanum, amber and Tibetan musk add depth to the fragrance lasting through the day."

  const VIVAMOR_AURA_PYRAMID = `OLFACTORY NOTES

Top Notes:
Calabrian Bergamot & Spanish Lemon

Heart Notes:
Brazilian Rosewood, Egyptian Jasmine, Madagascan Black Pepper, Floridian Grapefruit & Guatemalan Cardamom

Base Notes:
Indian Olibanum, Amber, Madagascan Vanilla & Tibetan Musk

Description

PRODUCT REVIEWS & VIDEOS

Related products
Spicy Nights Uncategorized $155 $101.50`

  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "test-key")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")
    invokeMock.mockReset()
    invokeMock.mockImplementation(() => {
      throw new Error("LLM must not run when Vivamor OLFACTORY NOTES pyramid is present")
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("extracts full Top/Heart/Base pyramid and drops reviews/related-products bleed", async () => {
    const notesText = `${VIVAMOR_AURA_DESCRIPTION}\n\n${VIVAMOR_AURA_PYRAMID}`

    const items: ScrapedItem[] = [
      {
        name: "Aura Celeste",
        description: notesText,
        notesText,
        image: "https://vivamorparfums.com/wp-content/uploads/2022/10/Aura-Celeste.jpg",
        detailURL: "https://vivamorparfums.com/store/aura-celeste/",
        perfumeHouse: "Vivamor",
      },
    ]

    const { records } = await extractNotesForItems(items, "Vivamor", { generateNoirDescriptions: false })

    expect(invokeMock).not.toHaveBeenCalled()
    const open = JSON.parse(records[0].openNotes) as string[]
    const heart = JSON.parse(records[0].heartNotes) as string[]
    const base = JSON.parse(records[0].baseNotes) as string[]

    expect(open).toEqual(expect.arrayContaining(["calabrian bergamot", "spanish lemon"]))
    expect(heart).toEqual(
      expect.arrayContaining([
        "brazilian rosewood",
        "egyptian jasmine",
        "madagascan black pepper",
        "floridian grapefruit",
        "guatemalan cardamom",
      ]),
    )
    expect(base).toEqual(
      expect.arrayContaining(["indian olibanum", "amber", "madagascan vanilla", "tibetan musk"]),
    )

    const all = [...open, ...heart, ...base]
    expect(all).not.toEqual(expect.arrayContaining(["videos", "videos related products"]))
    expect(all.some(n => /related products|product reviews|captivate your senses/i.test(n))).toBe(false)
  })

  it("description-only scrape (no accordion tab): auto-fetches WooCommerce /store/ pyramid", async () => {
    const htmlSnippet = `<h5>Top Notes:</h5><p>Calabrian Bergamot &amp; Spanish Lemon</p>
<h5>Heart Notes:</h5><p>Brazilian Rosewood, Egyptian Jasmine, Madagascan Black Pepper, Floridian Grapefruit &amp; Guatemalan Cardamom</p>
<h5>Base Notes:</h5><p>Indian Olibanum, Amber, Madagascan Vanilla &amp; Tibetan Musk</p>
<h2 class="rev-title">PRODUCT REVIEWS & VIDEOS</h2>`

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      text: async () => htmlSnippet,
    } as Response)

    try {
      const items: ScrapedItem[] = [
        {
          name: "Aura Celeste",
          description: VIVAMOR_AURA_DESCRIPTION,
          notesText: VIVAMOR_AURA_DESCRIPTION,
          image: "https://vivamorparfums.com/wp-content/uploads/2022/10/Aura-Celeste.jpg",
          detailURL: "https://vivamorparfums.com/store/aura-celeste/",
          perfumeHouse: "Vivamor",
        },
      ]

      const { records } = await extractNotesForItems(items, "Vivamor", { generateNoirDescriptions: false })

      expect(fetchMock).toHaveBeenCalled()
      const open = JSON.parse(records[0].openNotes) as string[]
      const heart = JSON.parse(records[0].heartNotes) as string[]
      const base = JSON.parse(records[0].baseNotes) as string[]
      const all = [...open, ...heart, ...base]

      expect(all).toEqual(
        expect.arrayContaining([
          "calabrian bergamot",
          "spanish lemon",
          "brazilian rosewood",
          "indian olibanum",
        ]),
      )
    } finally {
      fetchMock.mockRestore()
    }
  })

  it("Crème Exquis collapsed accordion (headers only): still fetches full pyramid", async () => {
    const description =
      "Creme Exquis (100ml) is a sophisticated and seductive scent leaving an impactful trail making a statement. Opening with iris and a black cherry accord, Creme Exquis captures attention from the first spray. A unique blend of chocolate, caramel and floral orchid continue to mesmerize the wearer with the base having a balance of coffee. Honey, oak tree absolute, Tahitian vanilla and Ceylon Cinnamon."

    const collapsedAccordion = `${description}

OLFACTORY NOTES

Top Notes:

Heart Notes:

Base Notes:

Description

PRODUCT REVIEWS & VIDEOS`

    const htmlSnippet = `<h5>Top Notes:</h5><p>Brazilian Orange, Iris &amp; Black Cherry Accord</p>
<h5>Heart Notes:</h5><p>Floral Orchid, Chocolate &amp; Caramel</p>
<h5>Base Notes:</h5><p>Tahitian Vanilla, Coffee, Honey, Oak Tree Absolute &amp; Ceylon Cinnamon</p>`

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      text: async () => htmlSnippet,
    } as Response)

    invokeMock.mockImplementation(async (messages: unknown) => {
      const msgs = messages as { role: string; content: string }[]
      const sys = msgs.find(m => m.role === "system")?.content ?? ""
      if (sys.includes("perfumery expert")) {
        return {
          content: JSON.stringify({
            valid: [
              { in: "brazilian orange", out: "brazilian orange" },
              { in: "iris", out: "iris" },
              { in: "black cherry accord", out: "black cherry accord" },
              { in: "floral orchid", out: "floral orchid" },
              { in: "chocolate", out: "chocolate" },
              { in: "caramel", out: "caramel" },
              { in: "tahitian vanilla", out: "tahitian vanilla" },
              { in: "coffee", out: "coffee" },
              { in: "honey", out: "honey" },
              { in: "oak tree absolute", out: "oak tree absolute" },
              { in: "ceylon cinnamon", out: "ceylon cinnamon" },
            ],
          }),
        }
      }
      throw new Error(`Unexpected LLM call: ${sys.slice(0, 80)}`)
    })

    try {
      const items: ScrapedItem[] = [
        {
          name: "Crème Exquis",
          description: collapsedAccordion,
          notesText: collapsedAccordion,
          image: "https://vivamorparfums.com/wp-content/uploads/2022/10/Creme-Exquis.jpg",
          detailURL: "https://vivamorparfums.com/store/creme-exquis/",
          perfumeHouse: "Vivamor",
        },
      ]

      const { records } = await extractNotesForItems(items, "Vivamor", {
        generateNoirDescriptions: false,
        noteValidationMode: "llm",
      })

      expect(fetchMock).toHaveBeenCalled()
      const open = JSON.parse(records[0].openNotes) as string[]
      const heart = JSON.parse(records[0].heartNotes) as string[]
      const base = JSON.parse(records[0].baseNotes) as string[]

      expect(open).toContain("brazilian orange")
      expect(heart).toContain("floral orchid")
      expect(base).toContain("tahitian vanilla")
    } finally {
      fetchMock.mockRestore()
    }
  })

  it("Crème Exquis description-only: auto-fetch pyramid includes first note per layer", async () => {
    const description =
      "Creme Exquis (100ml) is a sophisticated and seductive scent leaving an impactful trail making a statement. Opening with iris and a black cherry accord, Creme Exquis captures attention from the first spray. A unique blend of chocolate, caramel and floral orchid continue to mesmerize the wearer with the base having a balance of coffee. Honey, oak tree absolute, Tahitian vanilla and Ceylon Cinnamon."

    const htmlSnippet = `<h5>Top Notes:</h5><p>Brazilian Orange, Iris &amp; Black Cherry Accord</p>
<h5>Heart Notes:</h5><p>Floral Orchid, Chocolate &amp; Caramel</p>
<h5>Base Notes:</h5><p>Tahitian Vanilla, Coffee, Honey, Oak Tree Absolute &amp; Ceylon Cinnamon</p>`

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      text: async () => htmlSnippet,
    } as Response)

    try {
      const items: ScrapedItem[] = [
        {
          name: "Crème Exquis",
          description,
          notesText: description,
          image: "https://vivamorparfums.com/wp-content/uploads/2022/10/Creme-Exquis.jpg",
          detailURL: "https://vivamorparfums.com/store/creme-exquis/",
          perfumeHouse: "Vivamor",
        },
      ]

      const { records } = await extractNotesForItems(items, "Vivamor", {
        generateNoirDescriptions: false,
        noteValidationMode: "llm",
      })

      const open = JSON.parse(records[0].openNotes) as string[]
      const heart = JSON.parse(records[0].heartNotes) as string[]
      const base = JSON.parse(records[0].baseNotes) as string[]

      expect(open).toContain("brazilian orange")
      expect(heart).toContain("floral orchid")
      expect(base).toContain("tahitian vanilla")
    } finally {
      fetchMock.mockRestore()
    }
  })

  it("Crème Exquis: keeps first note in each Vivamor layer (Brazilian Orange, Floral Orchid, Tahitian Vanilla)", async () => {
    const description =
      "Creme Exquis (100ml) is a sophisticated and seductive scent leaving an impactful trail making a statement. Opening with iris and a black cherry accord, Creme Exquis captures attention from the first spray. A unique blend of chocolate, caramel and floral orchid continue to mesmerize the wearer with the base having a balance of coffee. Honey, oak tree absolute, Tahitian vanilla and Ceylon Cinnamon."

    const pyramid = `OLFACTORY NOTES

Top Notes:
Brazilian Orange, Iris & Black Cherry Accord

Heart Notes:
Floral Orchid, Chocolate & Caramel

Base Notes:
Tahitian Vanilla, Coffee, Honey, Oak Tree Absolute & Ceylon Cinnamon`

    const notesText = `${description}\n\n${pyramid}`

    const items: ScrapedItem[] = [
      {
        name: "Crème Exquis",
        description: notesText,
        notesText,
        image: "https://vivamorparfums.com/wp-content/uploads/2022/10/Creme-Exquis.jpg",
        detailURL: "https://vivamorparfums.com/store/creme-exquis/",
        perfumeHouse: "Vivamor",
      },
    ]

    const { records } = await extractNotesForItems(items, "Vivamor", { generateNoirDescriptions: false })

    const open = JSON.parse(records[0].openNotes) as string[]
    const heart = JSON.parse(records[0].heartNotes) as string[]
    const base = JSON.parse(records[0].baseNotes) as string[]

    expect(open).toEqual(
      expect.arrayContaining(["brazilian orange", "iris", "black cherry accord"]),
    )
    expect(heart).toEqual(
      expect.arrayContaining(["floral orchid", "chocolate", "caramel"]),
    )
    expect(base).toEqual(
      expect.arrayContaining([
        "tahitian vanilla",
        "coffee",
        "honey",
        "oak tree absolute",
        "ceylon cinnamon",
      ]),
    )
  })

  it("omits shop/collection listing rows mistaken for products", async () => {
    const items: ScrapedItem[] = [
      {
        name: "Store",
        description:
          "Showing 112 of 39 results Default sorting Add to cart Addiction Absolu $155 Add to cart Akoya $155",
        image: "https://vivamorparfums.com/wp-content/uploads/2022/10/Ultimate-Aphrodisiac-Image-2.png",
        detailURL: "https://vivamorparfums.com/about-us",
        perfumeHouse: "Vivamor",
      },
      {
        name: "Aura Celeste",
        description: VIVAMOR_AURA_DESCRIPTION,
        notesText: `${VIVAMOR_AURA_DESCRIPTION}\n\n${VIVAMOR_AURA_PYRAMID}`,
        image: "https://vivamorparfums.com/wp-content/uploads/2022/10/Aura-Celeste.jpg",
        detailURL: "https://vivamorparfums.com/store/aura-celeste/",
        perfumeHouse: "Vivamor",
      },
    ]

    const { records } = await extractNotesForItems(items, "Vivamor", { generateNoirDescriptions: false })

    expect(records).toHaveLength(1)
    expect(records[0].name).toBe("Aura Celeste")
  })
})

describe("Etat Libre d'Orange description cleanup", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "test-key")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    invokeMock.mockReset()
  })

  const TEASER =
    "interested in trying a sample? Try In a 4 Piece Sample Kit Fresh The brainchild of Chandler Burr, discerning New York Times Perfume Critic and author of the namesake novel, You Or Someone Like You is dedicated to his novels main character, Anne."

  it("normalizePdpDescription strips sample-kit prefix and family tags", () => {
    const cleaned = normalizePdpDescription(TEASER)
    expect(cleaned.toLowerCase()).not.toMatch(/^interested in trying/)
    expect(cleaned.toLowerCase()).toContain("chandler burr")
  })

  it("isUnusableMerchantDescription flags teaser blobs and truncated FULL DES tails", () => {
    expect(isUnusableMerchantDescription(TEASER)).toBe(true)
    expect(isUnusableMerchantDescription("Divin'enfant FULL DESCRIP")).toBe(true)
    expect(isUnusableMerchantDescription("")).toBe(true)
  })

  it("stripEtatLibreUiNoise removes Woody, Spicy family tag prefixes", () => {
    const out = stripEtatLibreUiNoise("Woody, Spicy A tribute to Marquis de Sade, the father of sadism.")
    expect(out).toMatch(/^A tribute to Marquis de Sade/)
  })

  it("collections PDP URLs are treated as perfume pages", () => {
    const url = "https://etatlibredorange.us/collections/fragrances/products/secretions-magnifiques"
    expect(isEtatLibreProductUrl(url)).toBe(true)
    expect(detailUrlAlignsWithProductName("Secretions Magnifiques", url)).toBe(true)
  })

  it("scrapedItemsNeedNodeRepair triggers on sample-kit description bleed", () => {
    const items: ScrapedItem[] = [
      {
        name: "Jasmin Et Cigarette",
        description: TEASER,
        image: "",
        detailURL: "https://etatlibredorange.us/collections/fragrances/products/jasmin-et-cigarette",
        perfumeHouse: "Etat Libre d'Orange",
        openNotes: ["jasmine absolute"],
        heartNotes: [],
        baseNotes: [],
      },
    ]
    expect(scrapedItemsNeedNodeRepair(items)).toBe(true)
  })

  it("Etat Libre repair pass backfills FULL DESCRIPTION and generates noir", async () => {
    const html = `<html><body>
<h3>FULL DESCRIPTION</h3>
<p>True olfactory coitus, Magnificent Secretions takes us to the summit of jouissance.</p>
<h3>MAIN NOTES</h3>
<p>iris, coconut, sandalwood, opoponax</p>
</body></html>`

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(html, { status: 200, headers: { "content-type": "text/html" } }),
    )

    const items: ScrapedItem[] = [
      {
        name: "Secretions Magnifiques",
        description: TEASER,
        image: "",
        detailURL: "https://etatlibredorange.us/collections/fragrances/products/secretions-magnifiques",
        perfumeHouse: "Etat Libre d'Orange",
        openNotes: ["iris", "coconut", "sandalwood", "opoponax"],
        heartNotes: [],
        baseNotes: [],
      },
    ]

    invokeMock.mockResolvedValue({
      content: "Neon rain slicks the alley as iris and sandalwood cling to skin like a dangerous secret.",
    })

    const { records } = await extractNotesForItems(items, "Etat Libre d'Orange", {
      enrichOnly: true,
      generateNoirDescriptions: true,
      noteValidationMode: "off",
    })

    expect(fetchMock).toHaveBeenCalled()
    expect(records[0].description.toLowerCase()).not.toMatch(/^interested in trying/)
    expect(records[0].description.toLowerCase()).toContain("iris")
    expect(records[0].description.length).toBeGreaterThan(40)
    fetchMock.mockRestore()
  })

  it("Matiere Premiere: CREATIVE APPROACH PDP bootstrap extracts materials and drops theme CSS bleed", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "off")

    const cssBleed = "gradient color color-badge payment-terms"
    const falconHtml = `<html><body><div class="product__description">
INITIAL IDEA: "Create a leathery scent inspired by falconers' gloves"
MAIN INGREDIENT: A vegetal leather note, Birch Tar Finland.
CREATIVE APPROACH: Exacerbate the power of the note at the start thanks to Saffron. Unfold and enrich the texture of Birch Tar to evoke both sides of leather: highlight the smooth full-grain side with Ciste Labdanum Andalusia, amplify the soft suede side with Benzoin Absolute Laos.
Available sizes: Eau de parfum 100ml spray
</div></body></html>`

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("falcon-leather")) {
        return new Response(falconHtml, { status: 200, headers: { "content-type": "text/html" } })
      }
      return new Response("", { status: 404 })
    })

    invokeMock.mockImplementation(() => {
      throw new Error("LLM should not run when Matiere Premiere CREATIVE APPROACH parses from PDP")
    })

    const items: ScrapedItem[] = [
      {
        name: "Falcon Leather",
        description: cssBleed,
        image: "",
        detailURL: "https://matiere-premiere.us/products/falcon-leather",
        perfumeHouse: "Matiere Premiere",
      },
    ]

    const { records } = await extractNotesForItems(items, "Matiere Premiere", {
      generateNoirDescriptions: false,
    })

    const open = JSON.parse(records[0].openNotes) as string[]
    const heart = JSON.parse(records[0].heartNotes) as string[]
    const base = JSON.parse(records[0].baseNotes) as string[]
    const all = [...open, ...heart, ...base]

    expect(fetchMock).toHaveBeenCalled()
    expect(all).toEqual(expect.arrayContaining(["saffron", "birch tar", "ciste labdanum andalusia", "benzoin absolute laos"]))
    expect(all).not.toEqual(expect.arrayContaining(["gradient", "color", "color-badge", "payment-terms"]))
    expect(records[0]._noteSource).not.toBe("empty")

    fetchMock.mockRestore()
  })

  it("Matiere Premiere: LLM validator preserves CREATIVE APPROACH merchant materials", async () => {
    vi.stubEnv("NOTES_PIPELINE_CONCURRENCY", "1")
    vi.stubEnv("NOTES_PIPELINE_VALIDATION", "llm")

    const cssBleed = "gradient color color-badge payment-terms"
    const falconHtml = `<html><body><div class="product__description">
MAIN INGREDIENT: A vegetal leather note, Birch Tar Finland.
CREATIVE APPROACH: Exacerbate the power of the note at the start thanks to Saffron. Unfold and enrich the texture of Birch Tar to evoke both sides of leather: highlight the smooth full-grain side with Ciste Labdanum Andalusia, amplify the soft suede side with Benzoin Absolute Laos.
</div></body></html>`

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).includes("falcon-leather")) {
        return new Response(falconHtml, { status: 200, headers: { "content-type": "text/html" } })
      }
      return new Response("", { status: 404 })
    })

    let call = 0
    invokeMock.mockImplementation(() => {
      call++
      if (call === 1) {
        return {
          content:
            '{"valid":[{"in":"birch tar finland","out":"birch tar finland"},{"in":"saffron","out":"saffron"},{"in":"birch tar","out":"birch tar"},{"in":"ciste labdanum andalusia","out":"ciste labdanum andalusia"},{"in":"benzoin absolute laos","out":"benzoin absolute laos"}]}',
        }
      }
      throw new Error("LLM extraction should not run")
    })

    const items: ScrapedItem[] = [
      {
        name: "Falcon Leather",
        description: cssBleed,
        image: "",
        detailURL: "https://matiere-premiere.us/products/falcon-leather",
        perfumeHouse: "Matiere Premiere",
      },
    ]

    const { records } = await extractNotesForItems(items, "Matiere Premiere", {
      generateNoirDescriptions: false,
    })

    const all = [
      ...(JSON.parse(records[0].openNotes) as string[]),
      ...(JSON.parse(records[0].heartNotes) as string[]),
      ...(JSON.parse(records[0].baseNotes) as string[]),
    ]
    expect(all).toEqual(
      expect.arrayContaining(["saffron", "ciste labdanum andalusia", "benzoin absolute laos"]),
    )
    expect(all.length).toBeGreaterThanOrEqual(4)

    fetchMock.mockRestore()
  })

  it("rejects Shopify theme CSS tokens mistaken for notes", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key")
    const cssBleed =
      ":root { --light-: #fff; --button-: #000; --header-: #111; --newsletter-popup-: 1; --product-badge-: red; } " +
      ".secondary-elements, .footer, .navigation, .header, .button { display: block; }"

    const items: ScrapedItem[] = [
      {
        name: "Fat Electrician",
        description: cssBleed,
        notesText: cssBleed,
        image: "",
        detailURL: "https://etatlibredorange.us/products/fat-electrician-en",
        perfumeHouse: "Etat Libre d'Orange",
      },
    ]

    const html = `<html><body>
<h3>MAIN NOTES</h3><p>vetiver from haiti, chestnut cream, olive leaves, myrrh, vanilla, opoponax</p>
</body></html>`
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(html, { status: 200, headers: { "content-type": "text/html" } }),
    )

    const { records } = await extractNotesForItems(items, "Etat Libre d'Orange", {
      generateNoirDescriptions: false,
      noteValidationMode: "off",
    })

    const open = JSON.parse(records[0].openNotes) as string[]
    const heart = JSON.parse(records[0].heartNotes) as string[]
    const base = JSON.parse(records[0].baseNotes) as string[]
    const all = [...open, ...heart, ...base]
    expect(all.some(n => n.includes("vetiver") || n.includes("myrrh"))).toBe(true)
    expect(all.some(n => n === "--" || n === "footer" || n === "navigation")).toBe(false)
    fetchMock.mockRestore()
  })

  it("MAIN NOTES beats FULL DESCRIPTION prose (Putain des Palaces)", () => {
    const source =
      "FULL DESCRIPTION Sheer sensuous fantasy. Under the bitter-sweet touch of almond, like a secret that unfolds, comes a hint of supple leather, fluid and flexible. For one night only, one thrilling night, there are forbidden pleasures. you can see her, hear her, touch her and smell her. MAIN NOTES Rose absolute, violet, leather, lily of the valley, tangerine, ginger, rice powder, amber, animal notes Pronunciation"
    const notes = extractNotesFromStructuredText(source, 2)
    const all = [...notes.openNotes, ...notes.heartNotes, ...notes.baseNotes]
    expect(all).toEqual(
      expect.arrayContaining([
        "rose absolute",
        "violet",
        "leather",
        "lily of the valley",
        "tangerine",
        "ginger",
        "rice powder",
        "amber",
        "animal notes",
      ]),
    )
    expect(all).toHaveLength(9)
    expect(all).not.toContain("like")
    expect(all).not.toContain("comes")
    expect(all).not.toContain("hear her")
  })

  it("Putain des Palaces: PDP bootstrap injects MAIN NOTES when prose triggers note-list signal", async () => {
    const fullDescOnly =
      "Sheer sensuous fantasy. The powdered top note evokes a woman who dresses for seduction. Under the bitter-sweet touch of almond, like a secret that unfolds, comes a hint of supple leather, fluid and flexible. For one night only, one thrilling night, there are forbidden pleasures. you can see her, hear her, touch her and smell her."
    const html = `<html><body>
<h3>FULL DESCRIPTION</h3><p>${fullDescOnly}</p>
<h3>MAIN NOTES</h3><p>Rose absolute, violet, leather, lily of the valley, tangerine, ginger, rice powder, amber, animal notes</p>
</body></html>`

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(html, { status: 200, headers: { "content-type": "text/html" } }),
    )

    const items: ScrapedItem[] = [
      {
        name: "Putain Des Palaces",
        description: fullDescOnly,
        image: "",
        detailURL: "https://etatlibredorange.us/collections/fragrances/products/putain-des-palaces",
        perfumeHouse: "Etat Libre d'Orange",
      },
    ]

    const { records } = await extractNotesForItems(items, "Etat Libre d'Orange", {
      generateNoirDescriptions: false,
      noteValidationMode: "off",
    })

    expect(fetchMock).toHaveBeenCalled()
    const open = JSON.parse(records[0].openNotes) as string[]
    expect(open).toEqual(
      expect.arrayContaining([
        "rose absolute",
        "violet",
        "leather",
        "lily of the valley",
        "tangerine",
        "ginger",
        "rice powder",
        "amber",
        "animal notes",
      ]),
    )
    expect(open).toHaveLength(9)
    expect(open).not.toContain("like")
    expect(open).not.toContain("comes")
    fetchMock.mockRestore()
  })

  it("scrapedItemsNeedEtatLibreEnrichment triggers on prose junk from Python", () => {
    expect(
      scrapedItemsNeedEtatLibreEnrichment([
        {
          name: "Noel Au Balcon",
          description: "marketing prose",
          image: "",
          detailURL: "https://etatlibredorange.us/collections/fragrances/products/noel-au-balcon",
          perfumeHouse: "Etat Libre d'Orange",
          openNotes: ["honey", "notes swirl", "dance", "like a faceted"],
          heartNotes: [],
          baseNotes: [],
        },
      ]),
    ).toBe(true)
    expect(
      scrapedItemsNeedEtatLibreEnrichment([
        {
          name: "Putain Des Palaces",
          description: "noir",
          image: "",
          detailURL: "https://etatlibredorange.us/collections/fragrances/products/putain-des-palaces",
          perfumeHouse: "Etat Libre d'Orange",
          openNotes: ["leather", "powdered", "almond"],
          heartNotes: [],
          baseNotes: [],
        },
      ]),
    ).toBe(true)
  })

  it("enrichOnly: replaces thin Python notes with MAIN NOTES from live-style h5 PDP", async () => {
    const noirOnly =
      "Closing time at a shadowy bar sets the stage for whispered confessions. A seductive blend of leather and powdered almond wraps around you."
    const html = `<html><body>
<h5 style="text-align: justify;"><strong>MAIN NOTES</strong></h5>
<p style="text-align: justify;">Rose absolute, violet, leather, lily of the valley, tangerine, ginger, rice powder, amber, animal notes</p>
</body></html>`

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(html, { status: 200, headers: { "content-type": "text/html" } }),
    )

    const items: ScrapedItem[] = [
      {
        name: "Putain Des Palaces",
        description: noirOnly,
        image: "",
        detailURL: "https://etatlibredorange.us/collections/fragrances/products/putain-des-palaces",
        perfumeHouse: "Etat Libre d'Orange",
        openNotes: ["leather", "powdered", "almond"],
        heartNotes: [],
        baseNotes: [],
      },
    ]

    const { records } = await extractNotesForItems(items, "Etat Libre d'Orange", {
      enrichOnly: true,
      generateNoirDescriptions: false,
      noteValidationMode: "off",
      fetchPdpNoteBootstrap: true,
    })

    const open = JSON.parse(records[0].openNotes) as string[]
    expect(open).toEqual(
      expect.arrayContaining([
        "rose absolute",
        "violet",
        "leather",
        "lily of the valley",
        "tangerine",
        "ginger",
        "rice powder",
        "amber",
        "animal notes",
      ]),
    )
    expect(open).toHaveLength(9)
    expect(open).not.toContain("powdered")
    expect(open).not.toContain("she")
    expect(open).not.toContain("her")
    fetchMock.mockRestore()
  })

  it("Story Of Your Life: layered MAIN NOTES beat FULL DESCRIPTION prose", () => {
    const source =
      "FULL DESCRIPTION We whisper when the hope becomes reality. At last, everything makes sense. MAIN NOTES Top notes : Cistus Essence, Davana Essence, Benzoin Siam Pure JE™ Heart notes: Laurel Essence, Orange Blossom Absolute, Brioche Accord Base notes: Rum Pure JE™, Vanilla Infusion & Absolute, Amber Wood Pronunciation"
    const notes = extractNotesFromStructuredText(source, 2)
    const all = [...notes.openNotes, ...notes.heartNotes, ...notes.baseNotes]
    expect(notes.openNotes).toEqual(
      expect.arrayContaining(["cistus essence", "davana essence"]),
    )
    expect(notes.heartNotes).toEqual(
      expect.arrayContaining(["orange blossom absolute", "laurel essence"]),
    )
    expect(notes.baseNotes).toEqual(
      expect.arrayContaining(["vanilla infusion", "amber"]),
    )
    expect(all).not.toContain("when the hope")
    expect(all).not.toContain("becomes reality")
    expect(all).not.toContain("we whisper")
    expect(all).not.toContain("at last")
    expect(all).not.toContain("everything makes sense")
  })

  it("Spice Must Flow: flat MAIN NOTES beat celebrity prose", () => {
    const source =
      "FULL DESCRIPTION Tilda Swinton wore it. To the poet Rumi, mystical and enchanting. MAIN NOTES Turkish Rose, Ginger, Pepper, Cardamom, Cinnamon, Saffron Pronunciation"
    const notes = extractNotesFromStructuredText(source, 2)
    const all = [...notes.openNotes, ...notes.heartNotes, ...notes.baseNotes]
    expect(all).toEqual(
      expect.arrayContaining(["turkish rose", "ginger", "pepper", "cardamom", "cinnamon", "saffron"]),
    )
    expect(all).toHaveLength(6)
    expect(all).not.toContain("to the poet rumi")
    expect(all).not.toContain("tilda swinton")
    expect(all).not.toContain("mystical")
    expect(all).not.toContain("enchanting")
  })

  it("Story Of Your Life: enrichOnly replaces prose Python notes with layered MAIN NOTES", async () => {
    const noirOnly =
      "A penetrating dream where we whisper when the hope becomes reality. At last, everything makes sense in vanilla and davana."
    const html = `<html><body>
<h5><strong>MAIN NOTES</strong></h5>
<div class="ql-block">Top notes : Cistus Essence, Davana Essence, Benzoin Siam Pure JE™<br>Heart notes: Laurel Essence, Orange Blossom Absolute, Brioche Accord<br>Base notes: Rum Pure JE™, Vanilla Infusion &amp; Absolute, Amber Wood</div>
</body></html>`

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(html, { status: 200, headers: { "content-type": "text/html" } }),
    )

    const items: ScrapedItem[] = [
      {
        name: "Story Of Your Life",
        description: noirOnly,
        image: "",
        detailURL: "https://etatlibredorange.us/collections/fragrances/products/story-of-your-life",
        perfumeHouse: "Etat Libre d'Orange",
        openNotes: ["davana essence"],
        heartNotes: ["orange blossom absolute", "absolute"],
        baseNotes: [
          "vanilla infusion",
          "others",
          "penetrating dream",
          "we whisper",
          "when the hope",
          "becomes reality",
          "at last",
          "everything makes sense",
        ],
      },
    ]

    const { records } = await extractNotesForItems(items, "Etat Libre d'Orange", {
      enrichOnly: true,
      generateNoirDescriptions: false,
      noteValidationMode: "off",
      fetchPdpNoteBootstrap: true,
    })

    const open = JSON.parse(records[0].openNotes) as string[]
    const heart = JSON.parse(records[0].heartNotes) as string[]
    const base = JSON.parse(records[0].baseNotes) as string[]
    const all = [...open, ...heart, ...base]
    expect(open).toEqual(expect.arrayContaining(["cistus essence", "davana essence"]))
    expect(heart).toEqual(expect.arrayContaining(["orange blossom absolute", "laurel essence"]))
    expect(all).not.toContain("when the hope")
    expect(all).not.toContain("penetrating dream")
    expect(all).not.toContain("becomes reality")
    expect(all).not.toContain("we whisper")
    fetchMock.mockRestore()
  })

  it("Above The Waves: layered MAIN NOTES beat infused/lifted prose", () => {
    const source =
      "FULL DESCRIPTION Infused with bright bergamot under an open sky, lifted by aromatic incense on the water. MAIN NOTES Top notes : Bergamot, Cardamom, IncenseHeart notes: Green Maté, Ceylan, Black TeaBase notes: Tonka Bean, Cedar, Vetiver Ingredients ALCOHOL DENAT"
    const notes = extractNotesFromStructuredText(source, 2)
    const all = [...notes.openNotes, ...notes.heartNotes, ...notes.baseNotes]
    expect(notes.openNotes).toEqual(expect.arrayContaining(["bergamot", "cardamom", "incense"]))
    expect(notes.heartNotes).toEqual(expect.arrayContaining(["green maté", "black tea"]))
    expect(notes.baseNotes).toEqual(expect.arrayContaining(["tonka bean", "cedar", "vetiver"]))
    expect(all).not.toContain("infused with bright bergamot")
    expect(all).not.toContain("sky")
    expect(all).not.toContain("lifted by aromatic incense")
  })

  it("Attaquer Le Soleil: single MAIN NOTE blocks literary prose", () => {
    const source =
      "FULL DESCRIPTION Dear god, snatch how to drive marquis de sade revolutionary philosopher beauty even violence ignite the world liberate or possibly to desire. MAIN NOTES Cistus (A genus of flowering plants in the rockrose family) Pronunciation"
    const notes = extractNotesFromStructuredText(source, 2)
    const all = [...notes.openNotes, ...notes.heartNotes, ...notes.baseNotes]
    expect(all).toEqual(["cistus"])
    expect(all).not.toContain("dear god")
    expect(all).not.toContain("snatch")
    expect(all).not.toContain("how")
  })

  it("Divin'enfant: MAIN NOTES flat list; coffee not prose accord phrase", () => {
    const source =
      "FULL DESCRIPTION breaks the unexpected accord of coffee in the air. MAIN NOTES Orange blossom, marshmallow, coffee, rose, cold tobacco, leather, amber, musk Pronunciation"
    const notes = extractNotesFromStructuredText(source, 2)
    const all = [...notes.openNotes, ...notes.heartNotes, ...notes.baseNotes]
    expect(all).toEqual(
      expect.arrayContaining(["orange blossom", "marshmallow", "coffee", "rose", "cold tobacco", "leather", "amber", "musk"]),
    )
    expect(all).not.toContain("breaks the unexpected accord of coffee")
    expect(all.filter(n => n === "coffee")).toHaveLength(1)
  })

  it("Frustration: MAIN NOTES materials only, not Lacan prose", () => {
    const source =
      "FULL DESCRIPTION without explaining too much there suddenly according to lacan issued more vast seduces lulls dominates delectable all nostrils out let devour. MAIN NOTES Cumin HE, Cinnamon HE, Pure Rhum Jungle Essence™, Vanilla Absolute, Ciste Absolute, Chestnut Wood Accord, Bourbon Vetiver HE INGREDIENTS ALCOHOL DENAT"
    const notes = extractNotesFromStructuredText(source, 2)
    const all = [...notes.openNotes, ...notes.heartNotes, ...notes.baseNotes]
    expect(all).toEqual(
      expect.arrayContaining(["cumin", "cinnamon", "vanilla absolute", "ciste absolute", "bourbon vetiver"]),
    )
    expect(all).not.toContain("there")
    expect(all).not.toContain("according to lacan")
    expect(all).not.toContain("devour")
  })

  it("filters Noel Au Balcon prose junk from structured extraction", () => {
    const source =
      "FULL DESCRIPTION Honeyed whispers mingle with tangerine. Notes swirl like a faceted gem. MAIN NOTES Honey, tangerine, vanilla, cinnamon from Sri Lanka, nigella, red pepper, apricot, patchouli, solar musked accord Pronunciation"
    const notes = extractNotesFromStructuredText(source, 2)
    const all = [...notes.openNotes, ...notes.heartNotes, ...notes.baseNotes]
    expect(all).toEqual(
      expect.arrayContaining(["honey", "tangerine", "vanilla", "patchouli"]),
    )
    expect(all).not.toContain("notes swirl")
    expect(all).not.toContain("dance")
    expect(all).not.toContain("like a faceted")
    expect(all).not.toContain("she")
    expect(all).not.toContain("her")
  })
})

