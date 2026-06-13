import { ChatOpenAI } from "@langchain/openai"
import type { NoteValidationMode } from "@/types/scraper"
import type { ScraperPipelineOptions } from "@/lib/scraper/stages/pipeline-options"
import { getLlmInvocationText } from "@/lib/scraper/stages/llm-extraction"

// ---------------------------------------------------------------------------
// Bulk LLM note validator (runs once per scrape over the union of unique notes)
// ---------------------------------------------------------------------------

const NOTE_VALIDATOR_SYSTEM_PROMPT = `You are a perfumery expert. For each input string, decide whether it names a real fragrance material and, if needed, normalise it to just the material — stripping pure-prose adjectives that are NOT olfactory descriptors.

OLFACTORY descriptors that MUST be kept with the material (they describe how it smells / its texture or origin):
  creamy, milky, buttery, smoky, smoked, fresh, dry, warm, cool, sweet, dark, deep, bright, green, woody, resinous, powdery, ambered, salted, candied, toasted, roasted, burnt, raw, aged, vintage, wild, fermented, balsamic, golden (when origin/material like "golden amber"), tahitian, madagascar, bourbon, bulgarian, sicilian, indian, javanese, white, black, pink, red, blue, granny, soft (only with musk/leather/woods), whipped (only with cream/milk), powdery (only with woods/iris/musk).
  Examples: "creamy vanilla" → "creamy vanilla" ✓, "warm sandalwood" → "warm sandalwood" ✓, "smoked vanilla" → "smoked vanilla" ✓, "tahitian vanilla" → "tahitian vanilla" ✓, "black currant" → "black currant" ✓, "granny smith apple" → "granny smith apple" ✓, "whipped cream" → "whipped cream" ✓, "soft musk" → "soft musk" ✓, "powdery woods" → "powdery woods" ✓, "vanilla cream" → "vanilla cream" ✓.

VALID notes that are NOT single common materials — keep these exactly as-is (DO NOT drop them as "generic"):
  marshmallow fluff, vanilla cream, orris butter, whipped cream, soft musk, powdery woods, granny smith apple, pitahaya, praline, orris root, iris butter, cashmere wood, cashmere woods, benzoin resinoid, ambrette seed, ambroxan, hedione, iso e super, javanol, clearwood, galaxolide, habanolide, musks (accord), cashmeran, solar musk, skin musk, solar wood, tonka absolute, skin accord.

PROSE adjectives that MUST be stripped, leaving only the material:
  delicate, sunlit, moonlit, glowing, romantic, dreamy, silken, velvety, intoxicating, mysterious, dangerous, alluring, seductive, sultry, airy, juicy, tropical (as adjective), modern, effortless, refined, ethereal, fluffy, sugary, cloudlike, glossy, lush, vibrant, opulent, decadent, sensuous, sensual, magnetic, luminous, gleaming, shimmering, whispered, hidden, secret, ripe, fluffy, plush, expensive, comforting, addictive, sparkling (as adjective), bright (only alone), crisp (only alone).
  Examples: "delicate apple blossom" → "apple blossom"; "soft violet" → "violet"; "sugary marshmallow clouds" → "marshmallow"; "glossy strawberry glaze" → "strawberry"; "ripe blackcurrant" → "blackcurrant"; "lush jasmine" → "jasmine"; "fluffy marshmallow" → "marshmallow"; "crisp green apple" → "green apple"; "sparkling bergamot" → "bergamot".

DROP (do not include in output at all) when the string has no material at its core:
- Article-prefixed prose with no material: "a sweet", "the night", "the center turns resinous".
- Sensory experience words alone: "warmth", "sweetness", "feel", "texture", "character", "scents", "presence", "opening", "finish".
- Vague descriptors alone: "tropical", "fruity", "fresh", "modern", "airy", "glowing", "softly", "effortlessly", "delicate", "warmer", "smoother", "playful", "upscale".
- Generic substrate-only words: "wood", "florals", "flowers", "fruit", "spice", "musks" (alone, with no qualifier). But "sandalwood" ✓, "cashmere wood" ✓, "white musk" ✓, "white flowers" ✓, "white flower" ✓, "white florals" ✓, "red fruits" ✓, "citrus fruits" ✓, "wild flowers" ✓, "spring flowers" ✓, "tropical flowers" ✓, "fresh flowers" ✓. Any adjective + substrate combination that names a recognised perfumery accord is VALID.
- Multi-word prose with no nameable material: "sunlit burst of melon" → DROP (it has "melon" but the wrapper is prose; ✗ keep only if the core material is unambiguous AND extractable, e.g. "sunlit burst of melon" → "melon" is OK to extract; use judgment). When in doubt, extract just the material.
- Concatenated/mangled text: "moonlit characterwarm", "crme brle custard" (the latter is mangled "crème brûlée custard" — accept if you can canonicalise to "crème brûlée").
- Phrases describing how the scent acts: "musk make it smooth", "adding softness", "warmer finish with vanilla", "a heart of coffee" → DROP (or extract bare "vanilla"/"coffee" if it is the only material).
- E-commerce / policy / non-material content.

Return ONLY a JSON object in this exact shape (no markdown, no commentary):
{
  "valid": [
    { "in": "<original input string, lowercase>", "out": "<cleaned material name, lowercase>" }
  ]
}

Rules for the response:
- Only include entries whose \`out\` is a real material (or material with kept olfactory descriptor).
- \`in\` must EXACTLY match an input string (lowercased). Never invent inputs.
- \`out\` is the cleaned material name. Often \`out === in\` (no change needed). When stripping prose adjectives, \`out\` is shorter.
- Omit any input that has no extractable material at all.
- Lowercase only. No duplicates by \`in\`.`

/**
 * Classify and clean every candidate note with one bulk LLM call. Returns a substitution Map
 * from lowercased original note to lowercased cleaned material name. Notes not present in the
 * map should be DROPPED.
 *
 * Fail-open: any error or unparseable response returns an identity map (every input → itself)
 * so the scrape never loses notes due to a validator outage.
 *
 * Cost: a single chat-completion per scrape regardless of batch size.
 */
const validateNotesWithLlm = async (
  llm: ChatOpenAI,
  candidates: string[],
): Promise<Map<string, string>> => {
  const lowered = Array.from(
    new Set(candidates.map(n => n.trim().toLowerCase()).filter(Boolean)),
  )
  const identityMap = (): Map<string, string> => new Map(lowered.map(n => [n, n]))
  if (lowered.length === 0) return identityMap()

  try {
    const response = await llm.invoke([
      { role: "system", content: NOTE_VALIDATOR_SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify({ candidates: lowered }) },
    ])
    const text = getLlmInvocationText(response)
    const cleaned = text.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return identityMap()

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    const rawValid = Array.isArray(parsed.valid) ? parsed.valid : []
    const substitutions = new Map<string, string>()
    const inputSet = new Set(lowered)
    for (const entry of rawValid) {
      if (!entry || typeof entry !== "object") continue
      const e = entry as Record<string, unknown>
      const inLc = typeof e.in === "string" ? e.in.trim().toLowerCase() : ""
      const outLc = typeof e.out === "string" ? e.out.trim().toLowerCase() : ""
      if (!inLc || !outLc) continue
      if (!inputSet.has(inLc)) continue
      substitutions.set(inLc, outLc)
    }
    /**
     * Sanity floor: if the model returned a substitution map covering less than 10% of inputs,
     * assume the call went off the rails (format slip, truncation) and fail open. Real fragrance
     * batches reliably have most notes pass; <10% coverage is a smell, not a real rejection rate.
     */
    if (substitutions.size === 0 || substitutions.size < Math.floor(lowered.length * 0.1)) {
      return identityMap()
    }
    return substitutions
  } catch {
    return identityMap()
  }
}

const resolveNoteValidationMode = (
  opts: ScraperPipelineOptions,
): NoteValidationMode => {
  if (opts.noteValidationMode === "off" || opts.noteValidationMode === "llm") {
    return opts.noteValidationMode
  }
  const envMode = (process.env.NOTES_PIPELINE_VALIDATION ?? "").trim().toLowerCase()
  if (envMode === "off") return "off"
  return "llm"
}
export { validateNotesWithLlm, resolveNoteValidationMode }
