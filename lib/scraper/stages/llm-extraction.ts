import type { BaseMessage } from "@langchain/core/messages"
import { ChatOpenAI } from "@langchain/openai"
import type { NoteInferenceMode } from "@/types/scraper"
import {
  buildNoteConfirmationCorpus,
  isNoteSubstantiatedInSource,
} from "@/lib/scraper/note-source-confirmation"
import type { NotesLayers } from "@/lib/scraper/stages/notes-layers"
import { hasLayeredMerchantPyramid, noteLayerCount } from "@/lib/scraper/stages/notes-layers-utils"
import {
  dedupeNotesAcrossLayers,
  extractFlatNotes,
  isThemeJunkDominatedLayers,
  uniqueNotes,
} from "@/lib/scraper/stages/title-cleaning"

/** Flatten LangChain 1.x `AIMessage` output (`content` may be string or text blocks). */
const getLlmInvocationText = (response: BaseMessage): string => {
  const viaGetter = response.text
  if (typeof viaGetter === "string" && viaGetter.length > 0) return viaGetter
  const c = response.content
  if (typeof c === "string") return c
  if (Array.isArray(c)) {
    return c
      .map((block: unknown) => {
        if (typeof block === "string") return block
        if (block && typeof block === "object" && "text" in block) {
          return String((block as { text: unknown }).text ?? "")
        }
        return ""
      })
      .join("")
  }
  return ""
}

// ---------------------------------------------------------------------------
// LLM note-extraction helper
// ---------------------------------------------------------------------------

const NOTE_SYSTEM_PROMPT = `You are a master perfumer. Extract fragrance notes from the product text and assign them to three layers.

Return ONLY a JSON object with exactly these keys (use these exact names):
  "openNotes":  string[] — top/opening notes (first impression, evaporates first)
  "heartNotes": string[] — middle/heart notes (core of the scent)
  "baseNotes":  string[] — base/dry-down notes (last to fade, depth)

Authoritative lists (must follow first):
- If the text contains a comma- or "and"-separated note list introduced by any of: "Scent notes include", "Fragrance notes are", "Fragrance notes:", "Notes:", "Note:", "Key notes:", "Featured notes", "Main notes:", "with notes of", or similar labeled lines, that list is the ONLY source of notes. Include every item verbatim (lowercase, English). Put them all in openNotes and set heartNotes and baseNotes to [] unless the same text explicitly defines Top/Heart/Base (or equivalent) grouping for those exact materials.
- If there is NO such labeled list but the copy clearly states materials in structured phrases like "opens with … Apricot, Black Tea, and … Neroli", "portrayed … by … Rose and Oakwood", or "greeted by warm notes of Maple, … Amber, and … Leather", extract those comma-/and-separated materials as the note set (open/heart/base by order or volatility).

Layer detection (only when there is NO authoritative flat list as above):
- If the text uses section headers (e.g. "Top:", "Heart:", "Base:" or "Opening:", "Mid:", "Body:", "Center:", "Bottom:", "Background:", "Dry down:" or "Head/Heart/Base", or French "Notes de tête / de cœur / de fond"), put each note in the matching layer.
- If it says "top notes include X, Y" or "heart: X, Y" or "base notes: X", follow that structure.
- If there is no layering, spread notes by typical volatility: citrus, herbs, light florals → openNotes; florals, spices, fruits → heartNotes; woods, musk, vanilla, amber, resins → baseNotes.
- When in doubt, prefer putting a note in heartNotes rather than omitting it.

Prose extraction (when there is no labeled list — narrative copy and storytelling can still name real materials):
- Extract every named fragrance material that appears anywhere in the text, even when it is woven into metaphor or storytelling. Examples of materials to keep: rose, plum, honey, brown sugar, smoke, leather, amber, vanilla, sandalwood, oakwood, bergamot, jasmine, musk, oud, tobacco, incense, patchouli, cedar, vetiver, lavender, neroli, bourbon, whiskey, coffee, cocoa, hay, salt, sea, rain, ozone, peppercorn, cinnamon, clove, ginger.
- Do NOT skip a material just because it appears inside a metaphor sentence ("she wore plum and rose like a secret" still means plum and rose are notes).
- Ignore non-material storytelling words (e.g. "shadow", "midnight", "secret", "temptation", "velvet" as a texture, "moonlight", "whisper", "promise").

Rules (when not using a single authoritative list):
- Extract every fragrance note mentioned in the narrative — include every scent ingredient (e.g. vanilla, rose, black pepper, sandalwood, bergamot, jasmine, musk, amber, oud).
- Notes must be lowercase and in ENGLISH. Translate any non-English note names: "santal" → "sandalwood", "musc" / "musc blanc" → "white musk", "vanille" → "vanilla", "ambre" → "amber", "bois" → "wood", "rose" → "rose", "fleur" → "flower", "tabac" → "tobacco", "encens" → "incense".
- Remove duplicates within each array.
- Adjectives that describe a note → keep as phrase ONLY when the core ingredient is a real scent material. "warm vanilla" ✓  "warm sandalwood" ✓  "glowing amber warmth" ✗ (warmth is not a material).
- Omit pure marketing fluff that is not a note (e.g. "luscious", "irresistible", "seductive", "sensual", "confidence", "courage", "healing", "balance", "vitality" as standalone words).
- NEVER include crystals, gemstones, or minerals as notes (e.g. quartz, amethyst, herkimer diamond, topaz, tourmaline, moonstone, labradorite, gem magic, citrine, obsidian, selenite). These are not fragrance notes.
- NEVER include carrier oils or base ingredients as notes (e.g. sunflower oil, jojoba oil, shea butter, coconut oil, sweet almond oil, argan oil). These are not fragrance notes.
- NEVER treat storefront section headers or specs as notes (e.g. "Extra Info Below if You're Curious", "power source accord", battery/USB copy). These are not fragrance notes.
- NEVER treat solvent/carrier marketing as notes (e.g. "vegan augeo", "made from renewable resources", "colourless", "odourless", "is vegan", "room sprays", "what does X smell like" SEO lines). These are not fragrance pyramid materials.
- NEVER treat people, roles, or quote fluff as notes (e.g. founder, iconic, transmission, "continues the narrative", attributions like perfumer names).
- NEVER output scent-profile genre tokens as standalone notes (e.g. musky, woody, fruity, powdery, feminine, citrus, floral, gourmand, aquatic as single-word entries — "fresh bergamot" as a phrase is fine). EXCEPTION: qualified multi-word forms that name a specific ingredient class ARE valid: "white flowers" ✓, "white florals" ✓, "white musk" ✓, "green tea" ✓, "black tea" ✓, "red fruits" ✓, "citrus fruits" ✓. Only bare unqualified single-word genre labels are banned.
- NEVER output e-commerce or policy language as notes (e.g. cancellations, materials, labor, processing, changes, exclude weekends, all sales are final, order includes, refunds).
- NEVER output experience-fragment or marketing sentence tails as notes (e.g. "juicy opening", "a creamy candy-like heart", "giving it a smooth", "ginger that feels vibrant", "that feels cozy").
- NEVER start a note with an article: "a sweet" ✗  "an opening" ✗  "the base" ✗.
- NEVER include sensory experience words that are not materials: warmth, sweetness, feel, texture, character, presence, opening, scent, airy, glowing, softly, effortlessly, modern, adding — these describe experiences, not ingredients.
- If the product is clearly NOT a fragrance (e.g. jewelry, necklace, candle, body scrub, hair product, supplement), return all empty arrays: {"openNotes":[],"heartNotes":[],"baseNotes":[]}.

SELF-CHECK before returning: for each note in your arrays ask "Is this a named scent material — a botanical, natural extract, synthetic aroma molecule, or established accord name?" If no, remove it.
  ✗ Remove: "a sweet", "glowing amber warmth", "effortlessly pretty", "romantic feel", "the center turns resinous", "airy aquatic notes", "modern opening", "warm sweetness", "skin scents", "adding softness", "woody through the heart", "soft swirls of vanilla", "moonlit character"
  ✓ Keep: "vanilla", "warm sandalwood", "bergamot", "orris butter", "tonka bean", "smoked leather", "peru balsam", "tahitian vanilla", "black currant", "marshmallow fluff", "whipped cream", "orris butter", "praline", "granny smith apple", "pitahaya", "soft musk", "powdery woods", "vanilla cream"

Return only the JSON object — no explanation, no markdown fences.`

const NAME_ONLY_PROMPT = `You are a master perfumer extracting fragrance notes from a product name.

STEP 1 — LITERAL INGREDIENTS: Does the name contain real scent ingredients? Extract every one.
Examples:
  "Lavender" → openNotes: ["lavender"]
  "Honey" → heartNotes: ["honey"], baseNotes: ["beeswax"]
  "Vanilla Ice Cream" → openNotes: ["vanilla cream", "sugar"], heartNotes: ["vanilla", "milk"], baseNotes: ["musk", "vanilla"]
  "Condensed Milk" → openNotes: ["cream", "sugar"], heartNotes: ["milk", "vanilla"], baseNotes: ["musk"]
  "Suntan Lotion" → openNotes: ["coconut", "tropical flowers"], heartNotes: ["banana", "orange blossom"], baseNotes: ["coconut milk", "solar musk", "vanilla"]
  "Sandalwood & Rose" → heartNotes: ["rose"], baseNotes: ["sandalwood"]
  "Lavender & Vanilla" → openNotes: ["lavender"], heartNotes: ["lavender"], baseNotes: ["vanilla"]

STEP 2 — THEMATIC INFERENCE: If the name doesn't contain literal ingredients, infer notes from the theme/mood:
  - Witchy/ritual names (e.g. "Shadow Work", "Hexbreaker", "Samhain") → dark amber, incense, patchouli, black musk, smoke, myrrh
  - Mythological names (e.g. "Aphrodite", "The Siren", "Persephone") → rose, jasmine, musk, pomegranate, neroli, ylang ylang
  - Nature names (e.g. "Forest Floor", "Awakening") → vetiver, moss, pine, cedar, earth, green
  - Fresh names → bergamot, citrus, green tea, aquatic
  - Romantic names → rose, jasmine, peony, violet
  - Gourmand names → vanilla, caramel, honey, tonka bean

Return ONLY a JSON object: {"openNotes": string[], "heartNotes": string[], "baseNotes": string[]}.
Use lowercase. No duplicates. No explanation, no markdown.
Always provide at least 1-3 notes even when guessing.`

const NAME_ONLY_PROMPT_STRICT = `You extract fragrance notes from a product name ONLY when the name contains literal scent materials or recognizable fragrance names.

Return ONLY a JSON object: {"openNotes": string[], "heartNotes": string[], "baseNotes": string[]}.

Rules:
- Include only materials or fragrance names explicitly present in the product name (e.g. "Lavender & Vanilla" → lavender in openNotes, vanilla in baseNotes by volatility is optional — use one layer or split sensibly).
- Do NOT invent thematic, mythological, mood-based, or "witchy/gourmand palette" notes from abstract titles.
- If the name has no identifiable scent ingredients, return {"openNotes":[],"heartNotes":[],"baseNotes":[]}.
- Lowercase only. No duplicates. No markdown or explanation.`

/** Used when description + name fallback still yield no notes: infer from name and/or known perfume databases. */
const FALLBACK_LOOKUP_SYSTEM_PROMPT = `You are a fragrance encyclopedia. This perfume returned NO notes from its listing. You MUST return notes — empty arrays are NOT acceptable.

How to find notes (use ALL of these):
1. NAME ANALYSIS — Many names include scent words (e.g. "Lavender & Vanilla" → lavender, vanilla; "Forest Floor" → pine, moss, earth, cedar; "The Siren" → aquatic, salt, jasmine, musk). Think creatively about what scents the name evokes.
2. PERFUME DATABASE KNOWLEDGE — If you recognize this as a known fragrance (from Fragrantica, Basenotes, or indie perfume communities), list its documented top/heart/base notes.
3. HOUSE KNOWLEDGE — If you know the perfume house, use their common ingredient palette.
4. THEMATIC INFERENCE — If the name is evocative/abstract (e.g. "Midnight", "Shadow Work", "Aphrodite"), infer notes that match the theme:
   - Dark/gothic names → oud, black musk, incense, patchouli, smoke, dark amber
   - Floral/romantic names → rose, jasmine, peony, ylang ylang, neroli
   - Fresh/nature names → bergamot, green tea, bamboo, vetiver, cedar
   - Mystical/witchy names → frankincense, myrrh, mugwort, lavender, sage, sandalwood
   - Gourmand names → vanilla, honey, cinnamon, cocoa, caramel, tonka bean

Rules:
- Return ONLY a JSON object: {"openNotes": string[], "heartNotes": string[], "baseNotes": string[]}.
- NEVER return all empty arrays. Always provide AT LEAST 3 notes total, distributed across at least two of the three layers. Prefer 4-6 notes total for evocative/abstract names. Cap the total at 6 notes — do not pad with generic filler.
- For recognized fragrances (e.g. Lush Lord of Misrule, Karma, Rose Jam), use the fragrance's documented top/heart/base notes — do not return only a single generic note like "musk".
- Use lowercase. No duplicates. No explanation, no markdown.
- Assign by volatility: citrus, herbs, green, light florals → openNotes; florals, spices, fruits → heartNotes; woods, musk, vanilla, amber, oud, resins → baseNotes.
- NEVER output e-commerce or policy words, scent-profile single-word genre tokens, or experience fragments as notes (same exclusions as the main extractor: cancellations, materials, labor, musky/woody/feminine as standalone tokens, "juicy opening", etc.).`

/** Keys the LLM might use for each layer; we normalize to openNotes, heartNotes, baseNotes. */
const OPEN_KEYS = ["openNotes", "open", "opening", "openingNotes", "topNotes", "top", "headNotes", "head"]
const HEART_KEYS = [
  "heartNotes",
  "heart",
  "middleNotes",
  "middle",
  "midNotes",
  "mid",
  "coreNotes",
  "bodyNotes",
  "body",
  "centerNotes",
  "center",
  "centreNotes",
  "centre",
]
const BASE_KEYS = [
  "baseNotes",
  "base",
  "dryDownNotes",
  "dryDown",
  "dry-down",
  "endNotes",
  "end",
  "bottomNotes",
  "bottom",
  "backgroundNotes",
  "background",
  "foundationNotes",
  "foundation",
]

function toNoteArray(val: unknown): string[] {
  if (!Array.isArray(val)) return []
  const arr = (val as unknown[]).map(String).map(s => s.trim().toLowerCase()).filter(Boolean)
  return [...new Set(arr)]
}

function pickFirstArray(obj: Record<string, unknown>, keys: string[]): string[] {
  for (const k of keys) {
    const v = obj[k]
    if (Array.isArray(v) && v.length > 0) return toNoteArray(v)
  }
  return []
}

function parseNotesFromLlmResponse(responseContent: unknown): {
  openNotes: string[]
  heartNotes: string[]
  baseNotes: string[]
} {
  const empty = { openNotes: [] as string[], heartNotes: [] as string[], baseNotes: [] as string[] }
  const text = typeof responseContent === "string" ? responseContent : ""
  const cleaned = text.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return empty
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    const openNotes = pickFirstArray(parsed, OPEN_KEYS)
    const heartNotes = pickFirstArray(parsed, HEART_KEYS)
    const baseNotes = pickFirstArray(parsed, BASE_KEYS)
    return {
      openNotes: openNotes.length ? openNotes : toNoteArray(parsed.openNotes),
      heartNotes: heartNotes.length ? heartNotes : toNoteArray(parsed.heartNotes),
      baseNotes: baseNotes.length ? baseNotes : toNoteArray(parsed.baseNotes),
    }
  } catch {
    return empty
  }
}

const MERGE_STRUCTURED_SUPPLEMENT_PROMPT = `You rebalance a perfume note list that was already parsed from the product page (labeled Top/Middle/Base and/or flat lists).

Return ONLY JSON: {"openNotes": string[], "heartNotes": string[], "baseNotes": string[]}.

Rules:
- Every note in the provided structured arrays MUST still appear in your output (same spelling intent; lowercase).
- Do NOT add new notes from evocative marketing prose, noir-style storytelling, or mood copy. Only add a note if the full text contains another explicit labeled note list or clear Top/Heart/Base section naming that material.
- Do NOT output any material that is not already named in the structured arrays or in an explicit labeled note line in the full text (e.g. "Featured notes:", "Notes:"). Re-layer only; never invent plum/rose/musk from figurative sentences.
- If structured openNotes is non-empty and heartNotes and baseNotes are both empty (flat list), keep all notes in openNotes unless the full text explicitly defines a pyramid — do not invent heart/base layers from adjectives in prose.
- No duplicates across layers, no marketing sentences, lowercase only.
- Carrier oils, gemstones, and SKU/meta lines are not notes.
- Never add section boilerplate or product specs: "extra info", "if you're curious", "power source accord", etc.
- Never add solvent or listing filler: "vegan augeo", "renewable resources", "colourless/odourless", "is vegan", "room sprays", "what does … smell like", or clothing/fashion words from prose (e.g. "clothing", "trench coat") unless they are an explicit labeled scent accord.
- Never add quote or brand fluff: founder, iconic, transmission, narrative, perfumer names, or similar — only real scent materials.`

/**
 * Python HTML extraction is useful, but when Node has already rebuilt a stronger merchant pyramid
 * (e.g. via Andromeda PDP bootstrap), do not blindly re-add Python blobs like
 * "orange bergamot golden mist". Only merge Python-only notes that are still explicitly
 * substantiated in the current note source.
 */
const mergeExistingPythonNotes = (
  current: NotesLayers,
  existing: NotesLayers | null,
  notesSource: string,
  enrichOnly = false,
): NotesLayers => {
  if (!existing || noteLayerCount(existing) === 0) return current

  if (
    enrichOnly &&
    existing.openNotes.length > 0 &&
    existing.heartNotes.length > 0 &&
    existing.baseNotes.length > 0 &&
    noteLayerCount(existing) >= 6 &&
    !isThemeJunkDominatedLayers(existing)
  ) {
    return dedupeNotesAcrossLayers({
      openNotes: uniqueNotes([...existing.openNotes, ...current.openNotes]),
      heartNotes: uniqueNotes([...existing.heartNotes, ...current.heartNotes]),
      baseNotes: uniqueNotes([...existing.baseNotes, ...current.baseNotes]),
    })
  }

  if (
    /\bMAIN NOTES\b/i.test(notesSource) &&
    noteLayerCount(current) >= 2 &&
    !isThemeJunkDominatedLayers(current)
  ) {
    return dedupeNotesAcrossLayers(current)
  }

  if (isThemeJunkDominatedLayers(current) && noteLayerCount(existing) >= 2) {
    return dedupeNotesAcrossLayers(existing)
  }

  const currentIsAuthoritative =
    (hasLayeredMerchantPyramid(current) || noteLayerCount(current) >= noteLayerCount(existing)) &&
    !isThemeJunkDominatedLayers(current)

  if (!currentIsAuthoritative) {
    return dedupeNotesAcrossLayers({
      openNotes: uniqueNotes([...existing.openNotes, ...current.openNotes]),
      heartNotes: uniqueNotes([...existing.heartNotes, ...current.heartNotes]),
      baseNotes: uniqueNotes([...existing.baseNotes, ...current.baseNotes]),
    })
  }

  const corpus = buildNoteConfirmationCorpus(notesSource)
  const keepIfSubstantiated = (arr: string[]): string[] =>
    arr.filter(note => isNoteSubstantiatedInSource(note, corpus, notesSource))

  return dedupeNotesAcrossLayers({
    openNotes: uniqueNotes([...keepIfSubstantiated(existing.openNotes), ...current.openNotes]),
    heartNotes: uniqueNotes([...keepIfSubstantiated(existing.heartNotes), ...current.heartNotes]),
    baseNotes: uniqueNotes([...keepIfSubstantiated(existing.baseNotes), ...current.baseNotes]),
  })
}

/** Regex + structured materials the merge step is allowed to keep; blocks LLM “invention” from marketing prose. */
const buildLowercaseNoteUniverse = (
  structured: { openNotes: string[]; heartNotes: string[]; baseNotes: string[] },
  fullText: string,
): Set<string> => {
  const u = new Set<string>()
  for (const n of [...structured.openNotes, ...structured.heartNotes, ...structured.baseNotes]) {
    const k = n.trim().toLowerCase()
    if (k) u.add(k)
  }
  for (const n of extractFlatNotes(fullText)) {
    const k = n.trim().toLowerCase()
    if (k) u.add(k)
  }
  return u
}

const filterLayersToUniverse = (
  layers: { openNotes: string[]; heartNotes: string[]; baseNotes: string[] },
  universe: Set<string>,
): { openNotes: string[]; heartNotes: string[]; baseNotes: string[] } => ({
  openNotes: layers.openNotes.filter(n => universe.has(n.trim().toLowerCase())),
  heartNotes: layers.heartNotes.filter(n => universe.has(n.trim().toLowerCase())),
  baseNotes: layers.baseNotes.filter(n => universe.has(n.trim().toLowerCase())),
})

const mergeStructuredNotesWithLlm = async (
  llm: ChatOpenAI,
  structured: { openNotes: string[]; heartNotes: string[]; baseNotes: string[] },
  fullText: string,
  productName: string,
): Promise<{ openNotes: string[]; heartNotes: string[]; baseNotes: string[] }> => {
  if (noteLayerCount(structured) === 0 || !fullText?.trim()) return structured
  const universe = buildLowercaseNoteUniverse(structured, fullText)
  const user = `Product: "${productName.slice(0, 200)}"

Structured notes already found (keep every one; re-layer across open/heart/base only — do NOT add new note names that are not already in the structured arrays or in an explicit labeled note line in the full text):
openNotes: ${JSON.stringify(structured.openNotes)}
heartNotes: ${JSON.stringify(structured.heartNotes)}
baseNotes: ${JSON.stringify(structured.baseNotes)}

Full product text:
"${fullText.slice(0, 3500)}"`
  try {
    const response = await llm.invoke([
      { role: "system", content: MERGE_STRUCTURED_SUPPLEMENT_PROMPT },
      { role: "user", content: user },
    ])
    const merged = parseNotesFromLlmResponse(getLlmInvocationText(response))
    const mergedSanitized = filterLayersToUniverse(merged, universe)
    const before = noteLayerCount(structured)
    const after = noteLayerCount(mergedSanitized)
    if (after === 0 || after < Math.ceil(before * 0.5)) return structured
    // Union only materials that already appeared in structured or regex flat extraction — never raw LLM hallucinations.
    return {
      openNotes: uniqueNotes([...structured.openNotes, ...mergedSanitized.openNotes]),
      heartNotes: uniqueNotes([...structured.heartNotes, ...mergedSanitized.heartNotes]),
      baseNotes: uniqueNotes([...structured.baseNotes, ...mergedSanitized.baseNotes]),
    }
  } catch {
    return structured
  }
}

async function extractNotesFromDescription(
  llm: ChatOpenAI,
  description: string,
  productNameFallback: string | undefined,
  inferenceMode: NoteInferenceMode = "standard",
): Promise<{
  layers: { openNotes: string[]; heartNotes: string[]; baseNotes: string[] }
  extractionPath: "description" | "name_only" | "none"
}> {
  const empty = { openNotes: [] as string[], heartNotes: [] as string[], baseNotes: [] as string[] }
  const descTrimmed = description?.trim() ?? ""
  const nameTrimmed = productNameFallback?.trim() ?? ""

  if (!descTrimmed && !nameTrimmed) return { layers: empty, extractionPath: "none" }

  // ── Path A: We have a description ────────────────────────────────────────
  if (descTrimmed) {
    const userContent = nameTrimmed
      ? `Product name: "${nameTrimmed.slice(0, 200)}"\n\nProduct description:\n"${descTrimmed.slice(0, 3500)}"`
      : `Product description:\n"${descTrimmed.slice(0, 3500)}"`

    try {
      const response = await llm.invoke([
        { role: "system", content: NOTE_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ])
      const notes = parseNotesFromLlmResponse(getLlmInvocationText(response))
      if (notes.openNotes.length + notes.heartNotes.length + notes.baseNotes.length > 0) {
        return { layers: notes, extractionPath: "description" }
      }
    } catch {
      // fall through to retry
    }

    try {
      const retryResponse = await llm.invoke([
        {
          role: "system",
          content:
            NOTE_SYSTEM_PROMPT +
            "\n\nIMPORTANT: Also look at the product name for scent ingredients (e.g. 'Vanilla Ice Cream' → vanilla, cream; 'Lavender Honey' → lavender, honey). Extract every fragrance ingredient or scent term you can find anywhere in the text, even single words. When layer is unclear, put in heartNotes.",
        },
        { role: "user", content: userContent },
      ])
      const retryNotes = parseNotesFromLlmResponse(getLlmInvocationText(retryResponse))
      if (retryNotes.openNotes.length + retryNotes.heartNotes.length + retryNotes.baseNotes.length > 0) {
        return { layers: retryNotes, extractionPath: "description" }
      }
    } catch {
      // fall through to name-only
    }
  }

  // ── Path B: No description (or description extraction failed) — extract from name ──
  if (nameTrimmed) {
    const namePrompt = inferenceMode === "strict" ? NAME_ONLY_PROMPT_STRICT : NAME_ONLY_PROMPT
    try {
      const response = await llm.invoke([
        { role: "system", content: namePrompt },
        { role: "user", content: `Product name: "${nameTrimmed.slice(0, 200)}"` },
      ])
      return {
        layers: parseNotesFromLlmResponse(getLlmInvocationText(response)),
        extractionPath: "name_only",
      }
    } catch {
      return { layers: empty, extractionPath: "none" }
    }
  }

  return { layers: empty, extractionPath: "none" }
}

/**
 * Fallback when description + name extraction returned no notes: ask LLM to infer from
 * the perfume name and/or knowledge from Fragrantica, Basenotes, or common perfumery.
 */
async function extractNotesFallbackLookup(
  llm: ChatOpenAI,
  productName: string,
  houseName?: string,
): Promise<{ openNotes: string[]; heartNotes: string[]; baseNotes: string[] }> {
  const empty = { openNotes: [], heartNotes: [], baseNotes: [] }
  if (!productName?.trim()) return empty
  const name = productName.trim().slice(0, 300)
  const houseCtx = houseName?.trim() ? `\nPerfume house: "${houseName.trim()}"` : ""
  try {
    const response = await llm.invoke([
      { role: "system", content: FALLBACK_LOOKUP_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Perfume name: "${name}"${houseCtx}\n\nReturn a JSON object with openNotes, heartNotes, baseNotes. Use the name, the house, and your knowledge (Fragrantica, Basenotes, indie perfume communities) to list as many notes as possible. Do NOT return empty arrays.`,
      },
    ])
    return parseNotesFromLlmResponse(getLlmInvocationText(response))
  } catch {
    return empty
  }
}
export {
  getLlmInvocationText,
  parseNotesFromLlmResponse,
  extractNotesFromDescription,
  mergeStructuredNotesWithLlm,
  extractNotesFallbackLookup,
  mergeExistingPythonNotes,
}
