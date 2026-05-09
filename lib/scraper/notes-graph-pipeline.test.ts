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

    const records = await extractNotesForItems(items, "Gallagher Fragrances", {
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
          baseNotes: ["amber", "wood"],
        }),
      }
    })

    const records = await extractNotesForItems(items, "Gallagher Fragrances", {
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
    expect(base).toContain("wood")
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

    const records = await extractNotesForItems(items, "Test House", { generateNoirDescriptions: true })

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

    const records = await extractNotesForItems(items, "Witch House", { generateNoirDescriptions: true })

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

    const records = await extractNotesForItems(items, "Mystery House", { generateNoirDescriptions: true })

    expect(noirCalls).toBe(0)
    expect(records[0].openNotes).toBe("[]")
    expect(records[0].heartNotes).toBe("[]")
    expect(records[0].baseNotes).toBe("[]")
    expect(records[0].description).toBe(originalDescription)
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

    const records = await extractNotesForItems(items, "Gallagher Fragrances", {
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

    const records = await extractNotesForItems(items, "H", {
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

    const records = await extractNotesForItems(items, "Little And Grim", { generateNoirDescriptions: false })

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

    const records = await extractNotesForItems(items, "House", { generateNoirDescriptions: false })

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

    const records = await extractNotesForItems(items, "House", { generateNoirDescriptions: false })
    expect(invokeMock).not.toHaveBeenCalled()
    expect(records).toHaveLength(1)

    const open = JSON.parse(records[0].openNotes) as string[]
    const base = JSON.parse(records[0].baseNotes) as string[]

    expect(open).toContain("bergamot")
    expect(base).toContain("sandalwood")
    expect(base).not.toEqual(expect.arrayContaining(["enhanced by sandalwood", "creating a rich"]))
  })
})
