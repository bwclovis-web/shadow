import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { ScrapedItem } from "@/types/scraper"

const invokeMock = vi.fn()

vi.mock("@langchain/openai", () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    invoke: (...args: unknown[]) => invokeMock(...args),
  })),
}))

import { scrapedItemsNeedPatternEtsyEnrichment } from "./map-scraped-items"
import { canonicalizeNote, explodeSpaceSeparatedNoteBlob, splitGluedMerchantNoteRun } from "./canonical-notes"
import {
  computeBatchNoteUniformityWarnings,
  extractNotesForItems,
  mergeFlatMaterialsIntoLayeredPyramid,
  sanitizeCopyForNotePipeline,
} from "./notes-graph"

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
  })

  afterEach(() => {
    vi.unstubAllEnvs()
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
     * Three invocations expected (in order):
     *   1. extractNotesFromDescription for the first product
     *   2. extractNotesFromDescription for the second product (all junk)
     *   3. validateNotesWithLlm (bulk) — returns substitution map:
     *      - "bergamot" → "bergamot" (kept)
     *      - "delicate apple blossom" → "apple blossom" (prose stripped)
     *      - "creamy vanilla" → "creamy vanilla" (olfactory adjective kept)
     *      - "sandalwood" → "sandalwood" (kept)
     *      - "a sweet" → omitted (pure prose)
     *      - "glowing amber warmth" → omitted (no material core)
     */
    const responses = [
      '{"openNotes":["bergamot","a sweet","delicate apple blossom"],"heartNotes":["creamy vanilla"],"baseNotes":["sandalwood","glowing amber warmth"]}',
      '{"openNotes":["a sweet"],"heartNotes":[],"baseNotes":["glowing amber warmth"]}',
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
      noteInferenceMode: "strict",
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
      noteInferenceMode: "strict",
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
