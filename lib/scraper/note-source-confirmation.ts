/**
 * Confirm extracted notes against merchant source text (description / notesText).
 * Supports labeled pyramids, flat lists, and unlabeled "Fragrance Notes" material blocks.
 */

import { canonicalizeNote } from "@/lib/scraper/canonical-notes"
import {
  DOM_ARTIFACT_EXACT_TOKENS,
  KEBAB_DOM_ARTIFACT_RE,
  KEBAB_UI_VOCAB_SEGMENTS,
} from "@/lib/scraper/note-artifact-blocklist"

/** Sections after note lists — not valid note sources. */
const NOTE_REGION_END_RE =
  /\b(?:when\s+to\s+wear|how\s+it\s+wears|main\s+accords?|available\s+sizes?|processing(?:\s*[:•|])|important\s+(?:order\s+)?policy|disclaimer|the\s+vibe|i\s+was\s+told|making\s+a\s+dupe|please\s+text|sizes?\s+\d+\s*ml|hand-blended|hand\s+filled|for\s+milk\s+lovers|pastel\s+girls|fans\s+of|gentle\s+projection|extrait\s+de\s+parfum\s+strength)\b/i

/** Marketing / ops copy that may appear before note blocks. */
const PRE_NOTE_BOILERPLATE_END_RE =
  /\b(?:the\s+vibe|fragrance\s+notes?|scent\s+notes?|notes?\s*:|top\s*:|heart\s*:|base\s*:|featured\s+notes?|key\s+notes?)\b/i

/**
 * Split glued material headers (VanillaSmooth, Tree MossCool). Lookbehind blocks splits
 * inside "Tree Moss" (otherwise Moss(?=Cool) fires on the second word).
 */
const GLUED_MATERIAL_LINE_SPLIT_RE =
  /(?<![A-Za-z/])(?=\b(?:Tree\s+Moss|[A-Z][\p{L}'-]{2,})(?=(?:Soft|Smooth|Clean|Cool|Warm|Never|giving)))/giu

const isMaterialLineChunk = (chunk: string): boolean => {
  const t = chunk.trim()
  if (!t || t.length < 2) return false
  if (/\bfragrance\s+notes?\b/i.test(t)) return false
  if (/^(?:skin|like|finish|never|elegant|refined|tailored|structured|clean|cool|warm|soft|smooth|giving|powder|shadow|green|depth|and|woody)\b/i.test(t)) {
    return false
  }
  return /^(?:tree\s+moss|[A-Z][\p{L}'-]+)/iu.test(t)
}

const stripLeadingEmojiDecorators = (s: string): string =>
  s.replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}\s]+/u, "").trim()

const splitFragranceNotesBlockLines = (block: string): string[] => {
  const trimmed = block.trim()
  if (!trimmed) return []
  if (/\n/.test(trimmed)) {
    return trimmed
      .split(/\n+/)
      .map(l => stripLeadingEmojiDecorators(l.trim()))
      .filter(Boolean)
  }
  const emojiParts = trimmed
    .split(/(?=[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}])/u)
    .map(p => stripLeadingEmojiDecorators(p.trim()))
    .filter(Boolean)
  if (emojiParts.length >= 2) return emojiParts
  const parts = trimmed
    .split(GLUED_MATERIAL_LINE_SPLIT_RE)
    .map(p => stripLeadingEmojiDecorators(p.trim()))
    .filter(p => p && isMaterialLineChunk(p))
  return parts.length > 0 ? parts : isMaterialLineChunk(trimmed) ? [stripLeadingEmojiDecorators(trimmed)] : []
}

const MATERIAL_LINE_DESCRIPTOR_START =
  /\b(?:soft|smooth|clean|cool|warm|never|syrupy|elegant|refined|tailored|skin|like|finish|depth|shadow|green|structured|powder|airy|cozy|gentle|hand|blended|projection|pastel|fans|moon)\b/i

const FLAT_LIST_CAPTURE_RES: RegExp[] = [
  /(?:^|[\s.!?\n*])(?:featured|key|main|primary|signature|dominant)\s+notes?\s*[:\-\u2013\u2014–—]\s*([^\n]+)/gi,
  /(?:^|[\s.!?\n])(?:fragrance\s+)?notes?\s*[:\-\u2013\u2014–—]\s*([^\n]+)/gi,
  /(?:^|[\s.!?\n*])(?:perfume|fragrance|scent|aroma|olfactory)\s+notes?\s+include\s+([^.!?\n*]+)/gi,
  /(?:^|[\s.!?\n*])(?:perfume|fragrance|scent|aroma|olfactory)\s+notes?\s+(?:are|is)\s+([^.!?\n*]+)/gi,
  /(?:^|[\s.!?\n*])(?:olfactory|scent|fragrance|aroma|perfume)\s+(?:profile|composition|pyramid)\s*[:\-\u2013\u2014–—]\s*([^\n]+)/gi,
  /(?:^|[\s.!?\n*])(?:key\s+)?accords?\s*[:\-\u2013\u2014–—]\s*([^\n]+)/gi,
  /(?:^|[\s.!?\n*])(?:the\s+)?(?:fragrance|scent|perfume)\s+composition\s+(?:includes|features|contains)\s+([^.!?\n*]+)/gi,
  /(?:^|[\s.!?\n*])\bwith\s+notes?\s+of\s+([^.!?\n*]+)/gi,
  /(?:^|[\s.!?\n*])\bnotes?\s+of\s+([^.!?\n*]+)/gi,
  /(?:^|[\s.!?\n*])\b(?:top|heart|middle|mid|base|opening|dry\s*down)\s*(?:notes?)?\s*[:\-\u2013\u2014–—]\s*([^\n]+)/gi,
]

const splitCamelCase = (s: string): string =>
  s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")

const normalizeCorpusText = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ")
    .replace(/[^\p{L}\p{N}\s/•·,;|✧✦\-–—]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** Pull material name(s) from one line in an unlabeled "Fragrance Notes" block (Andromeda's Moon style). */
export const parseMaterialFromFragranceNoteLine = (line: string): string[] => {
  const trimmed = stripLeadingEmojiDecorators(line.trim())
  if (!trimmed || trimmed.length > 140) return []
  if (/^(?:main\s+accords?|when\s+to\s+wear|available\s+sizes?)/i.test(trimmed)) return []

  const out: string[] = []
  const deGluedLine = splitCamelCase(trimmed).trim()
  if (/^tree\s+moss\b/i.test(deGluedLine)) {
    const tm = canonicalizeNote("tree moss")
    if (tm) return [tm]
  }
  for (const segment of trimmed.split(/\s*\/\s*/)) {
    const head = segment.split(/[,—–\-]|(?=Soft|Smooth|Clean|Cool|Warm|Never|giving|elegant|refined)/i)[0]?.trim() ?? segment
    const deGlued = splitCamelCase(head).trim()
    if (!deGlued) continue

    const words = deGlued.split(/\s+/).filter(Boolean)
    const materialWords: string[] = []
    for (const w of words) {
      const lw = w.toLowerCase()
      if (MATERIAL_LINE_DESCRIPTOR_START.test(lw) && materialWords.length > 0) break
      if (/^(?:and|or|the|a|an|with|for|of|in|on|at|to|is|are|was|were|be|been|it|this|that|these|those)$/i.test(lw))
        break
      materialWords.push(lw)
      if (materialWords.length >= 4) break
    }
    if (materialWords.length === 0) continue
    const phrase = canonicalizeNote(materialWords.join(" "))
    if (phrase) out.push(phrase)
  }
  return out
}

/**
 * Unlabeled merchant block: "Fragrance Notes" header then material lines (no Top/Heart/Base).
 * Example: White Orris / Iris … Vanilla … Cedarwood … Musk … Tree Moss
 */
export const extractUnlabeledFragranceNotesBlock = (text: string): string[] => {
  const raw = (text ?? "").replace(/\r/g, "\n")
  const headerIdx = raw.search(/\bfragrance\s+notes?\b(?!\s*(?:include|are|is|:|\s*[-–—]))/i)
  if (headerIdx < 0) return []

  const afterHeader = raw.slice(headerIdx).replace(/^\s*fragrance\s+notes?\s*/i, "")
  const endMatch = NOTE_REGION_END_RE.exec(afterHeader)
  const block = (endMatch ? afterHeader.slice(0, endMatch.index) : afterHeader).trim()
  if (!block) return []

  const found: string[] = []
  for (const line of splitFragranceNotesBlockLines(block)) {
    found.push(...parseMaterialFromFragranceNoteLine(line))
  }
  let deduped = [...new Set(found.map(canonicalizeNote).filter(Boolean))]
  if (deduped.includes("tree") && deduped.includes("moss") && !deduped.includes("tree moss")) {
    deduped = deduped.filter(n => n !== "tree" && n !== "moss").concat(["tree moss"])
  }
  return deduped
}

const extractLayerLabelChunks = (source: string): string[] => {
  const chunks: string[] = []
  const re =
    /\b(?:top|open|opening|head|heart|middle|mid|core|body|center|centre|base|bottom|background|foundation|dry\s*down|drydown)\s*(?:notes?)?\s*[:\-\u2013\u2014–—]\s*([^\n]+)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) {
    if (m[1]?.trim()) chunks.push(m[1])
  }
  return chunks
}

/**
 * Text corpus built only from regions that plausibly list fragrance materials.
 * Used to confirm extracted notes against the merchant description — not noir copy.
 */
export const buildNoteConfirmationCorpus = (source: string): string => {
  const raw = (source ?? "").replace(/\r/g, "\n")
  const parts: string[] = []

  for (const re of FLAT_LIST_CAPTURE_RES) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(raw)) !== null) {
      if (m[1]?.trim()) parts.push(m[1])
    }
  }

  parts.push(...extractLayerLabelChunks(raw))
  parts.push(...extractUnlabeledFragranceNotesBlock(raw))

  const blockMatch = raw.match(
    /\b(?:fragrance\s+notes?|scent\s+notes?|note\s+structure)\b([\s\S]*?)(?=\n\s*(?:when\s+to\s+wear|main\s+accords?|available\s+sizes?|how\s+it\s+wears|processing|disclaimer|important|shipping)|$)/i,
  )
  if (blockMatch?.[1]?.trim()) parts.push(blockMatch[1])

  const noteStructureMatch = raw.match(/\bnote\s+structure\s*:?\s*([\s\S]*?)(?=shipping|series\s*:|$)/i)
  if (noteStructureMatch?.[1]?.trim()) parts.push(noteStructureMatch[1])

  const boilerplateCut = raw.search(PRE_NOTE_BOILERPLATE_END_RE)
  const trimmedSource = boilerplateCut >= 0 ? raw.slice(boilerplateCut) : raw
  const endIdx = trimmedSource.search(NOTE_REGION_END_RE)
  if (endIdx > 0) parts.push(trimmedSource.slice(0, endIdx))

  const andromedaPyramid = raw.match(
    /\b(?:notes?\s+pyramid|notes?)\s+top\b[\s\S]{8,320}?\bbase\b\s+[\s\S]{2,120}?(?=\s+(?:scent\s+story|vibe\b|layering|original\s+manufacturers)|$)/i,
  )
  if (andromedaPyramid?.[0]?.trim()) parts.push(andromedaPyramid[0])

  return normalizeCorpusText(parts.join(" "))
}

const sourceTextNoteRegion = (fullSource: string): string => {
  const end = NOTE_REGION_END_RE.exec(fullSource)?.index
  return end != null && end >= 0 ? fullSource.slice(0, end) : fullSource
}

const hasLabeledNoteListSignal = (text: string): boolean =>
  /\b(?:featured|key|main|primary|signature|dominant)\s+notes?\s*:/i.test(text) ||
  /\b(?:top|heart|middle|mid|base|opening|dry[\s-]*down)\s*(?:notes?)?\s*:/i.test(text) ||
  /\bnotes?\s+pyramid\b/i.test(text) ||
  /\bnotes?\s+top\b.+?\bheart\b.+?\bbase\b/i.test(text) ||
  /\bfragrance\s+notes?\b/i.test(text) ||
  /\bnote\s+structure\b/i.test(text) ||
  /\b(?:scent|fragrance|perfume)\s+notes?\s+(?:include|are|is)\b/i.test(text) ||
  /\bwith\s+notes?\s+of\b/i.test(text) ||
  /\bnotes?\s+of\b/i.test(text)

const PROSE_FRAGMENT_TOKENS = new Set([
  "when",
  "feel",
  "expensive",
  "composed",
  "polished",
  "office",
  "wear",
  "two",
  "fragrances",
  "being",
  "issue",
  "told",
  "thats",
  "why",
  "there",
  "want",
  "please",
  "text",
  "making",
  "dupe",
  "formula",
  "blend",
  "found",
  "original",
  "intensify",
  "difference",
  "invest",
  "testing",
  "touch",
  "then",
  "fabric",
  "rgba",
  "margin",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "top",
  "heart",
  "base",
  "middle",
  "style",
  "projection",
  "facets",
  "strength",
  "concentration",
  "margi",
])

export const LAYER_LABEL_TOKENS = new Set([
  "top",
  "heart",
  "base",
  "middle",
  "mid",
  "opening",
  "head",
  "drydown",
  "dry down",
  "end",
  "notes",
  "note",
])

/** Single-word color/marketing labels — not pyramid materials (e.g. "pink" from "fairy-kissed pink"). */
export const STANDALONE_COLOR_NOTE_RE =
  /^(?:pink|red|blue|green|yellow|purple|blush|nude|fuchsia|magenta|turquoise|navy|teal|grey|gray|brown|beige|tan|taupe|crimson|scarlet|azure|ivory|bronze|silver|gold)$/i

/** Main-accord / genre labels — not pyramid materials when standing alone. */
export const STANDALONE_ACCORD_DESCRIPTOR_RE =
  /^(?:powdery|woody|musky|mossy|fresh|sweet|floral|oriental|gourmands?|citrus|spicy|aromatic|green|aquatic|fruity|smoky|balsamic|earthy|intense|light|dark|lactonic|desserts?|white floral|creamy florals?|warm wood|second-skin|frosted-pastel|frosted|pastel|originally from byredo|originally from commodity|resort evenings|warm days|starry date evenings|date evenings|celestial hug|wear guide|delicate|intimate|cozy|celestial|flirtatious|glamorous|addictive|ruby|sexy|pretty|playful|warm|airy|joyfully|joyfully luminous|luminous|addictive|comforting|candy-drip|creamy|smooth|smoother|sugary|golden mist|warm sweetness|european elegance|elegant|opulent|refined|radiant|silky|sensual|seductive|rebellious|unforgettable|plush|magnetic|alluring|intoxicating|effortless|dreamy|rebellious|golden light|golden glow|fairy-kissed|sun-kissed|star-kissed|confidence|courage|vitality|balance|healing|bold|feminine|masculine|pure|layered|alive|passion|comfort|clarity|elegance|rebellion|energy|warmth|soul|edge|tradition|indulgent|spark|fusion|composition|power|zesty citrus|aromatic herbs)$/i

/** Strip marketing lead-ins glued to a material ("infused with bright bergamot" → "bergamot"). */
export const stripFragranceNoteProseLead = (note: string): string => {
  const s = note.trim()
  if (!s) return s

  const wrapped = s.match(
    /^(?:infused\s+with|lifted\s+by|surrounded\s+by|wrapped\s+in|opens?\s+with|mixed\s+with|blended\s+with|layered\s+with|topped\s+with|finished\s+with|laced\s+with|paired\s+with|combined\s+with|swirled\s+with|entwined\s+with|breaks?\s+the\s+unexpected\s+accord\s+of|unexpected\s+accord\s+of|accord\s+of)\s+(?:bright|aromatic|soft|warm|unexpected|the\s+)?(.+)$/i,
  )
  if (wrapped?.[1]) return wrapped[1].trim()

  const hint = s.match(
    /^(?:a\s+|an\s+|the\s+)?(?:hint|touch|whisper|thread|veil|wash|burst|spray|splash|swirl|cloud)\s+of\s+(?:rich|soft|warm|bright|fresh|sweet)?,?\s*(.+)$/i,
  )
  if (hint?.[1]) return hint[1].trim()

  const overlay = s.match(
    /^(?:luxuriously\s+|gently\s+|softly\s+)?(?:overlaying|resting\s+on|atop)\s+(?:a\s+base\s+of\s+)?(.+)$/i,
  )
  if (overlay?.[1]) return overlay[1].trim()

  const marketingAdj = s.match(/^(?:the\s+)?(?:fabulous|luxurious|exquisite|decadent|glorious)\s+(.+)$/i)
  if (marketingAdj?.[1]) return marketingAdj[1].trim()

  return s
}

/** Peel merchant origin / grade suffixes ("vetiver from haiti" → "vetiver", "cumin he" → "cumin"). */
export const peelFragranceNoteOriginSuffix = (note: string): string =>
  note
    .trim()
    .replace(/\s+from\s+(?:haiti|laos|madagascar|sri\s+lanka|indonesia|ceylon|siam|bulgaria|morocco|grasse|turkey|jungle|laos)\s*$/i, "")
    .replace(/\s+he(?:\s+sustainable)?\s*$/i, "")
    .trim()

/** Strip trailing Shopify marketing copy glued to merchant note phrases. */
export const peelMarketingDescriptorTail = (note: string): string => {
  let s = note.trim()
  if (!s) return s
  let prev = ""
  while (s !== prev) {
    prev = s
    s = s
      .replace(
        /\s+(?:projection|projections|facets|trail|trails|style|strength|concentration|nuances|enveloping|sparkle|halos?|longer\s+on\s+fabric|clean\s+halo|summer\s+warm\s+days|sugar\s+sparkle|soft\s+sweetness)\b.*$/i,
        "",
      )
      .replace(
        /\s+(?:hit\s+first|wrap\s+you\s+in(?:\s+a\s+haze)?|melt\s+into\s+skin|wrap\s+around\s+you|lingers?\s+on\s+your\s+skin|wear\s+guide|good\s+to\s+know)\b.*$/i,
        "",
      )
      .replace(
        /\s+(?:wrap\s+(?:yourself|your\s+senses)|float\s+into|if\s+you\s+love|this\s+perfume\s+is|perfect\s+for\s+those|like\s+the\s+scent\s+of)\b.*$/i,
        "",
      )
      .replace(/\s+wear\s+it(?:\s+on)?\b.*$/i, "")
      .replace(
        /\s+(?:drenched\s+in|creating\s+an?\s+(?:unforgettable|experience|memory)|rather\s+than|flanker\s+to|infused\s+cocktails?)\b.*$/i,
        "",
      )
      .replace(
        /\s+(?:bottled\s+by|hand-?blended(?:\s+with\s+care)?|followed\s+by\s+a\s+heart\s+of|brings\s+effortless\s+sensuality|utterly\s+magnetic|(?:j|u)uicy\s+signature\s+scent)\b.*$/i,
        "",
      )
      .replace(/(?<=\bvanilla)\s+cloud\s+cream\b.*$/i, "")
      .replace(/(?<=\bcandy)\s+air\b.*$/i, "")
      .replace(/^\s*sugary\s+(?=marshmallow)/i, "")
      .replace(/(?<=marshmallow)\s+clouds?\b.*$/i, "")
      .replace(/^\s*creamy\s+(?=santal)/i, "")
      .replace(/\s+(?:originally\s+from)(?:\s+[a-z][\w'-]*){1,4}\b.*$/i, "")
      .replace(/\s+(?:on\s+fabric|warm\s+days)\b.*$/i, "")
      .replace(/\s+\d+\s+reviews?\b.*$/i, "")
      .replace(/\s+reviews?\s+regular(?:\s+price)?\b.*$/i, "")
      .replace(/\s+(?:regular|sale)\s+price\b.*$/i, "")
      .replace(/^\s*(?:soft|smooth)\s+(?=vanilla|tonka\b)/i, "")
      .replace(/\s*[—–—-]\s*(?:smooth|creamy|aromatic|refined|delicate|opulent|radiant|silky|indulgent|feminine|unforgettable|never|never\s+syrupy)\b.*$/i, "")
      // Generic em-dash marketing tail: "delicate warmth — indulgent", "sweetness — never syrupy".
      .replace(/\s*[—–]\s+[a-z][\s\S]*$/i, "")
      .replace(/\s+european\s+elegance\b.*$/i, "")
      .replace(/\s+\bfragrance\b\s*$/i, "")
      .replace(/\s+(?:your\s+skins?|skin)\s+signature\b.*$/i, "")
      .replace(/\s+signature\s*$/i, "")
      .replace(/\s+scent\s+description\b.*$/i, "")
      .replace(/\s+description\b\s*$/i, "")
      .replace(
        /\s+(?:curved\s+backs|folk\s+songs|bookmakers|busy\s+calculating|the\s+hustle|at\s+night|paintings|echoed|whispered|whistle|departs|ladies)\b.*$/i,
        "",
      )
      .trim()
  }
  return s
}

/** Strip trailing sentence punctuation without breaking material abbreviations (e.o., abs.). */
const stripTrailingNotePunctuation = (s: string): string => {
  const t = s.trim()
  if (!t) return t
  // Keep essential-oil / absolute abbreviations intact.
  if (/\b(?:e\.o|abs|a\.o|h\.e)\.?$/i.test(t)) {
    return t.replace(/[;:!?"'`]+$/g, "").trim()
  }
  return t.replace(/[.,;:!?"'`]+$/g, "").trim()
}

/** Normalize one extracted note candidate; return null when it is marketing/prose junk. */
export const sanitizeExtractedNoteCandidate = (note: string): string | null => {
  const raw = stripTrailingNotePunctuation(
    note
      .trim()
      .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
      .replace(/\)+$/g, "")
      .replace(/^\(+/g, "")
      .replace(/^[.,;:!?"'`]+/g, "")
      .trim(),
  )
  if (!raw) return null
  // Storefront / collection URLs bleed into pyramid arrays (Widian CSV).
  if (/^https?:\/\//i.test(raw) || /https?:\/\//i.test(raw)) return null
  if (/\b[\w-]+\.(?:com|net|org|io)(?:\/|\s|$)/i.test(raw) && !/\b(?:e\.o|abs)\b/i.test(raw)) return null
  // AOE "A CHERRY ON TOP" → peel article from multi-word materials; keep rejecting "a sweet".
  const articleMulti = raw.match(/^(?:a|an|the)\s+(\S+\s+\S[\s\S]*)$/i)
  if (articleMulti?.[1]) return sanitizeExtractedNoteCandidate(articleMulti[1])
  if (/^(?:a|an|the)\s+[a-z]+$/i.test(raw)) return null
  if (/^then\s+/i.test(raw)) return null
  if (/^this\s+/i.test(raw)) return null
  if (/^(?:softened|becomes)\s+with\b/i.test(raw)) return null
  if (/^becomes\s+your\s+skins?\b/i.test(raw)) return null
  if (/\b\w+-kissed\b/i.test(raw)) return null
  if (/^(?:top|middle|base)\s+notes?$/i.test(raw)) return null
  const layerLeading = raw.match(/^(?:top|middle|base)\s+notes?\s+(?:are|is|of)\s+(.+)$/i)
  if (layerLeading?.[1]) return sanitizeExtractedNoteCandidate(layerLeading[1])
  if (/^(?:top|heart|base|middle)\b\s+\w+/i.test(raw)) return null
  if (/\b(?:top|heart|base|middle)\s*$/i.test(raw)) return null
  if (/\b(?:top|heart|base|middle)\b/i.test(raw) && raw.split(/\s+/).length >= 2) return null
  if (/\s+(?:the|from|with|of|into)\s*$/i.test(raw)) return null
  // Incomplete marketing tails: "caramel in a radiant", "composition full of".
  if (/\bin\s+a\s+\w+$/i.test(raw)) return null
  if (/\bfull\s+of\b/i.test(raw)) return null
  // Experience words mistaken for materials (Widian / boutique copy). Keep "amber warmth".
  if (/\b(?:energy|confidence|elegance|rebellion|clarity|comfort)\b/i.test(raw)) return null
  if (/\bwarmth\b/i.test(raw) && !/\bamber\s+warmth\b/i.test(raw)) return null
  // Blend-prose fragments from "blend of two fragrances one being…".
  if (
    /^(?:two\s+fragrances|one\s+being|and\s+that'?s|why\s+there|issue|was\s+an\s+issue|black\s+tie)$/i.test(
      raw,
    )
  ) {
    return null
  }
  // Milano Fragranze / WooCommerce: description prose glued after last base note ("Acquatic notes. Curved backs…").
  if (
    /\b(?:abs|accord|resinoid|essence|e\.o\.?|notes)\b/i.test(raw) &&
    /\b(?:curved|folk|bookmakers|busy|calculating|hustle|paintings|echoed|whispered|shadows|closing|midnight|rain|whistle|departs)\b/i.test(
      raw,
    )
  ) {
    return null
  }

  let peeled = stripFragranceNoteProseLead(raw)
  peeled = peelMarketingDescriptorTail(peeled)
  if (!peeled) return null
  // Em-dash marketing slogans: keep the material before the dash when present.
  if (/[—–]/.test(peeled)) {
    const beforeDash = peelMarketingDescriptorTail(peeled.split(/[—–]/)[0]?.trim() ?? "")
    if (!beforeDash || beforeDash === peeled) return null
    return sanitizeExtractedNoteCandidate(beforeDash)
  }
  peeled = peelFragranceNoteOriginSuffix(peeled)
    .replace(/\s+pure\s+je$/i, "")
    .replace(/\s+siam\s+pure$/i, " siam")
    .replace(/[™®©]/g, "")
    .trim()
  peeled = stripTrailingNotePunctuation(peeled)
  const lc = peeled.toLowerCase()
  if (LAYER_LABEL_TOKENS.has(lc)) return null
  if (STANDALONE_COLOR_NOTE_RE.test(lc)) return null
  if (STANDALONE_ACCORD_DESCRIPTOR_RE.test(lc)) return null
  if (isObviousNonMaterialNote(peeled) || looksLikeProseNotePhrase(peeled)) return null

  const canonical = canonicalizeNote(peeled)
  return canonical || null
}

/** Alcohol-ingredient / organic-farming / trademark boilerplate — not fragrance materials. */
export const isComplianceOrSourcingNote = (note: string): boolean => {
  const n = note.trim().toLowerCase()
  if (!n) return true
  if (
    /^(?:using\s+uncut|organic|reproduction|designers?\s*name|grown\s+organically|non-gmo|non\s+gmo|sourced\s+sustainably|ethically|no\s+pesticides|pesticides|fertilizers|environmentally\s+friendly|sugarcane|ethyl\s+alcohol|carcinogen|phthalate|phthalate-free|gmo|uncut|sustainably\s+sourced)$/i.test(
      n,
    )
  ) {
    return true
  }
  if (
    /\b(?:non-gmo|non\s+gmo|pesticides|fertilizers|phthalate|carcinogen|sugarcane\s+alcohol|grown\s+organically|sourced\s+sustainably|using\s+uncut|designers?\s*name|chemical\s+analysis|reproduction|environmentally\s+friendly|ethically\s+sourced|poured\s+by\s+hand|purpose\s+of\s+this\s+description|original\s+manufactures?\s+picture|nasty\s+chemicals|long-lasting\s+fragrance|could\s+take\s+longer|monday\s*[-–]?\s*friday|inspected\s+before\s+shipping|optional\s+third-party\s+insurance|becoming\s+part\s+of\s+andromeda|thank\s+you\s+for\s+giving\s+us)\b/i.test(
      n,
    )
  ) {
    return true
  }
  if (/^(?:these\s+fragrances\s+are\s+all\s+poured\s+by\s+hand|the\s+purpose\s+of\s+this\s+description)\b/i.test(n)) {
    return true
  }
  if (/^(?:sweet|main|featured|key)\s+notes?\s*$/i.test(n)) return true
  // INCI / EU allergen list carriers (Damask Haus Ingredients: block) — not pyramid notes
  if (/\bingredients?\s*:/i.test(n)) return true
  if (/^(?:alcohol(?:\s*\(?\s*denat\.?\s*\)?)?|ethyl\s+alcohol|denat\.?)$/i.test(n)) return true
  if (/^(?:water(?:\s*\(?\s*aqua\s*\)?)?|aqua)$/i.test(n)) return true
  if (/^(?:fragrance(?:\s*\(?\s*parfum\s*\)?)?|\(?\s*parfum\s*\)?|parfum)$/i.test(n)) return true
  return false
}

/** Shopify theme CSS custom properties and DOM class tokens — not fragrance materials. */
export const isThemeCssTokenNote = (note: string): boolean => {
  const n = note.trim().toLowerCase()
  if (!n) return true
  if (DOM_ARTIFACT_EXACT_TOKENS.has(n)) return true
  if (KEBAB_DOM_ARTIFACT_RE.test(n)) {
    const segments = n.split("-").filter(Boolean)
    if (segments.length >= 2 && segments.every(s => KEBAB_UI_VOCAB_SEGMENTS.has(s))) return true
  }
  if (n === "--" || n.startsWith("--")) return true
  if (/^--[\w-]+-$/.test(n)) return true
  if (
    /^(?:footer|navigation|header|button|sidebar|secondary-elements|newsletter-popup|product-badge|overlay|popup|cookie|gdpr|chatbot|breadcrumb|pagination|announcement|wishlist|compare|share|modal|template|stylesheet)$/i.test(
      n,
    )
  ) {
    return true
  }
  if (/^--(?:light|button|header|newsletter-popup|product-badge)-$/i.test(n)) return true
  return false
}

/** CSS / HTML / truncated prose tokens that must never become pyramid notes. */
export const isObviousNonMaterialNote = (note: string): boolean => {
  const n = note
    .trim()
    .toLowerCase()
    .replace(/[.,;:!?"'`]+$/g, "")
  if (!n) return true
  if (/^https?:\/\//i.test(n) || /https?:\/\//i.test(n)) return true
  if (isThemeCssTokenNote(n)) return true
  if (isComplianceOrSourcingNote(n)) return true
  if (/^[a-z]{1,2}$/i.test(n)) return true
  if (/^(?:top|heart|base|middle)\b\s+\w+/i.test(n)) return true
  if (/\b(?:top|heart|base|middle)\s*$/i.test(n)) return true
  if (/\b(?:top|heart|base|middle)\b/i.test(n) && n.split(/\s+/).length >= 2) return true
  if (LAYER_LABEL_TOKENS.has(n)) return true
  if (STANDALONE_COLOR_NOTE_RE.test(n)) return true
  if (STANDALONE_ACCORD_DESCRIPTOR_RE.test(n)) return true
  if (/^(?:a|an|the)\s+[a-z]/i.test(n)) return true
  if (/\s+(?:the|from|with|of|into)\s*$/i.test(n)) return true
  if (/^(?:top|heart|base|middle|style|projection|facets|strength|concentration|margi|trail|halo|fabric|nuances|enveloping|sparkle|originally|byredo|commodity|frosted|pastel|lactonic|clean|longer|summer|days|mug|reading|couch|bedtime|layering|addictive|intimate|quietly|drinkable|aura|hug|confidence|bold|feminine|masculine|pure|layered|alive|passion|comfort|clarity|elegance|rebellion|energy|warmth|soul|edge|tradition|indulgent|spark|fusion|composition)$/i.test(n))
    return true
  if (/^(?:top|middle|base)\s+notes?$/i.test(n)) return true
  if (/^(?:top|middle|base)\s+notes?\s+(?:are|is|of)\b/i.test(n)) return true
  if (/\b(?:originally\s+from|frosted-pastel|summer\s+warm\s+days|clean\s+halo|longer\s+on\s+fabric|cloud\s+cream|candy\s+air|powdered\s+vanilla\s+style|the\s+creamy|cacao\s+the|a\s+mug|then\s+deepens|deepens\s+into|fluffy\s+glow)\b/i.test(n))
    return true
  if (/\b(?:wrap\s+(?:yourself|your\s+senses)|float\s+into|if\s+you\s+love|pastel\s+dreams\s+with|creamy\s+softness\s+of|nostalgic\s+desserts)\b/i.test(n))
    return true
  if (/\b(?:bottled\s+by|hand-?blended(?:\s+with\s+care)?|followed\s+by\s+a\s+heart\s+of|brings\s+effortless\s+sensuality|utterly\s+magnetic|(?:j|u)uicy\s+signature\s+scent)\b/i.test(n))
    return true
  if (/^(?:llowed\s+by\s+a\s+heart\s+of|ss\s+brings\s+effortless\s+sensuality|tterly\s+magnetic|uicy\s+signature\s+scent)\b/i.test(n))
    return true
  if (/^(?:intention|care|inspected)$/i.test(n)) return true
  if (/^(?:touch|then|fabric|rgba|margin|h[1-6]|body|html|div|span|sans-serif|serif|monospace|system-ui|-apple-system|blinkmacsystemfont|roboto|inter|helvetica|arial|ui-sans-serif|ui-serif|ui-monospace|segoe ui|noto sans)$/i.test(n))
    return true
  if (/^\/(?:head|body|html|script|style|meta|link|title)$/i.test(n)) return true
  if (/^<\/?(?:head|body|html|script|style|meta|link|title)$/i.test(n)) return true
  if (/^(?:lt|gt|charset|utf-8|description)$/i.test(n)) return true
  if (/\s+description\b/i.test(n) && n.split(/\s+/).length <= 4) return true
  if (/^(?:luxurious|wear\s+it|wear\s+it\s+on)$/i.test(n)) return true
  if (/\bwear\s+it(?:\s+on)?\b/i.test(n)) return true
  if (/^(?:radial-gradient|linear-gradient|repeating-linear-gradient|videos|romance|exotic sophistication)$/i.test(n))
    return true
  if (/\b\d+\s+reviews?\b|\breviews?\s+regular\b|\b(?:regular|sale)\s+price\b/i.test(n)) return true
  if (/^(?:videos related products|ingredients captivate your senses|related products|product reviews)$/i.test(n))
    return true
  if (/\b(?:videos related products|ingredients captivate your senses|captivate your senses)\b/i.test(n)) return true
  if (/\b(?:linear-gradient|radial-gradient|rgba\s*\(|rgb\s*\(|hsl\s*\()\b/i.test(n)) return true
  if (/\b(?:font-family|font-size|font-weight|background-color|webkit-font-smoothing)\b/i.test(n)) return true
  if (/\b(?:max-width|font-size|z-index|display|position|opacity|transform|transition)\b/i.test(n)) {
    return true
  }
  if (/\b(?:f|of)\s+note\b/i.test(n)) return true
  if (/\b(?:warmth|like)\b.*\b(?:f|of)\s+note\b/i.test(n)) return true
  if (/\bscent\s+description\b/i.test(n)) return true
  if (/\btihota\s+on\s+fire\b/i.test(n)) return true
  if (/^tihota$/i.test(n)) return true
  if (/\ba\s+soft\s+golden\s+sweetness\b/i.test(n)) return true
  if (/\b(?:rum|whisky|whiskey)-like\b/i.test(n)) return true
  if (/\b(?:warmth|embrace|finish)\s+f\b/i.test(n)) return true
  if (/\s+\bf\b$/i.test(n)) return true
  if (/-like\b/i.test(n) && /\bwarmth\b/i.test(n)) return true
  if (/\bgourmand-floral\b/i.test(n)) return true
  if (/\bpolished\b/i.test(n) && /\bimpression\b/i.test(n)) return true
  if (/\bor\s+andromedas\b/i.test(n)) return true
  if (/\bandromedas\s+moon\b/i.test(n)) return true
  // Etat Libre FULL DESCRIPTION marketing copy mistaken for notes (Putain des Palaces, etc.)
  if (/^(?:like|comes|comes a hint|fluid|flexible)$/i.test(n)) return true
  if (/^(?:hear her|touch her|smell her|see her)$/i.test(n)) return true
  if (/^(?:one thrilling night|there are forbidden pleasures)$/i.test(n)) return true
  if (/^(?:she|her|he|him|they|them|you|we|it|me|us)$/i.test(n)) return true
  if (/^(?:she replies|he replies|notes swirl|like a faceted|to the imagination|or what)$/i.test(n)) return true
  if (/^(?:dance|swirl|faceted|imagination|replies|powdered|essence|others|white|silk|clutching|mystical|enchanting|thus|asleep|sudden|direct|sky|there|suddenly|issued|seduces|lulls|dominates|delectable|let|where|devour|liberate|revolutionary|philosopher|beauty|snatch|how)$/i.test(n))
    return true
  if (/^absolute$/i.test(n)) return true
  if (
    /^(?:when the hope|becomes reality|at last|everything makes sense|we whisper|penetrating dream|she pirouettes|to the poet rumi|there is a bridge|symbolic bridge|what a pretty word|peculiarly parisian|joins another bank|returns by following its|like something|thanks to you|clear-cut formula|instead of an apple|beyond light|gravity newton|dear god|to drive|to desire|to wreak havoc|or possibly|even violence|ignite the world|marquis de sade|without explaining too much|according to lacan|more vast|more true|more sincere|without apotheosis|all nostrils out|infused with bright bergamot|lifted by aromatic incense|breaks the unexpected accord of coffee|cleansed of dictates|to hold|i wrote in mint|weve given you outrageous|true olfactory coitus|to sécrétions|canon powder accord okay|stock for late-night parties)$/i.test(
      n,
    )
  ) {
    return true
  }
  if (/\b(?:tilda swinton|victor hugo|roland mouret|tom of finland|poet rumi)\b/i.test(n)) return true
  if (/^(?:to|or)\s+[a-z]/i.test(n) && n.split(/\s+/).length <= 4) return true
  return false
}

/** Sentence tails from Pattern/Etsy prose cues — not pyramid materials even when they appear in source text. */
export const looksLikeProseNotePhrase = (note: string): boolean => {
  const n = note
    .trim()
    .toLowerCase()
    .replace(/[.,;:!?"'`]+$/g, "")
  if (!n) return true
  if (isObviousNonMaterialNote(n)) return true
  if (/^https?:\/\//i.test(n) || /https?:\/\//i.test(n)) return true
  // Widian / boutique slogan fragments mistaken for pyramid notes.
  if (
    /\b(?:radiates?|meets?|blends?\s+with|deepen(?:s|ing)?|stays?\s+with|grounded\s+with|fusion|composition|full\s+of|sun-warmed|spark\s+on|silent\s+power|andalusian\s+soul|tradition\s+meets|elegance\s+blends|deepen\s+its\s+soul|stays\s+with\s+you|golden\s+spark|citrus-spice|mineral\s+warmth|juicy\s+composition|golden\s+warmth)\b/.test(
      n,
    )
  ) {
    return true
  }
  if (/^where\b/.test(n)) return true
  // Remaining em-dash slogans after peel (both sides marketing).
  if (/[—–]/.test(n)) return true
  if (/^(?:this|that)\s+\w+/.test(n)) return true
  if (/^(?:two\s+fragrances|one\s+being|and\s+that'?s|why\s+there|issue)$/i.test(n)) return true
  if (
    /\b(?:adds?\s+a|\badds\b|give\s+the\s+scent|giraffe-inspired|animalic-foral|perfume\s+with\s+notes|with\s+notes\s+of\s+bergamot|subtle\s+grass\s+note|office\s+wear|polished\s+office|originally\s+from|frosted-pastel|summer\s+warm\s+days|clean\s+halo|longer\s+on\s+fabric|cloud\s+cream|candy\s+air|a\s+mug|the\s+creamy|cacao\s+the|powdered\s+vanilla\s+style|then\s+deepens|deepens\s+into|fluffy\s+glow|as\s+the\s+night\s+deepens|starry\s+date\s+evenings|celestial\s+hug|wear\s+guide|flirtatious|glamorous|surrounds\s+you\s+in|european\s+elegance|touch\s+of\s+european|wrap\s+(?:yourself|your\s+senses)|float\s+into|if\s+you\s+love|pastel\s+dreams\s+with|creamy\s+softness\s+of|nostalgic\s+desserts|bottled\s+by|hand-?blended(?:\s+with\s+care)?|followed\s+by\s+a\s+heart\s+of|brings\s+effortless\s+sensuality|utterly\s+magnetic|(?:j|u)uicy\s+signature\s+scent|drenched\s+in|creating\s+an?\s+(?:unforgettable|experience)|rather\s+than|flanker\s+to|infused\s+cocktails?|elegant\s+rather|becomes\s+your\s+skins?|skins?\s+signature|softened\s+with|fairy-kissed|sun-kissed|star-kissed|\w+-kissed)\b/.test(
      n,
    )
  ) {
    return true
  }
  if (/^(?:drenched\s+in|creating\s+an?\s+(?:unforgettable|experience)|rebellious|sensual|seductive|softened\s+with|becomes\s+your)$/i.test(n)) {
    return true
  }
  if (/^(?:notes swirl|like a faceted|to the imagination|or what|she replies|he replies)$/i.test(n)) {
    return true
  }
  if (/\b(?:notes?\s+swirl|like a faceted|to the imagination|when the hope|becomes reality|everything makes sense|we whisper|penetrating dream|she pirouettes|to the poet|there is a bridge|symbolic bridge|what a pretty word|peculiarly parisian|joins another bank|returns by following|like something|thanks to you|clear-cut formula|instead of an apple|beyond light|gravity newton)\b/.test(n))
    return true
  if (/\b(?:tilda swinton|victor hugo|roland mouret|tom of finland)\b/.test(n)) return true
  if (
    /\b(?:dear god|ignite the world|marquis de sade|even violence|or possibly|to wreak havoc|without explaining|according to lacan|without apotheosis|all nostrils|olfactory coitus|accord of coffee|infused with|lifted by|unexpected accord|wrote in mint|given you outrageous|cleansed of dictates)\b/.test(
      n,
    )
  ) {
    return true
  }
  const words = n.split(/\s+/).filter(Boolean)
  if (
    words.length >= 3 &&
    /\b(?:the|and|or|of|to|with|by|in|from|without|according|possibly|even|all|let|where|when|how)\b/.test(n) &&
    /\b(?:ignite|liberate|seduce|devour|snatch|explain|issued|apotheosis|nostril|wreak|infused|lifted|breaks|unexpected|violence|philosopher|revolutionary|desire|drive|god|pirouette|clutching|whisper|hope|reality|bridge|symbolic|imagination|faceted|swirl|makes sense|outrageous|dictates|coitus|sécrétions|parties|mint|radiates?|meets?|blends?|deepen|stays?|grounded|fusion|composition|rebellion|elegance|confidence|warmth|soul)\b/.test(
      n,
    )
  ) {
    return true
  }
  if (/\b(?:projection|facets|trail|style|concentration|strength|nuances|enveloping|sparkle|halos?)\b/.test(n)) {
    return true
  }
  if (/\bcompletes\b/.test(n)) return true
  // Six+ tokens is almost never a single material (marketing sentence fragments).
  if (words.length >= 6) return true
  if (words.length > 4 && /\b(?:adds?|inspired|composed|glow|mimics|follow|completes|radiates?|meets?|blends?|deepen|stays?|grounded|fusion|composition)\b/.test(n)) {
    return true
  }
  return false
}

const corpusIncludesNote = (normalized: string, haystack: string): boolean => {
  if (!normalized || !haystack) return false
  if (haystack.includes(normalized)) return true
  const woodsAlt = normalized.replace(/\bwood\b/g, "woods")
  if (woodsAlt !== normalized && haystack.includes(woodsAlt)) return true
  const woodAlt = normalized.replace(/\bwoods\b/g, "wood")
  if (woodAlt !== normalized && haystack.includes(woodAlt)) return true
  return false
}

/** True when the note (or its core material tokens) appears in the note-region corpus. */
export const isNoteSubstantiatedInSource = (note: string, corpus: string, fullSource?: string): boolean => {
  const normalized = canonicalizeNote(note)
  if (!normalized) return false
  const haystack = corpus || normalizeCorpusText(fullSource ?? "")
  const fullHaystack = fullSource ? normalizeCorpusText(fullSource) : haystack
  if (!haystack && !fullHaystack) return false

  if (corpusIncludesNote(normalized, haystack)) return true

  const words = normalized.split(/\s+/).filter(Boolean)
  if (words.length === 1) {
    const w = words[0]
    if (PROSE_FRAGMENT_TOKENS.has(w)) return false
    const re = new RegExp(`\\b${escapeRegExp(w)}\\b`, "i")
    if (re.test(haystack)) return true
    if (fullHaystack && re.test(fullHaystack)) return true
    return false
  }

  // Multi-word: prefer note-region corpus; fall back to labeled note region in full source
  if (haystack && words.every(w => new RegExp(`\\b${escapeRegExp(w)}\\b`, "i").test(haystack))) {
    const first = words[0]
    const last = words[words.length - 1]
    const spanRe = new RegExp(
      `\\b${escapeRegExp(first)}\\b[\\s\\S]{0,48}\\b${escapeRegExp(last)}\\b`,
      "i",
    )
    if (spanRe.test(haystack)) return true
  }

  if (fullSource && hasLabeledNoteListSignal(fullSource)) {
    const regionNorm = normalizeCorpusText(sourceTextNoteRegion(fullSource))
    if (corpusIncludesNote(normalized, regionNorm)) return true
    if (words.every(w => new RegExp(`\\b${escapeRegExp(w)}\\b`, "i").test(regionNorm))) {
      const spanRe = new RegExp(
        `\\b${escapeRegExp(words[0])}\\b[\\s\\S]{0,48}\\b${escapeRegExp(words[words.length - 1])}\\b`,
        "i",
      )
      if (spanRe.test(regionNorm)) return true
    }
  }

  /** Indie PDPs: prose says "amaretto" while the note list uses "Amaretto Liqueur Accord". */
  if (/\baccord\b/i.test(normalized) && words.length >= 2) {
    const head = words[0]
    if (head && head.length >= 4 && !/^(?:and|the|a|an)$/i.test(head)) {
      const headRe = new RegExp(`\\b${escapeRegExp(head)}\\b`, "i")
      if (headRe.test(haystack) || headRe.test(fullHaystack)) return true
    }
  }

  return false
}

/** Layer-scoped substantiation — no fallback to full PDP text (avoids cross-layer false positives). */
const isNoteSubstantiatedInLayerCorpus = (note: string, corpus: string): boolean => {
  const normalized = canonicalizeNote(note)
  if (!normalized || !corpus) return false
  const haystack = normalizeCorpusText(corpus)
  if (!haystack) return false

  if (corpusIncludesNote(normalized, haystack)) return true

  const words = normalized.split(/\s+/).filter(Boolean)
  if (words.length === 1) {
    const w = words[0]
    if (PROSE_FRAGMENT_TOKENS.has(w)) return false
    return new RegExp(`\\b${escapeRegExp(w)}\\b`, "i").test(haystack)
  }

  if (words.every(w => new RegExp(`\\b${escapeRegExp(w)}\\b`, "i").test(haystack))) {
    const spanRe = new RegExp(
      `\\b${escapeRegExp(words[0])}\\b[\\s\\S]{0,48}\\b${escapeRegExp(words[words.length - 1])}\\b`,
      "i",
    )
    if (spanRe.test(haystack)) return true
  }

  if (/\baccord\b/i.test(normalized) && words.length >= 2) {
    const head = words[0]
    if (head && head.length >= 4 && !/^(?:and|the|a|an)$/i.test(head)) {
      return new RegExp(`\\b${escapeRegExp(head)}\\b`, "i").test(haystack)
    }
  }

  return false
}

export type NoteLayers = {
  openNotes: string[]
  heartNotes: string[]
  baseNotes: string[]
}

const trimDuplicateLayerTail = (chunk: string): string => {
  let s = chunk.trim()
  const notesOfTail = s.match(/\s+\b(?:top|middle|base)\s+notes?\s+(?:of|are|is)\s+/i)
  if (notesOfTail?.index != null && notesOfTail.index >= 3) {
    s = s.slice(0, notesOfTail.index).trim()
  }
  const colonTail = s.match(
    /\s+\b(?:top|open|heart|middle|base)\s+notes?\s*[:\-\u2013\u2014–—]\s*/i,
  )
  if (colonTail?.index != null && colonTail.index >= 3) {
    s = s.slice(0, colonTail.index).trim()
  }
  const sectionTail = s.search(
    /\s+(?:product\s+reviews?(?:\s*&\s*videos?)?|related\s+products|description\b|master\s+perfumer|shopping\s+cart)\b/i,
  )
  if (sectionTail != null && sectionTail >= 3) {
    s = s.slice(0, sectionTail).trim()
  }
  return s
}

const buildLayerScopedCorpora = (
  source: string,
): { open: string; heart: string; base: string } | null => {
  const raw = (source ?? "").replace(/\r/g, "\n")
  if (!raw.trim()) return null
  const collapsed = raw.replace(/\s+/g, " ").trim()
  const layerChunks: { open: string[]; heart: string[]; base: string[] } = {
    open: [],
    heart: [],
    base: [],
  }

  const colonRe =
    /\b(top|open|opening|head|heart|middle|mid|core|body|center|centre|base|bottom|background|foundation|dry\s*down|drydown|end)\s*(?:notes?)?\s*[:\-\u2013\u2014–—]\s*([\s\S]*?)(?=\s+\b(?:top|open|opening|head|heart|middle|mid|core|body|center|centre|base|bottom|background|foundation|dry\s*down|drydown|end)\s*(?:notes?)?\s*[:\-\u2013\u2014–—]|\s+\b(?:available\s+sizes?|when\s+to\s+wear|main\s+accords?|how\s+it\s+wears|processing|important|disclaimer|shipping)\b|$)/gi
  let cm: RegExpExecArray | null
  while ((cm = colonRe.exec(collapsed)) !== null) {
    const label = (cm[1] ?? "").toLowerCase()
    const chunk = trimDuplicateLayerTail(cm[2] ?? "")
    if (!chunk) continue
    const key =
      /^(?:heart|middle|mid|core|body|center|centre)$/.test(label)
        ? "heart"
        : /^(?:base|bottom|background|foundation|dry\s*down|drydown|end)$/.test(label)
          ? "base"
          : "open"
    layerChunks[key].push(chunk)
  }

  const notesOfRe = /\b(top|middle|base)\s+notes?\s+(?:of|are|is)\s+/gi
  const notesOfMatches = [...collapsed.matchAll(notesOfRe)]
  for (let i = 0; i < notesOfMatches.length; i += 1) {
    const m = notesOfMatches[i]
    const label = (m[1] ?? "").toLowerCase()
    const start = (m.index ?? 0) + m[0].length
    const end = i + 1 < notesOfMatches.length ? notesOfMatches[i + 1].index! : collapsed.length
    const chunk = trimDuplicateLayerTail(collapsed.slice(start, end))
    if (!chunk) continue
    const key = label === "middle" ? "heart" : label === "base" ? "base" : "open"
    layerChunks[key].push(chunk)
  }

  if (
    layerChunks.open.length === 0 &&
    layerChunks.heart.length === 0 &&
    layerChunks.base.length === 0
  ) {
    return null
  }

  return {
    open: normalizeCorpusText(layerChunks.open.join(" ")),
    heart: normalizeCorpusText(layerChunks.heart.join(" ")),
    base: normalizeCorpusText(layerChunks.base.join(" ")),
  }
}

const layerCorpusMatches = (
  note: string,
  layer: "open" | "heart" | "base",
  layerCorpora: { open: string; heart: string; base: string },
): boolean => {
  const corpus = layerCorpora[layer]
  return Boolean(corpus && isNoteSubstantiatedInLayerCorpus(note, corpus))
}

/** When a labeled pyramid exists, assign each note to the layer whose corpus substantiates it. */
const relayerNotesByLayerCorpora = (
  layers: NoteLayers,
  source: string,
  layerCorpora: { open: string; heart: string; base: string },
  merchantTrusted?: Set<string>,
): NoteLayers => {
  const open: string[] = []
  const heart: string[] = []
  const base: string[] = []
  const seen = new Set<string>()

  const pushUnique = (layer: "open" | "heart" | "base", note: string) => {
    const lc = note.trim().toLowerCase()
    if (!lc || seen.has(lc)) return
    seen.add(lc)
    if (layer === "open") open.push(note)
    else if (layer === "heart") heart.push(note)
    else base.push(note)
  }

  const assignNote = (raw: string, originLayer: "open" | "heart" | "base") => {
    const note = sanitizeExtractedNoteCandidate(raw)
    if (!note) return

    const inOpen = layerCorpusMatches(note, "open", layerCorpora)
    const inHeart = layerCorpusMatches(note, "heart", layerCorpora)
    const inBase = layerCorpusMatches(note, "base", layerCorpora)
    const matchCount = [inOpen, inHeart, inBase].filter(Boolean).length

    if (matchCount === 0) {
      const lc = note.trim().toLowerCase()
      const trusted = Boolean(lc && merchantTrusted?.has(lc))
      const originCorpus = layerCorpora[originLayer]
      // Prefer origin-layer corpus, then full merchant source, then merchant-trusted keep.
      if (originCorpus && isNoteSubstantiatedInSource(note, originCorpus, source)) {
        pushUnique(originLayer, note)
      } else if (isNoteSubstantiatedInSource(note, "", source) || trusted) {
        pushUnique(originLayer, note)
      }
      return
    }

    if (matchCount === 1) {
      if (inOpen) pushUnique("open", note)
      else if (inHeart) pushUnique("heart", note)
      else pushUnique("base", note)
      return
    }

    // Ambiguous (e.g. vanilla in heart + base prose): prefer original parser layer when valid.
    if (originLayer === "open" && inOpen) pushUnique("open", note)
    else if (originLayer === "heart" && inHeart) pushUnique("heart", note)
    else if (originLayer === "base" && inBase) pushUnique("base", note)
    else if (inHeart && !inOpen) pushUnique("heart", note)
    else if (inBase && !inOpen && !inHeart) pushUnique("base", note)
    else if (inOpen) pushUnique("open", note)
    else if (inHeart) pushUnique("heart", note)
    else if (inBase) pushUnique("base", note)
  }

  for (const n of layers.openNotes) assignNote(n, "open")
  for (const n of layers.heartNotes) assignNote(n, "heart")
  for (const n of layers.baseNotes) assignNote(n, "base")

  return { openNotes: open, heartNotes: heart, baseNotes: base }
}

/** Merchant PDP already labels Head / Heart / Base — keep parser layer assignment. */
const hasExplicitHeadHeartBasePyramid = (source: string): boolean => {
  const hasOpen = /\b(?:head|top|opening)\s+notes?\s*:/i.test(source)
  const hasHeart = /\b(?:heart|middle|mid|core)\s+notes?\s*:/i.test(source)
  const hasBase = /\bbase\s+notes?\s*:/i.test(source)
  if (hasOpen && hasHeart && hasBase) return true
  return /^top\s*:/im.test(source) && /^heart\s*:/im.test(source) && /^base\s*:/im.test(source)
}

const sanitizeExplicitPyramidLayer = (arr: string[]): string[] =>
  arr
    .map(n => sanitizeExtractedNoteCandidate(n))
    .filter((n): n is string => Boolean(n))

/** Drop notes that cannot be confirmed in the merchant source text. */
export const confirmNoteLayersAgainstSource = (
  layers: NoteLayers,
  source: string,
  options?: { minKept?: number; merchantTrusted?: Set<string>; preserveLayerAssignment?: boolean },
): NoteLayers => {
  const corpus = buildNoteConfirmationCorpus(source)
  const layerCorpora = buildLayerScopedCorpora(source)
  const substantiate = (n: string) =>
    isNoteSubstantiatedInSource(n, corpus, source)
  const trusted = options?.merchantTrusted
  const hasLayerScopedCorpus =
    Boolean(layerCorpora?.open) || Boolean(layerCorpora?.heart) || Boolean(layerCorpora?.base)

  const layersPopulated =
    layers.openNotes.length > 0 && layers.heartNotes.length > 0 && layers.baseNotes.length > 0

  if (
    hasExplicitHeadHeartBasePyramid(source) &&
    (options?.preserveLayerAssignment === true || layersPopulated)
  ) {
    return {
      openNotes: sanitizeExplicitPyramidLayer(layers.openNotes),
      heartNotes: sanitizeExplicitPyramidLayer(layers.heartNotes),
      baseNotes: sanitizeExplicitPyramidLayer(layers.baseNotes),
    }
  }

  if (hasLayerScopedCorpus && layerCorpora && !/\bMAIN NOTES\b/i.test(source)) {
    return relayerNotesByLayerCorpora(layers, source, layerCorpora, trusted)
  }

  const filterLayer = (arr: string[]) =>
    arr
      .map(n => sanitizeExtractedNoteCandidate(n))
      .filter((n): n is string => Boolean(n))
      .filter(n => {
        const lc = n.trim().toLowerCase()
        if (trusted?.has(lc)) return true
        const words = n.trim().split(/\s+/).filter(Boolean).length
        if (words <= 4 && !/\baccord\b/i.test(n)) return true
        return substantiate(n)
      })

  const openNotes = filterLayer(layers.openNotes)
  const heartNotes = filterLayer(layers.heartNotes)
  const baseNotes = filterLayer(layers.baseNotes)

  return { openNotes, heartNotes, baseNotes }
}
