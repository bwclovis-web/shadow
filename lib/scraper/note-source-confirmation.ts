/**
 * Confirm extracted notes against merchant source text (description / notesText).
 * Supports labeled pyramids, flat lists, and unlabeled "Fragrance Notes" material blocks.
 */

import { canonicalizeNote } from "@/lib/scraper/canonical-notes"

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

const splitFragranceNotesBlockLines = (block: string): string[] => {
  const trimmed = block.trim()
  if (!trimmed) return []
  if (/\n/.test(trimmed)) {
    return trimmed
      .split(/\n+/)
      .map(l => l.trim())
      .filter(Boolean)
  }
  const parts = trimmed
    .split(GLUED_MATERIAL_LINE_SPLIT_RE)
    .map(p => p.trim())
    .filter(p => p && isMaterialLineChunk(p))
  return parts.length > 0 ? parts : isMaterialLineChunk(trimmed) ? [trimmed] : []
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
  const trimmed = line.trim()
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

  return normalizeCorpusText(parts.join(" "))
}

const sourceTextNoteRegion = (fullSource: string): string => {
  const end = NOTE_REGION_END_RE.exec(fullSource)?.index
  return end != null && end >= 0 ? fullSource.slice(0, end) : fullSource
}

const hasLabeledNoteListSignal = (text: string): boolean =>
  /\b(?:featured|key|main|primary|signature|dominant)\s+notes?\s*:/i.test(text) ||
  /\b(?:top|heart|middle|mid|base|opening|dry[\s-]*down)\s*(?:notes?)?\s*:/i.test(text) ||
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
])

/** CSS / HTML / truncated prose tokens that must never become pyramid notes. */
export const isObviousNonMaterialNote = (note: string): boolean => {
  const n = note.trim().toLowerCase()
  if (!n) return true
  if (/^(?:touch|then|fabric|rgba|margin|h[1-6])$/i.test(n)) return true
  if (/\b(?:linear-gradient|rgba\s*\(|rgb\s*\(|hsl\s*\()\b/i.test(n)) return true
  if (/\b(?:max-width|font-size|z-index|display|position|opacity|transform|transition)\b/i.test(n)) {
    return true
  }
  if (/\b(?:f|of)\s+note\b/i.test(n)) return true
  if (/\b(?:warmth|like)\b.*\b(?:f|of)\s+note\b/i.test(n)) return true
  if (/\bscent\s+description\b/i.test(n)) return true
  if (/\btihota\s+on\s+fire\b/i.test(n)) return true
  if (/\ba\s+soft\s+golden\s+sweetness\b/i.test(n)) return true
  return false
}

/** Sentence tails from Pattern/Etsy prose cues — not pyramid materials even when they appear in source text. */
export const looksLikeProseNotePhrase = (note: string): boolean => {
  const n = note.trim().toLowerCase()
  if (!n) return true
  if (isObviousNonMaterialNote(n)) return true
  if (
    /\b(?:adds?\s+a|\badds\b|give\s+the\s+scent|giraffe-inspired|animalic-foral|perfume\s+with\s+notes|with\s+notes\s+of\s+bergamot|subtle\s+grass\s+note|office\s+wear|polished\s+office)\b/.test(
      n,
    )
  ) {
    return true
  }
  const words = n.split(/\s+/).filter(Boolean)
  if (words.length > 6) return true
  if (words.length > 4 && /\b(?:adds?|inspired|composed|glow|mimics|follow|completes)\b/.test(n)) {
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

  return false
}

export type NoteLayers = {
  openNotes: string[]
  heartNotes: string[]
  baseNotes: string[]
}

/** Drop notes that cannot be confirmed in the merchant source text. */
export const confirmNoteLayersAgainstSource = (
  layers: NoteLayers,
  source: string,
  options?: { minKept?: number; merchantTrusted?: Set<string> },
): NoteLayers => {
  const corpus = buildNoteConfirmationCorpus(source)
  const substantiate = (n: string) =>
    isNoteSubstantiatedInSource(n, corpus, source)
  const trusted = options?.merchantTrusted

  const filterLayer = (arr: string[]) =>
    arr.filter(n => {
      if (looksLikeProseNotePhrase(n) || isObviousNonMaterialNote(n)) return false
      const lc = n.trim().toLowerCase()
      if (trusted?.has(lc)) return substantiate(n)
      const words = n.trim().split(/\s+/).filter(Boolean).length
      if (words <= 4 && !/\baccord\b/i.test(n)) return true
      return substantiate(n)
    })

  const openNotes = filterLayer(layers.openNotes)
  const heartNotes = filterLayer(layers.heartNotes)
  const baseNotes = filterLayer(layers.baseNotes)

  return { openNotes, heartNotes, baseNotes }
}
