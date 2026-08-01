import { describe, expect, it, vi } from "vitest"

import { extractNotesForItems } from "./notes-graph"
import type { ScrapedItem } from "@/types/scraper"
import {
  buildNoteConfirmationCorpus,
  confirmNoteLayersAgainstSource,
  extractUnlabeledFragranceNotesBlock,
  isNoteSubstantiatedInSource,
  isComplianceOrSourcingNote,
  isObviousNonMaterialNote,
  isThemeCssTokenNote,
  peelMarketingDescriptorTail,
  sanitizeExtractedNoteCandidate,
} from "./note-source-confirmation"
import { filterNotesByTrust } from "./stages/title-cleaning"

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

  it("substantiates accord notes when the head material appears in thin merchant prose", () => {
    const thinOrgasmo =
      "Andromedas Moon Inspired by Orgasmo Eau De Parfum A dreamy amaretto- gourmand with a silky, sweet glow cozy, addictive, and cloud-soft."
    const corpus = buildNoteConfirmationCorpus(thinOrgasmo)
    expect(isNoteSubstantiatedInSource("amaretto liqueur accord", corpus, thinOrgasmo)).toBe(true)
    const confirmed = confirmNoteLayersAgainstSource(
      { openNotes: ["almond", "amaretto liqueur accord"], heartNotes: [], baseNotes: [] },
      thinOrgasmo,
    )
    expect(confirmed.openNotes).toEqual(
      expect.arrayContaining(["almond", "amaretto liqueur accord"]),
    )
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

  it("confirmNoteLayersAgainstSource keeps moss from Andromeda base notes line", () => {
    const source =
      "open notes: orange, bergamot\nheart notes: jasmine, coconut cream, vanilla orchid\nbase notes: amber, vanilla, moss\nScent Story whisper of moss in prose."
    const layers = {
      openNotes: ["orange", "bergamot"],
      heartNotes: ["jasmine", "coconut cream", "vanilla orchid"],
      baseNotes: ["amber", "vanilla", "moss"],
    }
    const confirmed = confirmNoteLayersAgainstSource(layers, source)
    expect(confirmed.baseNotes).toEqual(
      expect.arrayContaining(["amber", "vanilla", "moss"]),
    )
    expect(confirmed.openNotes).not.toEqual(expect.arrayContaining(["moss"]))
  })

  it("confirmNoteLayersAgainstSource relayers mis-assigned pyramid notes (Fragaria)", () => {
    const source =
      "Top Notes: Crushed Pink Pepper, Sparkling Mandarin, Zesty Bergamot Heart Notes: Wild Strawberry, Violet Veil, Orris Butter Base Notes: Smoked Vetiver, Cedarwood Shavings, Patchouli Resin, Fir Balsam"
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
    const confirmed = confirmNoteLayersAgainstSource(mislayered, source)
    expect(confirmed.openNotes).toEqual(
      expect.arrayContaining(["crushed pink pepper", "sparkling mandarin", "zesty bergamot"]),
    )
    expect(confirmed.openNotes).not.toEqual(
      expect.arrayContaining(["wild strawberry", "violet veil", "orris butter"]),
    )
    expect(confirmed.heartNotes).toEqual(
      expect.arrayContaining(["wild strawberry", "violet veil", "orris butter"]),
    )
    expect(confirmed.baseNotes).toEqual(
      expect.arrayContaining(["smoked vetiver", "cedarwood shavings", "patchouli resin", "fir balsam"]),
    )
  })

  it("confirmNoteLayersAgainstSource keeps Not Vanilla heart materials in heart layer", () => {
    const source =
      "open notes: Camphor, Nutmeg, Bergamot heart notes: Vanilla, Juniper Berries, Cedar, Violet base notes: Praline, Cetalox, Musk, Guaiac Wood, Moss, Amber Top notes of Camphor, Nutmeg, Bergamot Middle notes of Vanilla, Juniper Berries, Cedar, Violet Base notes of Praline, Cetalox, Musk, Guaiac Wood, Moss, Amber"
    const layers = {
      openNotes: ["camphor", "nutmeg", "bergamot"],
      heartNotes: ["vanilla", "juniper berries", "cedar", "violet"],
      baseNotes: ["praline", "cetalox", "musk", "guaiac wood", "moss", "amber"],
    }
    const confirmed = confirmNoteLayersAgainstSource(layers, source)
    expect(confirmed.heartNotes).toEqual(
      expect.arrayContaining(["vanilla", "juniper berries", "cedar", "violet"]),
    )
  })

  it("relayer keeps notes substantiated in full source when layer corpus misses them", () => {
    const source = `
Head Notes: Marseille Soapbar Accord, Bergamot Calabria E.O.
Heart Notes: Lavandin E.O., Petitgrain E.O.
Base Notes: Cedarwood E.O., White Musks
Also listed elsewhere: Neroli E.O. among featured materials.
`
    const layers = {
      openNotes: ["marseille soapbar accord", "bergamot calabria e.o.", "neroli e.o."],
      heartNotes: ["lavandin e.o.", "petitgrain e.o."],
      baseNotes: ["cedarwood e.o.", "white musks"],
    }
    const trusted = new Set(["neroli e.o.", "lavandin e.o."])
    const confirmed = confirmNoteLayersAgainstSource(layers, source, { merchantTrusted: trusted })
    expect(confirmed.openNotes).toEqual(expect.arrayContaining(["neroli e.o."]))
    expect(confirmed.heartNotes).toEqual(expect.arrayContaining(["lavandin e.o.", "petitgrain e.o."]))
  })

  it("filterNotesByTrust keeps merchant-trusted materials that look prose-like", () => {
    const trusted = new Set(["marseille soapbar accord", "lavandin e.o."])
    const kept = filterNotesByTrust(
      ["marseille soapbar accord", "lavandin e.o.", "a whisper of rain-slick streets"],
      trusted,
    )
    expect(kept).toEqual(expect.arrayContaining(["marseille soapbar accord", "lavandin e.o."]))
    expect(kept).not.toEqual(expect.arrayContaining(["a whisper of rain-slick streets"]))
  })

  it("filterNotesByTrust still drops compliance and theme tokens even when trusted", () => {
    const trusted = new Set([
      "phthalate-free",
      "--tw-shadow",
      "esc",
      "left arrow key",
      "right arrow key",
      "ndash",
    ])
    const kept = filterNotesByTrust(
      ["phthalate-free", "--tw-shadow", "esc", "left arrow key", "right arrow key", "ndash", "bergamot"],
      trusted,
    )
    expect(kept).not.toContain("phthalate-free")
    expect(kept).not.toContain("--tw-shadow")
    expect(kept).not.toContain("esc")
    expect(kept).not.toContain("left arrow key")
    expect(kept).not.toContain("right arrow key")
    expect(kept).not.toContain("ndash")
    expect(kept).toContain("bergamot")
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

  it("extractUnlabeledFragranceNotesBlock parses emoji-glued Impadia Fragrance Notes", () => {
    const impadia = `Inspired by Impadia Eau De Parfum Fragrance Description A radiant fusion of pear and bergamot unfolds into blooming roses. Fragrance Notes 🍐 Pear 🍋 Bergamot 🍊 Mandarin 🌹 Bulgarian Rose 🌷 Turkish Rose 🤍 Orange Blossom 🪵 Akigalawood 🌿 Vanilla Absolute 🪵 Sandalwood Available Sizes 5 mL`
    expect(extractUnlabeledFragranceNotesBlock(impadia)).toEqual(
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
  })

  it("sanitizeExtractedNoteCandidate rejects marketing junk from Andromeda CSV bleed", () => {
    expect(sanitizeExtractedNoteCandidate("top")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("a mug")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("the creamy")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("cacao the")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("powdered vanilla style")).toBe("powdered vanilla")
    expect(sanitizeExtractedNoteCandidate("cozy spices projection")).toBe("cozy spices")
    expect(sanitizeExtractedNoteCandidate("creamy almond facets")).toBe("creamy almond")
    expect(sanitizeExtractedNoteCandidate("summer warm days")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("originally from byredo")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("frosted-pastel")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("powdery")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("sandalwood")).toBe("sandalwood")
    expect(sanitizeExtractedNoteCandidate("soft musk description")).toBe("soft musk")
    expect(sanitizeExtractedNoteCandidate("/head")).toBeNull()
    expect(isObviousNonMaterialNote("/head")).toBe(true)
    expect(isObviousNonMaterialNote("charset")).toBe(true)
    expect(sanitizeExtractedNoteCandidate("brown sugar")).toBe("brown sugar")
    expect(sanitizeExtractedNoteCandidate("then deepens into warm brown sugar")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("fluffy glow")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("middle notes")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("base notes are ebony")).toBe("ebony")
    expect(sanitizeExtractedNoteCandidate("cozy woods wrap yourself in the soft sweetness")).toBe(
      "cozy woods",
    )
    expect(sanitizeExtractedNoteCandidate("soft woods float into a world spun from sugar clouds")).toBe(
      "soft woods",
    )
    expect(sanitizeExtractedNoteCandidate("creamy softness of")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("pastel dreams with")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("gourmands")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("nostalgic desserts")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("amber hand-blended")).toBe("amber")
    expect(sanitizeExtractedNoteCandidate("infused with bright bergamot")).toBe("bergamot")
    expect(sanitizeExtractedNoteCandidate("lifted by aromatic incense")).toBe("incense")
    expect(sanitizeExtractedNoteCandidate("breaks the unexpected accord of coffee")).toBe("coffee")
    expect(sanitizeExtractedNoteCandidate("vetiver from haiti")).toBe("vetiver")
    expect(sanitizeExtractedNoteCandidate("dear god")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("snatch")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("bottled by")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("juicy signature scent unlike anything else")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("uicy signature scent unlike anything else")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("followed by a heart of frangipani")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("llowed by a heart of frangipani")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("ss brings effortless sensuality")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("tterly magnetic")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("top camphor")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("bergamot heart")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("violet base praline")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("intention")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("sensual")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("seductive")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("rebellious")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("drenched in warmth")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("creating an unforgettable")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("fairy-kissed")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("pink")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("becomes your skins signature")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("softened with creamy florals")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("warm wood")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("creamy florals")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("sandalwood fragrance")).toBe("sandalwood")
    expect(sanitizeExtractedNoteCandidate("pink pepper")).toBe("pink pepper")
    expect(sanitizeExtractedNoteCandidate("sandalwood 80 reviews regular")).toBe("sandalwood")
    expect(sanitizeExtractedNoteCandidate("patchouli reviews regular")).toBe("patchouli")
    expect(isObviousNonMaterialNote("80 reviews regular")).toBe(true)
  })

  it("sanitizeExtractedNoteCandidate rejects Widian marketing slogans mistaken for notes", () => {
    const junk = [
      "this citrus-spice fusion radiates energy",
      "confidence",
      "golden spark on sun-warmed skin.",
      "delicate warmth — indulgent",
      "feminine",
      "unforgettable.",
      "where tradition meets rebellion",
      "elegance blends with edge",
      "deepen its soul",
      "stays with you",
      "where ancient rituals meet modern elegance",
      "silent power of time",
      "passion",
      "andalusian soul.",
      "zesty citrus",
      "aromatic herbs",
      "grounded with smoky wood",
      "mineral warmth vibrant",
      "layered",
      "alive.",
      "caramel in a radiant",
      "juicy composition full of golden warmth.",
      "bold",
      "pure",
      "comfort",
      "clarity.",
      "https://widian.com/en/collections/rose-arabia-collection",
    ]
    for (const note of junk) {
      expect(sanitizeExtractedNoteCandidate(note), note).toBeNull()
    }
    // Real materials from the same Widian scrape must still pass.
    expect(sanitizeExtractedNoteCandidate("patchouli")).toBe("patchouli")
    expect(sanitizeExtractedNoteCandidate("labdanum abs")).toBe("labdanum abs")
    expect(sanitizeExtractedNoteCandidate("lily-of-the-valley")).toBe("lily-of-the-valley")
    expect(sanitizeExtractedNoteCandidate("dry amber")).toBe("dry amber")
    expect(sanitizeExtractedNoteCandidate("pink peppercorn")).toBe("pink peppercorn")
    expect(sanitizeExtractedNoteCandidate("tender floral musk")).toBe("tender floral musk")
  })

  it("peelMarketingDescriptorTail strips trailing Shopify copy", () => {
    expect(peelMarketingDescriptorTail("cotton candy air")).toBe("cotton candy")
    expect(peelMarketingDescriptorTail("vanilla cloud cream")).toBe("vanilla")
    expect(peelMarketingDescriptorTail("sugar sparkle")).toBe("sugar")
    expect(peelMarketingDescriptorTail("fresh watermelon hit first")).toBe("fresh watermelon")
    expect(peelMarketingDescriptorTail("sea breeze wrap you in a haze")).toBe("sea breeze")
    expect(peelMarketingDescriptorTail("musk melt into skin")).toBe("musk")
    expect(sanitizeExtractedNoteCandidate("resort evenings")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("warm days")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("cedar wear guide")).toBe("cedar")
    expect(sanitizeExtractedNoteCandidate("starry date evenings")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("flirtatious")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("glamorous")).toBeNull()
    expect(sanitizeExtractedNoteCandidate("ruby")).toBeNull()
  })

  it("isComplianceOrSourcingNote rejects INCI carriers from Ingredients blocks", () => {
    for (const junk of [
      "alcohol (denat.)",
      "alcohol denat",
      "water (aqua)",
      "aqua",
      "fragrance (parfum)",
      "(parfum)",
      "parfum",
      "fried dough. ingredients: alcohol (denat.)",
    ]) {
      expect(isComplianceOrSourcingNote(junk), junk).toBe(true)
    }
    expect(isComplianceOrSourcingNote("raspberry")).toBe(false)
    expect(isComplianceOrSourcingNote("vanilla extract")).toBe(false)
  })

  it("isComplianceOrSourcingNote rejects alcohol-ingredient and organic-farming boilerplate", () => {
    for (const junk of [
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
    ]) {
      expect(isComplianceOrSourcingNote(junk), junk).toBe(true)
    }
    expect(isComplianceOrSourcingNote("sandalwood")).toBe(false)
    expect(isComplianceOrSourcingNote("agarwood")).toBe(false)
  })

  it("isComplianceOrSourcingNote rejects Andromeda policy prose mistaken for notes", () => {
    for (const junk of [
      "these fragrances are all poured by hand",
      "the purpose of this description",
      "thank you for giving us your time",
      "becoming part of andromeda",
      "sweet notes",
      "main notes",
    ]) {
      expect(isComplianceOrSourcingNote(junk), junk).toBe(true)
    }
  })

  it("isThemeCssTokenNote rejects Shopify theme CSS bleed", () => {
    for (const junk of [
      "--",
      "--light-",
      "--button-",
      "button",
      "footer",
      "navigation",
      "header",
      "secondary-elements",
      "--product-badge-",
      "esc",
      "ndash",
      "left arrow key",
      "right arrow key",
      "left arrow",
      "right arrow",
      "arrow key",
      "arrow keys",
      "close (esc)",
      "window",
      "new window",
      "opens in a new window",
      "opens in a new tab",
      "full page refresh",
      "laced",
    ]) {
      expect(isThemeCssTokenNote(junk), junk).toBe(true)
      expect(isObviousNonMaterialNote(junk), junk).toBe(true)
    }
    expect(isThemeCssTokenNote("vetiver")).toBe(false)
    expect(isThemeCssTokenNote("iris")).toBe(false)
  })

  it("isObviousNonMaterialNote rejects CSS bleed and truncated prose fragments", () => {
    expect(isObviousNonMaterialNote("touch")).toBe(true)
    expect(isObviousNonMaterialNote("then")).toBe(true)
    expect(isObviousNonMaterialNote("fabric")).toBe(true)
    expect(isObviousNonMaterialNote("rgba")).toBe(true)
    expect(isObviousNonMaterialNote("linear-gradient")).toBe(true)
    expect(isObviousNonMaterialNote("body")).toBe(true)
    expect(isObviousNonMaterialNote("roboto")).toBe(true)
    expect(isObviousNonMaterialNote("blinkmacsystemfont")).toBe(true)
    expect(isObviousNonMaterialNote("radial-gradient")).toBe(true)
    expect(isObviousNonMaterialNote("rum-like warmth f note")).toBe(true)
    expect(isObviousNonMaterialNote("rum-like warmth f")).toBe(true)
    expect(isObviousNonMaterialNote("a soft golden sweetness")).toBe(true)
    expect(isObviousNonMaterialNote("sandalwood")).toBe(false)
    expect(isObviousNonMaterialNote("orange blossom")).toBe(false)
  })
})
