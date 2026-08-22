import type { ScrapedItem } from "@/types/scraper"
import {
  extractUnlabeledFragranceNotesBlock,
  sanitizeExtractedNoteCandidate,
} from "@/lib/scraper/note-source-confirmation"
import {
  explodeSpaceSeparatedNoteBlob,
  splitGluedMerchantNoteRun,
} from "@/lib/scraper/canonical-notes"
import {
  extractFullDescriptionFromHtml,
  isEtatLibreProductUrl,
  isThinLayeredPyramidScrape,
  normalizePdpDescription,
  splitNoteList,
  truncateAtShopMetaLabels,
  uniqueNotes,
} from "@/lib/scraper/stages/title-cleaning"

// ---------------------------------------------------------------------------
// Name from URL (when scraper returns hostname or empty)
// ---------------------------------------------------------------------------

/** True if the scraped "name" is empty or looks like a hostname (e.g. Www.lush.com). */
function isLikelyHostnameOrEmpty(name: string): boolean {
  const t = name?.trim() ?? ""
  if (!t) return true
  // e.g. "Www.lush.com", "lush.com", "www.example.co.uk"
  if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\s|$)/i.test(t)) return true
  if (/^www\./i.test(t) && /\.(com|co\.uk|org|net|io)(\s|$)/i.test(t)) return true
  return false
}

/** Judge.me / Shopify reviews widgets sometimes win the first `h1` and dump the whole widget as the title. */
export const isLikelyReviewWidgetTitle = (name: string): boolean => {
  const t = (name ?? "").replace(/\s+/g, " ").trim().toLowerCase()
  if (!t) return false
  if (/\bcustomer reviews?\b/.test(t)) return true
  if (/\bwrite a review\b/.test(t)) return true
  if (/\bbased on (?:\d+\s+)?reviews?\b/.test(t)) return true
  if (/\breview\b/.test(t) && (/%/.test(t) || t.length > 80)) return true
  return false
}

/** Etsy / Pattern listing slugs often trail SEO phrases after `-a-`, `-an-`, `-for-`, etc. */
const ETSY_SLUG_TAIL_STARTERS = new Set([
  "a",
  "an",
  "the",
  "and",
  "for",
  "with",
  "or",
  "in",
  "on",
  "to",
  "of",
  "at",
  "by",
  "is",
  "it",
  "as",
])

const trimEtsyListingSlug = (slug: string): string => {
  const parts = slug.toLowerCase().split("-").filter(Boolean)
  if (parts.length < 4) return slug
  for (let i = 2; i < parts.length; i += 1) {
    if (!ETSY_SLUG_TAIL_STARTERS.has(parts[i])) continue
    const before = parts.slice(0, i)
    const alphaWords = before.filter(p => p.length > 1 && !/^\d+$/.test(p))
    if (alphaWords.length >= 2) return before.join("-")
  }
  return slug
}

const formatListingSlugAsTitle = (slug: string): string => {
  const withSpaces = slug.replace(/-/g, " ")
  return withSpaces
    .replace(/\bno\s*(\d+[a-z]?)\b/gi, (_, n: string) => `No. ${n.toUpperCase()}`)
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Derive a product name from a product detail URL when the scraper returns a hostname or empty.
 * e.g. .../p/lord-of-misrule-perfume -> "Lord of Misrule Perfume"
 */
function nameFromProductUrl(detailURL: string): string | null {
  if (!detailURL?.trim()) return null
  try {
    const pathname = new URL(detailURL).pathname
    const segments = pathname.split("/").filter(Boolean)
    const rawSlug = segments[segments.length - 1]
    if (!rawSlug || rawSlug.length > 120) return null
    const slug =
      /listing/i.test(pathname) || /patternbyetsy|etsy\.com/i.test(detailURL)
        ? trimEtsyListingSlug(rawSlug)
        : rawSlug
    return formatListingSlugAsTitle(slug) || null
  } catch {
    return null
  }
}

const normalizeNameKey = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "")

/** True when text has combining marks or precomposed accented Latin letters. */
const hasDiacriticLetters = (text: string): boolean => {
  if (/[\u0300-\u036f]/.test(text.normalize("NFD"))) return true
  // Precomposed Latin-1 Supplement / Latin Extended-A accented letters
  return /[À-ÖØ-öø-ÿĀ-ž]/.test(text)
}

/** Prefer merchant title when it carries accents the URL slug cannot. */
const shouldPreferAccentedMerchantTitle = (raw: string, fromUrl: string): boolean =>
  hasDiacriticLetters(raw) && !hasDiacriticLetters(fromUrl)

/** Scraped Etsy titles often truncate before digits ("Burner Perfume No" vs slug `burner-perfume-no9b-…`). */
const isLikelyTruncatedProductName = (name: string, detailURL: string): boolean => {
  const t = name.trim()
  if (!t || !detailURL?.trim()) return false
  if (/\bno\.?\s*$/i.test(t)) return true
  if (/\bvol\.?\s*$/i.test(t)) return true
  const fromUrl = nameFromProductUrl(detailURL)
  if (!fromUrl) return false
  if (shouldPreferAccentedMerchantTitle(t, fromUrl)) return false
  const nameKey = normalizeNameKey(t)
  const urlKey = normalizeNameKey(fromUrl)
  if (!nameKey || !urlKey || urlKey.length <= nameKey.length + 3) return false
  return urlKey.startsWith(nameKey) || nameKey.startsWith(urlKey.slice(0, Math.max(8, nameKey.length)))
}

/** Resolve display name: use URL-derived name when scraped name is hostname/empty. */
function resolveProductName(item: ScrapedItem): string {
  const raw = item.name?.trim() ?? ""
  const fromUrl = nameFromProductUrl(item.detailURL ?? "")
  if (isLikelyHostnameOrEmpty(raw) || isLikelyReviewWidgetTitle(raw)) return fromUrl ?? raw
  if (
    fromUrl &&
    isLikelyTruncatedProductName(raw, item.detailURL ?? "") &&
    !shouldPreferAccentedMerchantTitle(raw, fromUrl)
  ) {
    return fromUrl
  }
  return raw
}

/**
 * Use both optional notes-region scrape and main description for parsing. Some runs put the labeled
 * "Scent notes include …" line in one field and noir/short copy in the other; `notesText ?? description`
 * alone drops the authoritative list and the LLM invents a pyramid from prose.
 */
const resolveNotesSource = (item: ScrapedItem): string => {
  /** Listing titles often carry "with notes of …" / "Note Structure" when body copy is noir-only. */
  const nameForNotes =
    typeof item.name === "string" &&
    /\b(?:with\s+)?notes?\s+of\b/i.test(item.name) &&
    /,/.test(item.name)
      ? item.name.trim()
      : ""
  const parts = [item.notesText, nameForNotes, item.description]
    .map(s => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
  if (parts.length === 0) return ""
  return [...new Set(parts)].join("\n\n")
}

/** True when the page text includes a merchant-style note list or pyramid — not metaphor-only prose. */
const hasExplicitNoteListSignal = (text: string): boolean => {
  const t = text
  if (/\b(?:featured|key|main|primary|signature|dominant)\s+notes?\s*:/i.test(t)) return true
  if (/\b(?:top|heart|base)\s*[—–—-]\s*[A-Za-z]/i.test(t)) return true
  if (/\b(?:fragrance\s+profile\s+)?main\s+notes?\s+(?![:\-\u2013\u2014–—])[A-Za-z]/i.test(t)) return true
  if (/\bscent\s+profile\s+(?!(?:top|heart|base|middle)\s*:)[A-Za-z]/i.test(t)) return true
  if (/\b(?:top|middle|base)\s+notes?\s+(?:of|are|is)\s+[a-z]/i.test(t)) return true
  if (/\bnotes?\s+(?!(?:top|heart|base|middle)\s*:|[:\-\u2013\u2014–—])[A-Z]/i.test(t) && /\bwear\s*(?:&|and)\s*layer\b/i.test(t))
    return true
  if (/\bscent\s+notes?\s+include\b/i.test(t)) return true
  if (/\bscent\s+notes?\s+(?:top|heart|base)\s*:/i.test(t)) return true
  if (/\bnote\s+breakdown\b/i.test(t)) return true
  if (/\bfragrance\s+notes?\s+are\b/i.test(t)) return true
  if (/\bnote\s+structure\b/i.test(t)) return true
  if (/\*{0,2}(?:top|heart|middle|mid|base|opening|dry[\s-]*down)\*{0,2}\s*(?:notes?)?\s*:/i.test(t))
    return true
  if (/\bfragrance\s+notes?\b(?!\s*(?:include|are|is|:))/i.test(t)) return true
  if (/(?<!(?:please|processing)\s)\bnotes?\s*:\s*[a-z0-9]/i.test(t)) return true
  // AOE / Wix: "NOTES - BLACKBERRY, HONEY MEAD, …"
  if (/(?<!(?:please|processing)\s)\bnotes?\s*[-–—]\s*[A-Za-z0-9]/i.test(t)) return true
  if (/\b(?:kopfnoten?|herznoten?|basisnoten?|duftnoten)\s*:/i.test(t)) return true
  if (/\bnote\s+di\s+(?:testa|cuore|fondo|olfattive)\s*:/i.test(t)) return true
  if (/\b(?:topnoten?|hartnoten?|basisnoten?)\s*:/i.test(t)) return true
  if (/\bnotas\s+de\s+(?:salida|coraz[oó]n|fondo)\s*:/i.test(t)) return true
  if (/\bnotes?\s+of\s+[a-z]/i.test(t) && /,/.test(t)) return true
  if (/\bwith\s+notes?\s+of\s+/i.test(t)) return true
  if (/\b(?:sweetly\s+spiced\s+)?blending\s+[a-z][^.!?]{6,}/i.test(t) && /,/.test(t)) return true
  if (/\b(?:the\s+)?base\s+melts?\s+into\b/i.test(t)) return true
  if (/\bnotes?\b\s+top\b\s+.+?\s+heart\b\s+.+?\s+base\b/i.test(t)) return true
  if (/\bnotes?\s+pyramid\b/i.test(t)) return true
  if (/\bscent\s+profile\s+[A-Za-z0-9]/i.test(t) && /[•·]/.test(t)) return true
  if (/\b(?:main\s+ingredient|creative\s+approach|initial\s+idea)\s*:/i.test(t)) return true
  return false
}

export const isPatternByEtsyProductUrl = (detailURL: string): boolean =>
  /patternbyetsy|etsy\.com\/listing/i.test(detailURL ?? "")

export const isAndromedaMoonProductUrl = (detailURL: string): boolean =>
  /andromedasmoon\.com/i.test(detailURL ?? "")

/** Shopify paths that are not individual fragrance PDPs (sampler sets, gift cards, merch, leftovers). */
const NON_PERFUME_ANDROMEDA_PRODUCT_URL_RE =
  /\/products\/(?:fragrance-sampler|sample-pack|coupon|wish-list|file-claim|join-our-newsletter)|\/products\/[^/]*(?:gift-?card|wax-warmers?|wax-melts?|oopsie)/i

const URL_MATCH_NAME_STOPWORDS = new Set([
  "eau",
  "de",
  "parfum",
  "edp",
  "extrait",
  "the",
  "and",
  "or",
  "for",
  "with",
  "inspired",
  "by",
  "moon",
  "andromeda",
  "andromedas",
])

const significantNameTokensForUrlMatch = (name: string): string[] => {
  const words = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
  return words.filter(w => {
    if (/^\d{2,}$/.test(w)) return true
    return w.length >= 4 && !URL_MATCH_NAME_STOPWORDS.has(w)
  })
}

/** True when the scraped PDP URL plausibly belongs to this product name. */
export const detailUrlAlignsWithProductName = (name: string, detailURL: string): boolean => {
  if (!name?.trim() || !detailURL?.trim()) return true
  if (NON_PERFUME_ANDROMEDA_PRODUCT_URL_RE.test(detailURL)) return false
  try {
    const tokens = significantNameTokensForUrlMatch(name)
    if (tokens.length === 0) return true
    const slug = new URL(detailURL).pathname.toLowerCase().replace(/-/g, " ")
    return tokens.some(t => slug.includes(t))
  } catch {
    return true
  }
}

const buildAndromedaCandidateProductUrls = (name: string): string[] => {
  const words = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => (w.length >= 2 || /^\d+$/.test(w)) && !URL_MATCH_NAME_STOPWORDS.has(w))
  if (words.length === 0) return []

  const slugs = new Set<string>()
  for (let n = Math.min(2, words.length); n <= Math.min(4, words.length); n += 1) {
    slugs.add(words.slice(0, n).join("-"))
  }
  slugs.add(words.join("-"))

  const prefixes = ["inspired-by-", "andromeda-s-inspired-by-", "andromedas-inspired-by-"]
  const coreSlugs = [...slugs].sort((a, b) => b.length - a.length).slice(0, 2)
  const suffixes = ["-eau-de-parfum", ""]
  const lastWord = words.filter(w => w.length >= 4).at(-1)
  if (lastWord) suffixes.push(`-eau-de-parfum-${lastWord}`)

  const urls: string[] = []
  for (const slug of coreSlugs) {
    if (slug.length < 6) continue
    for (const prefix of prefixes) {
      for (const suffix of suffixes) {
        urls.push(`https://www.andromedasmoon.com/products/${prefix}${slug}${suffix}`)
      }
    }
  }
  return [...new Set(urls)].slice(0, 16)
}

/** Shopify storefront search when slug guessing fails (e.g. `-gucci` suffix not in product name). */
const searchAndromedaProductUrl = async (
  name: string,
  sig: AbortSignal | undefined,
): Promise<string | null> => {
  const tokens = significantNameTokensForUrlMatch(name)
  if (tokens.length === 0) return null
  const query = tokens.slice(0, 3).join(" ")
  const searchUrl = `https://www.andromedasmoon.com/search?q=${encodeURIComponent(query)}&type=product`
  try {
    const res = await fetch(searchUrl, {
      signal: sig,
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
    })
    if (!res.ok) return null
    const html = await res.text()
    const paths = [
      ...html.matchAll(/\/products\/([a-z0-9-]{8,120})/gi),
    ].map(m => `/products/${m[1]}`)
    const unique = [...new Set(paths)].filter(p => !NON_PERFUME_ANDROMEDA_PRODUCT_URL_RE.test(p))
    let best: { path: string; score: number } | null = null
    for (const path of unique) {
      const slug = path.replace(/^\/products\//, "").replace(/-/g, " ")
      const score = tokens.filter(t => slug.includes(t)).length
      if (score === 0) continue
      if (!best || score > best.score || (score === best.score && path.length < best.path.length)) {
        best = { path, score }
      }
    }
    if (!best) return null
    return `https://www.andromedasmoon.com${best.path}`
  } catch {
    return null
  }
}

/** Pattern-by-Etsy PDPs almost always have Note Structure; fetch when the scrape missed it. */
const shouldAutoFetchPatternEtsyNotes = (detailURL: string, mergedBase: string): boolean =>
  isPatternByEtsyProductUrl(detailURL) && !hasExplicitNoteListSignal(mergedBase)

/**
 * Andromeda's Moon Shopify PDPs use "Notes Pyramid Top … Heart … Base …" (often no colons).
 * Selenium frequently captures Scent Story prose only; HTTP bootstrap recovers the pyramid.
 */
const shouldAutoFetchAndromedaMoonNotes = (detailURL: string, mergedBase: string): boolean =>
  isAndromedaMoonProductUrl(detailURL) && !hasExplicitNoteListSignal(mergedBase)

/** Etat Libre accordion tabs often omit MAIN NOTES from Selenium copy; HTTP bootstrap recovers them. */
const shouldAutoFetchEtatLibreNotes = (detailURL: string, mergedBase: string): boolean =>
  isEtatLibreProductUrl(detailURL) &&
  (!hasExplicitNoteListSignal(mergedBase) || !/\bMAIN NOTES\b/i.test(mergedBase))

/** WooCommerce PDPs — /store/{slug} (Vivamor) or brand-category permalinks like /milano-fragranze/naviglio/. */
const isWooCommerceStoreProductUrl = (detailURL: string): boolean => {
  try {
    const parsed = new URL(detailURL)
    const path = parsed.pathname.replace(/\/+$/, "")
    if (/\/store\/[^/]+$/i.test(path) && !/\/store$/i.test(path)) return true
    const parts = path.split("/").filter(Boolean)
    if (parts.length < 2) return false
    if (parts.length === 2 && /^[a-z]{2}$/i.test(parts[0] ?? "")) return false
    const excluded = new Set([
      "shop",
      "cart",
      "checkout",
      "my-account",
      "wishlist",
      "account",
      "wp-json",
      "feed",
      "product-category",
    ])
    if (parts.some(p => excluded.has(p.toLowerCase()) || p.toLowerCase().startsWith("wp-"))) {
      return false
    }
    return true
  } catch {
    return false
  }
}

const shouldAutoFetchWooCommerceStoreNotes = (detailURL: string, mergedBase: string): boolean => {
  if (!isWooCommerceStoreProductUrl(detailURL)) return false
  if (!hasExplicitNoteListSignal(mergedBase)) return true
  return isThinLayeredPyramidScrape(mergedBase)
}

/** Shopify /products/{handle} PDPs when Selenium captures theme CSS or marketing prose only. */
const isShopifyProductPdpUrl = (detailURL: string): boolean => {
  try {
    const path = new URL(detailURL).pathname.replace(/\/+$/, "")
    return /\/products\/[^/]+$/i.test(path)
  } catch {
    return false
  }
}

const shouldAutoFetchShopifyProductNotes = (detailURL: string, mergedBase: string): boolean => {
  if (!isShopifyProductPdpUrl(detailURL)) return false
  if (isAndromedaMoonProductUrl(detailURL)) return false
  if (isPatternByEtsyProductUrl(detailURL)) return false
  if (isEtatLibreProductUrl(detailURL)) return false
  return !hasExplicitNoteListSignal(mergedBase)
}

/** Collection / shop grid pages mistaken for a product (e.g. Vivamor "Store" row with about-us URL). */

/** One fetch per URL per process — scrapes hit the same PDPs many times in a single run. */
const pdpNoteBootstrapCache = new Map<string, string | null>()

/** Remove HTML tag markup (encoded or literal) pasted into merchant copy — e.g. Andromeda &lt;head&gt; blobs. */
const stripEmbeddedHtmlMarkup = (text: string): string =>
  text
    .replace(/\\u003c/gi, "<")
    .replace(/\\u003e/gi, ">")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/<\/?(?:head|body|html|script|style|meta|link|title)\b[^>]*>/gi, " ")
    .replace(/\s+\/?(?:head|body|html|script|style|meta|charset|utf-8)\b/gi, " ")

const stripHtmlToPlainText = (html: string): string =>
  stripEmbeddedHtmlMarkup(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()

/** Shopify PDPs use "Concentration :" / "Volume :" (space before colon). Match those headers, not bare \bVolume\b (avoids false stops inside note lists). */
const FEATURED_LIST_SECTION_STOP = String.raw`(?=\s+Concentration\s*:|\s+Volume\s*:|\s+Size\s*:|\s+Shipping\s*:|\s+Ingredients\s*:|\s+Add to cart\b|\s+Buy it now\b|\s+You may also\b|Related products\b|Customer reviews\b|\s+📷|Tag us on|$)`

/** Pattern-by-Etsy / Aether Arts PDP meta after the note pyramid (Series, Reviews, etc.). */
const PATTERN_ETSY_NOTE_BLOCK_STOP = String.raw`(?=\s+Series\s*:|\s+Perfume\s+Family\s*:|\s+Unisex\s*:|\s+Contains\s+True\s+Animalics\s*:|\s+Reviews\s*:|\s+Returns\b|\s+Extra\s+Info\b|$)`

/**
 * Aether Arts / Pattern-by-Etsy pages pair accord pyramids ("Note Structure: Top Notes: Tawny Coat Accord")
 * with explicit materials in prose ("Notes of Bergamot, Orange, Turmeric, and Saffron") and in the
 * listing title ("with notes of Bergamot, Orange, …"). Pull those into labeled lines the structured
 * parser already understands.
 */
/** "A touch of Liatrix adds a subtle grass note" → Liatrix; "with a bit of Amber" → Amber. */
const extractProseMaterialCue = (capture: string): string => {
  const t = capture.trim()
  if (!t) return t
  const head = t.match(
    /^([A-Za-z][\p{L}'-]{1,24}(?:\s+[A-Za-z][\p{L}'-]{1,24}){0,2})(?:\s+(?:adds?|with|and|or|that|which|a|an|the|give)\b|\s*[,;])/iu,
  )
  const raw = head?.[1] ? head[1].trim() : (t.split(/\s+(?:adds?|with|that|which|give)\b/i)[0] ?? t).trim()
  return raw.replace(/\s+adds?\b.*$/i, "").trim()
}

const extractPatternEtsyNoteSegmentsFromPlain = (plain: string): string[] => {
  const collapsed = (plain ?? "").replace(/\r/g, "\n").replace(/\s+/g, " ").trim()
  if (!collapsed) return []

  const segments: string[] = []
  const hasMainNotesBlock = /\b(?:fragrance\s+profile\s+)?main\s+notes?\s+(?![:\-\u2013\u2014–—])[A-Za-z]/i.test(
    collapsed,
  )

  const noteStruct = collapsed.match(
    new RegExp(String.raw`\bnote\s+structure\s*:\s*(.+?)${PATTERN_ETSY_NOTE_BLOCK_STOP}`, "i"),
  )
  if (noteStruct?.[1]) {
    const block = (noteStruct[0] ?? "")
      .replace(/^\s*note\s+structure\s*:\s*/i, "")
      .trim()
    if (block.length >= 12) segments.push(block)
  }

  for (const m of collapsed.matchAll(/\bnotes?\s+of\s+([^.;!?]{8,220})/gi)) {
    let list = (m[1] ?? "").trim()
    list = list.replace(/\s+give\s+the\s+scent\b[\s\S]*$/i, "").trim()
    /** Skip noir prose ("Notes of lush jungle greenery…") — merchant lists start with a material name. */
    if (!/^[A-Z]/.test(list)) continue
    if (/\b(?:perfume|inspired|animalic|giraffe)\b/i.test(list)) continue
    if (list && (/,/.test(list) || /\band\b/i.test(list)) && /[a-z]{3,}/i.test(list)) {
      segments.push(`top notes: ${list}`)
    }
  }

  const follow = collapsed.match(/\b(?:florals?|notes?)\s+follow(?:s|ed)?\s*:\s*([^.;!?]{8,160})/i)
  if (follow?.[1]) segments.push(`heart notes: ${follow[1].trim()}`)

  const bitOfAmber = collapsed.match(/\bwith\s+a\s+bit\s+of\s+([A-Za-z][\w-]+)\b/i)
  if (!hasMainNotesBlock && bitOfAmber?.[1]) segments.push(`base notes: ${bitOfAmber[1].trim()}`)

  const completes = collapsed.match(
    /\b(?:completes?|finishes?|closes?)\s+(?:the\s+composition\s+)?with\s+(?:a\s+)?(?:bit\s+of\s+)?(?:lavish\s+)?([^.!?]{6,100})/i,
  )
  if (!hasMainNotesBlock && completes?.[1]) {
    const material = extractProseMaterialCue(completes[1])
    if (material) segments.push(`base notes: ${material}`)
  }

  if (!hasMainNotesBlock) {
    for (const m of collapsed.matchAll(
      /\b(?:a\s+touch\s+of|with\s+a\s+bit\s+of)\s+([A-Za-z][^.!?]{4,60})/gi,
    )) {
      const material = extractProseMaterialCue((m[1] ?? "").trim())
      if (material) segments.push(`base notes: ${material}`)
    }
  }

  return [...new Set(segments)]
}

const unescapeHtmlAttr = (s: string): string =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\u00a0/g, " ")

/** Andromeda's Moon PDPs: "Top — Sapodilla, Ambrette Heart — Magnolia … Base — Musk …" */
const extractAndromedaEmDashLayeredNotesFromPlain = (plain: string): string[] => {
  const collapsed = (plain ?? "").replace(/\s+/g, " ").trim()
  if (!/\bTop\s*[—–—-]\s*.+\bHeart\s*[—–—-]\s*.+\bBase\s*[—–—-]\s*/i.test(collapsed)) {
    return []
  }
  const segments: string[] = []
  for (const layer of ["top", "heart", "base"] as const) {
    const m = collapsed.match(
      new RegExp(
        `\\b${layer}\\s*[—–—-]\\s*([\\s\\S]+?)(?=\\s+(?:Top|Heart|Base)\\s*[—–—-]|\\s+Scent\\s+Story|\\s+Available\\s+Sizes?|\\s+Wear\\s*(?:&|and)\\s*Layer|\\s+Sizes?\\b|\\s+Processing\\b|\\s+ANDROMEDA|$)`,
        "i",
      ),
    )
    if (m?.[1]?.trim()) segments.push(`${layer} notes: ${m[1].trim()}`)
  }
  return segments
}

/**
 * Andromeda emoji PDPs: "🍉 Top notes of mandarin orange, lemon … 🥥 Middle notes of coconut …"
 * Whitespace-collapsed prose uses "Top/Middle/Base notes of|are|is …" without colons.
 */
const extractAndromedaNotesOfLayeredFromPlain = (plain: string): string[] => {
  const collapsed = (plain ?? "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!/\b(?:top|middle|base)\s+notes?\s+(?:of|are|is)\s+/i.test(collapsed)) return []

  const segments: string[] = []
  const re = /\b(top|middle|base)\s+notes?\s+(?:of|are|is)\s+/gi
  const matches = [...collapsed.matchAll(re)]
  if (matches.length < 2) return []

  const stopRe =
    /\s+(?:Why\s+You(?:'|'|&#39;)ll|ORIGINAL|As with any|Processing|Important|Ingredients|Share\s+Share|\#{1,6}\s)/i

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    const label = (m[1] ?? "").toLowerCase()
    const layer = label === "middle" ? "heart" : label === "base" ? "base" : "open"
    const start = (m.index ?? 0) + m[0].length
    const end = i + 1 < matches.length ? matches[i + 1].index! : collapsed.length
    let chunk = collapsed.slice(start, end).trim()
    const stop = chunk.match(stopRe)
    if (stop?.index != null) chunk = chunk.slice(0, stop.index).trim()
    chunk = chunk.replace(/[.!?]+\s*$/, "").trim()
    if (chunk) segments.push(`${layer} notes: ${chunk}`)
  }
  return segments
}

const LAYER_MARKER_ONLY_RE = /^(?:top|middle|base)\s+notes?$/i
const LAYER_MARKER_LEADING_RE = /^(?:top|middle|base)\s+notes?\s+(?:are|is|of)\s+(.+)$/i

const hasEmbeddedLayerMarkers = (layers: {
  openNotes: string[]
  heartNotes: string[]
  baseNotes: string[]
}): boolean => {
  const all = [...layers.openNotes, ...layers.heartNotes, ...layers.baseNotes]
  return all.some(n => {
    const p = n.trim()
    return LAYER_MARKER_ONLY_RE.test(p) || LAYER_MARKER_LEADING_RE.test(p)
  })
}

/** Flat comma lists that glued layer headers ("middle notes", "base notes are ebony") into openNotes. */
const relayerNotesWithEmbeddedLayerMarkers = (layers: {
  openNotes: string[]
  heartNotes: string[]
  baseNotes: string[]
}): { openNotes: string[]; heartNotes: string[]; baseNotes: string[] } => {
  const ordered = [...layers.openNotes, ...layers.heartNotes, ...layers.baseNotes]
  if (!hasEmbeddedLayerMarkers(layers)) return layers

  const open: string[] = []
  const heart: string[] = []
  const base: string[] = []
  let current: "open" | "heart" | "base" = "open"

  const pushSanitized = (note: string, layer: "open" | "heart" | "base") => {
    const sanitized = sanitizeExtractedNoteCandidate(note)
    if (!sanitized) return
    if (layer === "open") open.push(sanitized)
    else if (layer === "heart") heart.push(sanitized)
    else base.push(sanitized)
  }

  for (const raw of ordered) {
    const p = raw.trim()
    if (!p) continue
    if (LAYER_MARKER_ONLY_RE.test(p)) {
      if (/^middle/i.test(p)) current = "heart"
      else if (/^base/i.test(p)) current = "base"
      else if (/^top/i.test(p)) current = "open"
      continue
    }
    const glued = p.match(LAYER_MARKER_LEADING_RE)
    if (glued) {
      if (/^middle/i.test(p)) current = "heart"
      else if (/^base/i.test(p)) current = "base"
      else current = "open"
      for (const part of splitNoteList(glued[1] ?? "")) pushSanitized(part, current)
      continue
    }
    pushSanitized(p, current)
  }

  return {
    openNotes: uniqueNotes(open),
    heartNotes: uniqueNotes(heart),
    baseNotes: uniqueNotes(base),
  }
}

/**
 * Matiere Premiere (and similar) Shopify PDPs: MAIN INGREDIENT + CREATIVE APPROACH prose blocks.
 * Example: "thanks to Saffron … with Ciste Labdanum Andalusia … MAIN INGREDIENT: Birch Tar Finland."
 */
const trimMatiereMaterial = (raw: string): string | null => {
  const t = raw.trim().replace(/[.]+$/, "").trim()
  if (!t || t.length < 3 || t.length > 80) return null
  if (!/[a-z]{2,}/i.test(t)) return null
  return t
}

const CREATIVE_MATERIAL_VERB_RE =
  /\s+(?:amplifies?|underlines?|accentuates?|both\s+accentuates?|brings?|envelop(?:s)?)\b/i

const MATIERE_PROGRAMME_TAIL_RE =
  /\b(?:fair for life|agricultural programme|programme|certified|organic)\b/i

const extractMatierePremiereMaterialsFromPlain = (plain: string): string[] => {
  const collapsed = (plain ?? "").replace(/\s+/g, " ").trim()
  if (!/\b(?:main\s+ingredient|creative\s+approach)\s*:/i.test(collapsed)) return []

  const materials: string[] = []
  const push = (raw: string | null | undefined) => {
    const t = raw ? trimMatiereMaterial(raw) : null
    if (t) materials.push(t.toLowerCase())
  }

  const mainMatch = collapsed.match(/\bmain\s+ingredient\s*:\s*(.+?)(?=\s+CREATIVE\s+APPROACH\b|$)/i)
  if (mainMatch?.[1]) {
    let body = mainMatch[1].trim().replace(/\.\s*$/, "")
    const noteTail = body.match(/\bnote,?\s+(.+)$/i)
    if (noteTail?.[1]) {
      push(noteTail[1])
    } else if (/,\s*/.test(body)) {
      const parts = body.split(/,\s*/).map(p => p.trim()).filter(Boolean)
      const materialPart = parts.find(p => !MATIERE_PROGRAMME_TAIL_RE.test(p))
      push(materialPart ?? parts[0])
    } else {
      body = body.replace(/^a\s+(?:\w+(?:\s+\w+){0,4}\s+)?note,?\s*/i, "").trim()
      push(body)
    }
  }

  const creativeMatch = collapsed.match(
    /\bcreative\s+approach\s*:\s*(.+?)(?=\s+Available\s+sizes?\b|\s+Customer\s+Reviews\b|$)/i,
  )
  if (creativeMatch?.[1]) {
    const body = creativeMatch[1]
    const materialPatterns = [
      /\bthanks\s+to\s+([A-Z][A-Za-z'°\s-]+?)(?=[,;.]|$)/gi,
      /\btexture\s+of\s+([A-Z][A-Za-z'°\s-]+?)\s+to\b/gi,
      /\bwith\s+([A-Z][A-Za-z'°\s-]+?)(?=[,;.]|$)/gi,
      /\b(?:amplified|reinforced)\s+by\s+([A-Za-z][A-Za-z'°\s-]+?)(?=[,;.]|$)/gi,
      /\b([A-Z][A-Za-z'°\s-]+?)\s+is\s+used\s+to\b/gi,
    ]
    for (const re of materialPatterns) {
      re.lastIndex = 0
      for (const m of body.matchAll(re)) push(m[1])
    }
    for (const sentence of body.split(/(?<=[.!?])\s+/)) {
      const verbMatch = sentence.match(CREATIVE_MATERIAL_VERB_RE)
      if (!verbMatch?.index || verbMatch.index <= 0) continue
      let candidate = sentence.slice(0, verbMatch.index).trim()
      const ofTail = candidate.match(/\bof\s+([A-Za-z][A-Za-z'°\s-]+)$/i)
      if (ofTail?.[1]) candidate = ofTail[1]
      push(candidate)
    }
  }

  return uniqueNotes(materials)
}

/** Extrait PDPs without CREATIVE APPROACH — prose cites Absolutes and guest ingredients. */
const extractMatierePremiereExtraitMaterialsFromPlain = (plain: string): string[] => {
  const collapsed = (plain ?? "").replace(/\s+/g, " ").trim()
  if (!collapsed) return []

  const materials: string[] = []
  const push = (raw: string | null | undefined) => {
    const t = raw ? trimMatiereMaterial(raw) : null
    if (!t) return
    if (/\b(?:intensity of|deep intensity|contrast between|guest ingredient)\b/i.test(t)) return
    materials.push(t.toLowerCase())
  }

  for (const m of collapsed.matchAll(
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\s+Absolute)\s+from\s+([A-Z][a-z]+)\b/g,
  )) {
    push(`${m[1]} ${m[2]}`)
  }

  const guest = collapsed.match(/\bguest\s+ingredient\s*:\s*([^.]{4,80})/i)
  if (guest?.[1]) push(guest[1].trim())

  for (const m of collapsed.matchAll(
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\s+Absolute)\s+([A-Z][a-z]+)\b/g,
  )) {
    if (/^\s*from\b/i.test(m[2])) continue
    push(`${m[1]} ${m[2]}`)
  }

  return uniqueNotes(materials)
}

const extractMatierePremiereNoteBlockFromPlain = (plain: string): string | null => {
  const materials = uniqueNotes([
    ...extractMatierePremiereMaterialsFromPlain(plain),
    ...extractMatierePremiereExtraitMaterialsFromPlain(plain),
  ])
  if (materials.length < 2) return null
  return `fragrance notes: ${materials.join(", ")}`.slice(0, 4000)
}

/**
 * Extract "Featured notes: …" / key notes from already-plain text (meta description, stripped body).
 */
const extractFeaturedBlockFromPlain = (t: string): string | null => {
  const plain = (t ?? "").replace(/\s+/g, " ").trim()

  const matiereBlock = extractMatierePremiereNoteBlockFromPlain(plain)
  if (matiereBlock) return matiereBlock

  /**
   * Wix / boutique PDPs (e.g. Seventh Muse): product blurb is a prose line with
   * "sweet/spicy blend of Patchouli, Vanilla, …" — no "Featured notes:" header.
   * Run before the length gate so short meta descriptions still bootstrap.
   */
  /**
   * Stop boundaries for inline-prose blend phrases. Wix / Shopify / Etsy PDPs render UI labels
   * (Quantity, Add to Cart, Buy It Now, Subscribe, Details) immediately after the description
   * with no real punctuation in between, so the boundary needs to include them — otherwise the
   * regex consumes past the last real note and "Persian Lime" becomes "Persian Lime Quantity".
   */
  const ECOMMERCE_STOP =
    String.raw`(?=\s+\$\d|\s+Price\s|\s+Quantity\b|\s+Qty\b|\s+SKU\b|\s+Add\s+to\s+(?:Cart|Wishlist|Bag|Favorites)\b|\s+Buy\s+(?:Now|It\s+Now)\b|\s+Subscribe\b|\s+View\s+full\s+details\b|\s+Choose\s+a\s+selection\b|[.!?]|$)`

  const blendPhrase = plain.match(
    new RegExp(
      String.raw`\b(?:[\w.]+\s+){0,6}(?:sweet\/spicy\s+)?blend\s+of\s+.+?${ECOMMERCE_STOP}`,
      "i",
    ),
  )
  if (blendPhrase?.[0]) {
    const raw = blendPhrase[0].trim()
    const listLike =
      /,/.test(raw) ||
      /\band\s+a\s+hint\s+of\b/i.test(raw) ||
      /\b(?:\w+,\s*){2,}\w+\b/i.test(raw)
    if (raw.length >= 25 && listLike) return raw.slice(0, 4000)
  }

  const aromaBlend = plain.match(
    new RegExp(
      String.raw`\b(?:scent|fragrance|aroma)\s+blend\s+of\s+.+?${ECOMMERCE_STOP}`,
      "i",
    ),
  )
  if (aromaBlend?.[0]) {
    const raw = aromaBlend[0].trim()
    if (raw.length >= 22 && /,/.test(raw)) return raw.slice(0, 4000)
  }

  /**
   * "Dew and Honeysuckle…just what we imagine" (Wix PDPs, e.g. seventhmuse.net spring-fairy-perfume-oil).
   * List-like fragment before ellipsis + marketing; excludes `$` so price tails do not merge.
   */
  const ellipsisHook = plain.match(
    /\b([A-Z][^.!?\n*$]{2,85}?)\s*(?:\.{2,}|\u2026)\s*(?:just\b|here'?s|here\s+is|this\s+is|we\s+|you\s+'?ll|read\s+more|learn\s+more|click\s+)/i,
  )
  if (ellipsisHook?.[1]) {
    /**
     * Wix / boutique PDPs render the price label INLINE just before the description (e.g.
     * "Spring Fairy Perfume Oil $21.00 Price Dew and Honeysuckle…just what we imagine…").
     * The `[A-Z]` start-anchor latches on to "Price"/"Quantity"/etc., not the actual scent line —
     * strip any leading e-commerce labels so "Dew and Honeysuckle" is what `splitNoteList` sees.
     */
    const raw = ellipsisHook[1]
      .trim()
      .replace(
        /^(?:\$?\d+(?:[.,]\d+)?|price|quantity|qty|sku|item|product|in\s+stock|out\s+of\s+stock)\b[\s:,-]*/gi,
        "",
      )
      .trim()
    const listLike = /\band\b/i.test(raw) || /,/.test(raw)
    if (listLike && raw.length >= 8 && raw.length <= 120) return raw.slice(0, 4000)
  }

  if (plain.length < 30) return null

  const aromasOf = plain.match(/\b(?:seamlessly\s+)?blending\s+aromas?\s+of\s+([^.]{12,220})/i)
  if (aromasOf?.[1]) {
    const body = aromasOf[1].trim().replace(/[,;]\s*$/, "")
    if (body.length >= 12 && /,/.test(body)) {
      return `fragrance notes: ${body}`.slice(0, 4000)
    }
  }

  const featured = plain.match(
    new RegExp(String.raw`\bfeatured\s+notes?\s*:\s*(.+?)${FEATURED_LIST_SECTION_STOP}`, "i"),
  )
  if (featured?.[1]) {
    const body = featured[1].trim().replace(/[,;]\s*$/, "")
    if (body.length >= 12 && /[a-z]{2,}/i.test(body)) {
      return `featured notes: ${body}`.slice(0, 4000)
    }
  }

  const keyNotes = plain.match(
    new RegExp(
      String.raw`\b(?:key|main|signature|primary|dominant)\s+notes?\s*:\s*(.+?)${FEATURED_LIST_SECTION_STOP}`,
      "i",
    ),
  )
  if (keyNotes?.[1]) {
    const body = keyNotes[1].trim().replace(/[,;]\s*$/, "")
    if (body.length >= 12 && /[a-z]{2,}/i.test(body)) {
      return `key notes: ${body}`.slice(0, 4000)
    }
  }

  const featuring = plain.match(/\bfeaturing\s+notes?\s+of\s+([^.]{12,2000})\./i)
  if (featuring?.[1]) {
    const body = featuring[1].trim()
    return `fragrance notes: ${body}.`.slice(0, 4000)
  }

  const scentInc = plain.match(/\bscent\s+notes?\s+include\s+([^.]{12,2000})\./i)
  if (scentInc?.[1]) {
    const body = scentInc[1].trim()
    return `scent notes include ${body}.`.slice(0, 4000)
  }

  const fragAre = plain.match(/\bfragrance\s+notes?\s+are\s+([^.]{12,2000})\./i)
  if (fragAre?.[1]) {
    const body = fragAre[1].trim()
    return `fragrance notes are ${body}.`.slice(0, 4000)
  }

  const notesOf = plain.match(/\b(?:inviting\s+)?notes?\s+of\s+([^.]{12,220})/i)
  if (notesOf?.[1]) {
    const body = notesOf[1].trim().replace(/[,;]\s*$/, "")
    if (body.length >= 12 && /,/.test(body)) {
      return `fragrance notes: ${body}`.slice(0, 4000)
    }
  }

  const patternEtsy = extractPatternEtsyNoteSegmentsFromPlain(plain)
  if (patternEtsy.length > 0) return patternEtsy.join("\n").slice(0, 4000)

  const shopifyIndie = extractShopifyIndieNoteSegmentsFromPlain(plain)
  if (shopifyIndie.length > 0) return shopifyIndie.join("\n").slice(0, 4000)

  const unlabeled = extractUnlabeledFragranceNotesBlock(plain)
  if (unlabeled.length >= 2) {
    return `fragrance notes: ${unlabeled.join(", ")}`.slice(0, 4000)
  }

  const emDashLayers = extractAndromedaEmDashLayeredNotesFromPlain(plain)
  if (emDashLayers.length >= 2) {
    return emDashLayers.join("\n").slice(0, 4000)
  }

  const layeredHeadingPyramid = extractLayeredHeadingPyramidFromPlain(plain)
  if (layeredHeadingPyramid) return layeredHeadingPyramid

  const mainNotesGlued = plain.match(
    /\b(?:fragrance\s+profile\s+)?main\s+notes?\s+(?![:\-\u2013\u2014–—])([A-Za-z][^.!?]{8,220}?)(?=\s+Overall\s+Vibe|\s+Main\s+Accords?|\s+When\s+to\s+Wear|\s+Available\s+Sizes?|\s+How\s+(?:It\s+)?Wears|$)/i,
  )
  if (mainNotesGlued?.[1]) {
    const parsed = splitGluedMerchantNoteRun(mainNotesGlued[1].trim())
    if (parsed.length >= 2) {
      return `main notes: ${parsed.join(", ")}`.slice(0, 4000)
    }
  }

  return null
}

/**
 * Andromeda's Moon PDPs: bare "Notes" header then stacked materials (no colon, no bullets).
 * Example: Notes Almond Amaretto Liqueur Accord Wear & Layer …
 */
const extractAndromedaStackedNotesFromPlain = (plain: string): string[] => {
  const stacked = plain.match(
    /\bnotes?\s+(?!(?:top|heart|base|middle)\s*:|[:\-\u2013\u2014–—])([A-Z][A-Za-z\s'-]{3,280}?)(?=\s+Wear\s*(?:&|and)\s*Layer|\s+Available\s+Sizes?|\s+What\s+You(?:'|'|&#39;)ll\s+Smell|\s+Important\b|\s+\*?\s*Processing\b|\s+Scent\s+Vibe|\s+How\s+(?:It\s+)?Wears|\s+Main\s+Accords?|\s+Overall\s+Vibe|$)/i,
  )
  if (!stacked?.[1]) return []
  const body = stacked[1].trim()
  if (!body || /^(?:top|heart|base|middle)\b/i.test(body)) return []
  return splitGluedMerchantNoteRun(body)
}

/** Thin scrape fallback when Orgasmo-style copy mentions amaretto but omits the Notes block. */
const inferAndromedaAmarettoNotesFromProse = (text: string): string[] => {
  const t = text ?? ""
  if (!/\bamaretto\b/i.test(t)) return []
  const hasAlmondSignal =
    /\balmond\b/i.test(t) ||
    /\bamaretto\s*[-–—]\s*(?:\s*almond|\s*gourmand)\b/i.test(t) ||
    /\bamaretto\s+on\s+the\s+rocks\b/i.test(t) ||
    /\bamaretto(?:\s+|-)almond\b/i.test(t)
  if (!hasAlmondSignal) return []
  return ["almond", "amaretto liqueur accord"]
}

/**
 * Andromeda's Moon PDPs: "Scent Profile" block (no colon) — space-glued merchant materials
 * before Vibe / Wear It When / Strength sections.
 * Example: Scent Profile Tahitian Vanilla Tonka Bean Sugar Cane Almond Milk White Musk Amber
 */
const extractAndromedaScentProfileFromPlain = (plain: string): string[] => {
  const collapsed = (plain ?? "").replace(/\s+/g, " ").trim()
  if (!collapsed) return []
  const m = collapsed.match(
    /\bscent\s+profile\s+(?!(?:top|heart|base|middle)\s*:)([A-Za-z0-9][A-Za-z0-9\s&'’·•.\-]{2,220}?)(?=\s+(?:Vibe\b|Wear\s+It\s+When\b|Strength\b|Available\s+Sizes?|Fragrance\s+Description\b|Important\s+Information\b|Store\s+Policy\b|Andromeda(?:'|'|&#39;)s\s+Moon\s+is|Processing\b|Important\b)|$)/i,
  )
  if (!m?.[1]) return []
  const blob = m[1]
    .trim()
    .replace(/[•·]/g, ",")
    .replace(/\s+/g, " ")
    .trim()
  const parsed = splitNoteList(blob)
  return parsed.length >= 2 ? parsed : []
}

/** Turn a Top/Heart/Base layer chunk (bullets or space-glued) into a comma list for splitNoteList. */
const andromedaLayerChunkToList = (raw: string): string => {
  const cleaned = raw
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}✨]/gu, " ")
    .replace(/[•·]/g, ",")
    .replace(/\s+/g, " ")
    .trim()
  if (!cleaned) return ""
  if (/[,;]/.test(cleaned)) return cleaned
  const split = splitGluedMerchantNoteRun(cleaned)
  if (split.length >= 2) return split.join(", ")
  if (cleaned.split(/\s+/).filter(Boolean).length >= 3) {
    const exploded = explodeSpaceSeparatedNoteBlob(cleaned)
    if (exploded.length >= 2) return exploded.join(", ")
  }
  return cleaned
}

/**
 * Andromeda prose PDPs without a pyramid block (e.g. Ginger Biscuit Jo Malone):
 * "…sweetly spiced blending ginger, cinnamon, and nutmeg with the comforting richness of
 * caramel and toasted hazelnut. The base melts into soft vanilla and smooth tonka bean…"
 */
const extractAndromedaBlendingProseNotesFromPlain = (plain: string): string[] => {
  const collapsed = (plain ?? "").replace(/\s+/g, " ").trim()
  if (!/\bblending\b/i.test(collapsed) && !/\b(?:the\s+)?base\s+melts?\s+into\b/i.test(collapsed)) {
    return []
  }

  const segments: string[] = []

  const blendingMatch = collapsed.match(
    /\b(?:sweetly\s+spiced\s+)?blending\s+([^.!?]{8,220}?)(?:\.\s*(?:The\s+(?:base|heart|drydown|dry\s+down)|Please|✨|Andromeda)|\.|$)/i,
  )
  if (blendingMatch?.[1]) {
    const blendBody = blendingMatch[1].trim()
    const withSplit = blendBody.match(
      /^(.+?)\s+with\s+(?:the\s+)?(?:comforting\s+richness|warmth|hint|touch|notes?|heart|depth)\s+of\s+(.+)$/i,
    )
    if (withSplit?.[1] && withSplit[2]) {
      segments.push(`open notes: ${withSplit[1].trim()}`)
      segments.push(`heart notes: ${withSplit[2].trim()}`)
    } else {
      const simpleWith = blendBody.match(/^(.+?)\s+with\s+(.+)$/i)
      if (simpleWith?.[1] && simpleWith[2] && /,/.test(simpleWith[1])) {
        segments.push(`open notes: ${simpleWith[1].trim()}`)
        segments.push(`heart notes: ${simpleWith[2].trim()}`)
      } else {
        segments.push(`open notes: ${blendBody}`)
      }
    }
  }

  const baseMatch = collapsed.match(
    /\b(?:the\s+)?base\s+(?:melts?|settles?|lingers?|dries?|opens?|evolves?)\s+(?:into|on|with|in|to)\s+([^.!?]{6,140})/i,
  )
  if (baseMatch?.[1]) {
    const baseList = baseMatch[1]
      .trim()
      .replace(/,?\s*creating\b.*$/i, "")
      .replace(/,?\s*leaving\b.*$/i, "")
      .trim()
    if (baseList) segments.push(`base notes: ${baseList}`)
  }

  return segments
}

/**
 * Andromeda PDPs: ## Notes / Notes Pyramid with stacked Top / Heart / Base (• bullets or space-glued).
 * Collapsed: "Notes Top Passionfruit • … Heart … Base …" or "Notes Pyramid Top Orange Bergamot … Heart … Base … Vibe"
 */
const extractAndromedaBulletPyramidFromPlain = (plain: string): string[] => {
  const collapsed = (plain ?? "").replace(/\s+/g, " ").trim()

  const block = collapsed.match(
    /\b(?:notes?\s+pyramid|notes?)\b\s+top\b\s+(.+?)\s+heart\b\s+(.+?)\s+base\b\s+(.+?)(?=\s+(?:scent\s+story|opening\b|wear\s+guide|vibe\s*&\s*wear|vibe\b|good\s+to\s+know|layering\s+ideas|drydown\b|fragrance\s+description|description\b|important\s+information|original\s+manufacturers)|$)/i,
  )
  if (!block?.[1] || !block[2] || !block[3]) return []

  const segments: string[] = []
  const open = truncateAtShopMetaLabels(andromedaLayerChunkToList(block[1]))
  const heart = truncateAtShopMetaLabels(andromedaLayerChunkToList(block[2]))
  const base = truncateAtShopMetaLabels(andromedaLayerChunkToList(block[3]))
  if (open && /[a-z]{3,}/i.test(open)) segments.push(`open notes: ${open}`)
  if (heart && /[a-z]{3,}/i.test(heart)) segments.push(`heart notes: ${heart}`)
  if (base && /[a-z]{3,}/i.test(base)) segments.push(`base notes: ${base}`)
  return segments
}

/**
 * Top/Middle/Base, or "Scent Notes" with Top:/Heart:/Base: bullets.
 */
const extractShopifyIndieNoteSegmentsFromPlain = (plain: string): string[] => {
  const collapsed = (plain ?? "").replace(/\r/g, "\n").replace(/\s+/g, " ").trim()
  if (!collapsed) return []

  const segments: string[] = []
  const bulletToComma = (s: string) => s.replace(/[•·]/g, ",").replace(/\s+/g, " ").trim()

  for (const segment of extractAndromedaBulletPyramidFromPlain(collapsed)) {
    segments.push(segment)
  }

  for (const segment of extractAndromedaNotesOfLayeredFromPlain(collapsed)) {
    segments.push(segment)
  }

  for (const segment of extractAndromedaBlendingProseNotesFromPlain(collapsed)) {
    segments.push(segment)
  }

  const scentProfile = extractAndromedaScentProfileFromPlain(collapsed)
  if (scentProfile.length >= 2) {
    segments.push(`top notes: ${scentProfile.join(", ")}`)
  }

  const stackedNotes = extractAndromedaStackedNotesFromPlain(collapsed)
  if (stackedNotes.length >= 1) {
    segments.push(`top notes: ${stackedNotes.join(", ")}`)
  }

  for (const segment of extractAndromedaEmDashLayeredNotesFromPlain(collapsed)) {
    segments.push(segment)
  }

  const notesLine = collapsed.match(
    /\bnotes?\s*:\s*([^.!?]{8,280}?)(?=\s+(?:A\s+dreamy|Note\s+Breakdown|Available\s+Sizes?|Important\s+Disclaimer|Store\s+Policy)|$)/i,
  )
  if (notesLine?.[1]) {
    const body = bulletToComma(notesLine[1])
    if ((/,/.test(body) || /[•·]/.test(notesLine[1])) && /[a-z]{3,}/i.test(body)) {
      segments.push(`top notes: ${body}`)
    }
  }

  const breakdown = collapsed.match(/\bnote\s+breakdown\s+(.+?)(?=\s+Available\s+Sizes?|Important\s+Disclaimer|$)/i)
  if (breakdown?.[1]) {
    const chunk = breakdown[1]
    for (const m of chunk.matchAll(
      /\b(top|middle|base)\s+([^.!?]{3,160}?)(?=\s+\b(?:top|middle|base)\s+|$)/gi,
    )) {
      const layer = m[1].toLowerCase() === "middle" ? "heart" : m[1].toLowerCase()
      segments.push(`${layer} notes: ${bulletToComma(m[2])}`)
    }
  }

  const scentNotes = collapsed.match(
    /\bscent\s+notes?\s+(.+?)(?=\s+(?:🧸|Cozy\s+and|For\s+milk|ORIGINAL\s+MANUFACTURERS|As\s+with\s+any\s+fragrance)|$)/i,
  )
  if (scentNotes?.[1]) {
    const chunk = scentNotes[1]
    for (const m of chunk.matchAll(
      /\*{0,2}(top|heart|base)\*{0,2}\s*:\s*([^*]{4,160}?)(?=\s+\*{0,2}(?:top|heart|base)\*{0,2}\s*:|$)/gi,
    )) {
      segments.push(`${m[1].toLowerCase()} notes: ${bulletToComma(m[2])}`)
    }
  }

  return [...new Set(segments)]
}

const extractFromMetaDescriptionTag = (html: string): string | null => {
  const m = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)
  if (!m?.[1]) return null
  const plain = unescapeHtmlAttr(m[1]).replace(/\s+/g, " ").trim()
  return extractFeaturedBlockFromPlain(plain)
}

/** Shopify product JSON / JSON-LD often embeds the full RTE string with "Featured Notes: …" before scripts are stripped. */
const extractFeaturedFromRawHtmlQuotes = (html: string): string | null => {
  const idx = html.search(/Featured Notes\s*:/i)
  if (idx < 0) return null
  const slice = html.slice(idx, idx + 4500)
  const rough = slice
    .replace(/\\u003c/gi, "<")
    .replace(/\\u003e/gi, ">")
    .replace(/\\n/g, " ")
    .replace(/\\"/g, '"')
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return extractFeaturedBlockFromPlain(rough)
}

const LAYERED_PYRAMID_LABEL_RE =
  /(?<![a-z0-9-])(top|open|opening|head|heart|middle|mid|core|body|center|centre|base|bottom|background|foundation|dry\s*down|drydown|end)\s*(?:notes?)?\s*[:\-\u2013\u2014–—]\s*/gi

const PYRAMID_LAYER_STOP_RE =
  /\s+(?:product\s+reviews?(?:\s*&\s*videos?)?|related\s+products|description\b|master\s+perfumer|olfactory\s+notes|shopping\s+cart|add to cart|you may also|customers also)\b/i

/**
 * Vivamor / WooCommerce themes: <h5>Top Notes:</h5><p>Calabrian Bergamot …</p> (accordion tab).
 * Also matches collapsed plain text after stripHtmlToPlainText.
 */
const extractLayeredHeadingPyramidFromPlain = (plain: string): string | null => {
  const collapsed = (plain ?? "").replace(/\s+/g, " ").trim()
  if (!collapsed) return null
  const layerMatches = [...collapsed.matchAll(LAYERED_PYRAMID_LABEL_RE)]
  if (layerMatches.length < 2) return null

  const segments: string[] = []
  for (let i = 0; i < layerMatches.length; i += 1) {
    const m = layerMatches[i]
    const label = (m[1] ?? "").trim().toLowerCase()
    const start = (m.index ?? 0) + m[0].length
    const end = i + 1 < layerMatches.length ? layerMatches[i + 1].index! : collapsed.length
    let chunk = collapsed.slice(start, end).trim()
    const stop = chunk.search(PYRAMID_LAYER_STOP_RE)
    if (stop != null && stop >= 3) chunk = chunk.slice(0, stop).trim()
    chunk = chunk.replace(/,\s*$/, "").trim()
    if (chunk.length < 3) continue
    const layer =
      /^(?:heart|middle|mid|core|body|center|centre)$/.test(label)
        ? "heart"
        : /^(?:base|bottom|background|foundation|dry\s*down|drydown|end)$/.test(label)
          ? "base"
          : "top"
    segments.push(`${layer} notes: ${chunk}`)
  }
  return segments.length >= 2 ? segments.join("\n").slice(0, 4000) : null
}

const extractLayeredHeadingPyramidFromHtml = (html: string): string | null => {
  const segments: string[] = []
  const re =
    /<h[1-6][^>]*>\s*(top|open|opening|head|heart|middle|mid|core|body|center|centre|base|bottom|background|foundation|dry\s*down|drydown|end)\s*(?:notes?)?\s*:?\s*<\/h[1-6]>\s*(?:<p[^>]*>([\s\S]*?)<\/p>|<[^>]+>([\s\S]*?)<\/[^>]+>)/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    const label = (match[1] ?? "").trim().toLowerCase()
    const body = (match[2] ?? match[3] ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
    if (body.length < 3) continue
    const layer =
      /^(?:heart|middle|mid|core|body|center|centre)$/.test(label)
        ? "heart"
        : /^(?:base|bottom|background|foundation|dry\s*down|drydown|end)$/.test(label)
          ? "base"
          : "top"
    segments.push(`${layer} notes: ${body}`)
  }
  if (segments.length >= 2) return segments.join("\n").slice(0, 4000)
  return null
}

/** Ellis Brooklyn / Shopify themes: <dt>Top</dt><dd>Creamy Milk Accord, …</dd> */
const extractDtDdPyramidFromHtml = (html: string): string | null => {
  const segments: string[] = []
  const re =
    /<dt[^>]*>\s*(top|mid|middle|heart|base|dry)\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    const label = (match[1] ?? "").trim().toLowerCase()
    const body = (match[2] ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
    if (body.length < 4) continue
    const layer =
      label === "top"
        ? "top"
        : label === "mid" || label === "middle" || label === "heart"
          ? "heart"
          : "base"
    segments.push(`${layer} notes: ${body}`)
  }
  if (segments.length >= 2) return segments.join("\n").slice(0, 4000)
  return null
}

/**
 * Kayali / Huda Beauty Shopify: real pyramid lives in `<ul class="notes-container">`.
 * Two layouts:
 *  A) Unlabeled comma lists: `<li><p>a, b, c</p></li>` × 3 (Top→Heart→Base by order)
 *  B) Labeled chips: `<li><h5>Top Notes:</h5><… class="product-tag"><span>Matcha</span>…`
 * Public product.json body_html is marketing-only.
 */
const extractKayaliNotesContainerFromHtml = (html: string): string | null => {
  if (!html || !/notes-container/i.test(html)) return null

  // Layout B — labeled Top / Middle|Heart / Dry|Base with product-tag chips
  const labeledSegments: string[] = []
  const labeledLiRe =
    /<li\b[^>]*>[\s\S]*?<h[1-6][^>]*>\s*(Top|Open(?:ing)?|Head|Middle|Mid|Heart|Dry(?:\s*Down)?|Base|Bottom)\s*Notes?\s*:?\s*<\/h[1-6]>([\s\S]*?)<\/li>/gi
  let labeledMatch: RegExpExecArray | null
  while ((labeledMatch = labeledLiRe.exec(html)) !== null) {
    const label = (labeledMatch[1] ?? "").trim().toLowerCase()
    const block = labeledMatch[2] ?? ""
    if (!/product-tag/i.test(block) && !/font-body-xs/i.test(block)) continue
    const notes: string[] = []
    const tagRe =
      /<span\b[^>]*class="[^"]*font-body-xs[^"]*"[^>]*>([\s\S]*?)<\/span>/gi
    let tagMatch: RegExpExecArray | null
    while ((tagMatch = tagRe.exec(block)) !== null) {
      const note = (tagMatch[1] ?? "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
      if (note.length >= 2) notes.push(note)
    }
    if (notes.length === 0) continue
    const layer =
      /^(?:middle|mid|heart)$/.test(label)
        ? "heart"
        : /^(?:dry|dry\s*down|base|bottom)$/.test(label)
          ? "base"
          : "top"
    labeledSegments.push(`${layer} notes: ${notes.join(", ")}`)
  }
  if (labeledSegments.length >= 2) {
    return labeledSegments.join("\n").slice(0, 4000)
  }

  // Layout A — unlabeled <p> comma lists inside notes-container (no nested tag chips)
  const layers = ["top", "heart", "base"] as const
  const startRe = /<ul\b[^>]*\bnotes-container\b[^>]*>/gi
  let startMatch: RegExpExecArray | null
  while ((startMatch = startRe.exec(html)) !== null) {
    const startIdx = startMatch.index + startMatch[0].length
    let depth = 1
    let i = startIdx
    while (i < html.length && depth > 0) {
      const nextOpen = html.toLowerCase().indexOf("<ul", i)
      const nextClose = html.toLowerCase().indexOf("</ul>", i)
      if (nextClose < 0) break
      if (nextOpen >= 0 && nextOpen < nextClose) {
        depth += 1
        i = nextOpen + 3
      } else {
        depth -= 1
        if (depth === 0) {
          const listHtml = html.slice(startIdx, nextClose)
          // Prefer direct li>p comma lists; ignore nested product-tag uls
          if (/product-tag/i.test(listHtml) && /Top\s*Notes?/i.test(listHtml)) {
            break
          }
          const liRe = /<li\b[^>]*>([\s\S]*?)<\/li>/gi
          const layerBodies: Array<string | null> = []
          let liMatch: RegExpExecArray | null
          while ((liMatch = liRe.exec(listHtml)) !== null) {
            if (layerBodies.length >= layers.length) break
            const liBlock = liMatch[1] ?? ""
            const pMatch = /<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(liBlock)
            if (!pMatch) {
              layerBodies.push(null)
              continue
            }
            const body = (pMatch[1] ?? "")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim()
            if (body.length < 2) {
              layerBodies.push(null)
              continue
            }
            if (
              /^(?:how to use|ingredients|shipping|returns?|size|add to|pre-?order)\b/i.test(
                body,
              )
            ) {
              layerBodies.push(null)
              continue
            }
            layerBodies.push(body)
          }
          const filledLayers = layerBodies.filter(Boolean).length
          if (filledLayers >= 2) {
            const segments: string[] = []
            for (let j = 0; j < Math.min(layerBodies.length, layers.length); j += 1) {
              const body = layerBodies[j]
              if (!body) continue
              segments.push(`${layers[j]} notes: ${body}`)
            }
            return segments.join("\n").slice(0, 4000)
          }
          break
        }
        i = nextClose + 5
      }
    }
  }
  return null
}

/** Etat Libre d'Orange: <h3>MAIN NOTES</h3><p>iris, coconut, …</p> (often <h5><strong>MAIN NOTES</strong></h5>). */
const extractEtatLibreMainNotesFromHtml = (html: string): string | null => {
  const re =
    /<h[1-6][^>]*>(?:\s*<(?:strong|b|em|span)[^>]*>\s*)?MAIN NOTES\s*(?:<\/(?:strong|b|em|span)>\s*)?<\/h[1-6]>\s*(?:<p[^>]*>([\s\S]*?)<\/p>|<[^>]+>([\s\S]*?)<\/[^>]+>)/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    const body = (match[1] ?? match[2] ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
    if (body.length >= 8) return `MAIN NOTES: ${body}`.slice(0, 4000)
  }
  const plain = stripHtmlToPlainText(html)
  const m = plain.match(
    /\bMAIN NOTES\s+([\s\S]+?)(?=\bPronunciation\b|\bCustomer Reviews\b|\bCHOOSE SIZE\b|$)/i,
  )
  if (m?.[1]?.trim()) return `MAIN NOTES: ${m[1].trim()}`.slice(0, 4000)
  return null
}

/**
 * Pull a single merchant-authored note line from raw PDP HTML when Selenium/plain description missed it.
 */
const extractMerchantNoteBootstrapFromHtml = (html: string): string | null => {
  if (!html?.trim()) return null

  // Kayali / Huda notes-container before meta — meta descriptions are often truncated
  // mid-sentence ("raspberry that sits a") and must not beat the real pyramid.
  const fromKayaliNotes = extractKayaliNotesContainerFromHtml(html)
  if (fromKayaliNotes) return fromKayaliNotes

  const fromMeta = extractFromMetaDescriptionTag(html)
  if (fromMeta) return fromMeta

  const fromEtatLibreMain = extractEtatLibreMainNotesFromHtml(html)
  if (fromEtatLibreMain) return fromEtatLibreMain

  const fromHeadingPyramid = extractLayeredHeadingPyramidFromHtml(html)
  if (fromHeadingPyramid) return fromHeadingPyramid

  const fromDtDd = extractDtDdPyramidFromHtml(html)
  if (fromDtDd) return fromDtDd

  const fromRaw = extractFeaturedFromRawHtmlQuotes(html)
  if (fromRaw) return fromRaw

  const t = stripHtmlToPlainText(html)
  const fromPlainPyramid = extractLayeredHeadingPyramidFromPlain(t)
  if (fromPlainPyramid) return fromPlainPyramid

  return extractFeaturedBlockFromPlain(t)
}

const PDP_FETCH_ATTEMPTS = 3
const PDP_FETCH_BACKOFFS_MS = [400, 1200]

/** Shared PDP HTML cache (notes bootstrap + Etat Libre description backfill). */
const pdpHtmlCache = new Map<string, string | null>()

const fetchPdpHtml = async (
  detailUrl: string,
  sig: AbortSignal | undefined,
  onProgress?: (msg: string) => void,
): Promise<string | null> => {
  if (pdpHtmlCache.has(detailUrl)) return pdpHtmlCache.get(detailUrl) ?? null

  let u: URL
  try {
    u = new URL(detailUrl)
  } catch {
    pdpHtmlCache.set(detailUrl, null)
    return null
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    pdpHtmlCache.set(detailUrl, null)
    return null
  }

  let lastErrSummary: string | null = null
  for (let attempt = 0; attempt < PDP_FETCH_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const backoff = PDP_FETCH_BACKOFFS_MS[attempt - 1] ?? 1500
      try {
        await sleep(backoff, sig)
      } catch {
        return null
      }
    }
    try {
      const res = await fetch(detailUrl, {
        signal: sig,
        redirect: "follow",
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
        },
      })
      if (res.ok) {
        const html = await res.text()
        pdpHtmlCache.set(detailUrl, html)
        return html
      }
      lastErrSummary = `HTTP ${res.status}`
      if (res.status >= 400 && res.status < 500 && res.status !== 429 && res.status !== 408) {
        pdpHtmlCache.set(detailUrl, null)
        return null
      }
    } catch (err) {
      if (sig?.aborted) return null
      lastErrSummary =
        err instanceof Error ? err.message.slice(0, 160) : String(err).slice(0, 160)
    }
  }

  if (lastErrSummary) {
    onProgress?.(`PDP fetch failed for ${detailUrl} after ${PDP_FETCH_ATTEMPTS} attempts (${lastErrSummary})`)
  }
  return null
}

const tryFetchEtatLibreProductDescription = async (
  detailUrl: string,
  sig: AbortSignal | undefined,
  onProgress?: (msg: string) => void,
): Promise<string | null> => {
  const html = await fetchPdpHtml(detailUrl, sig, onProgress)
  if (!html) return null
  const extracted = extractFullDescriptionFromHtml(html)
  if (!extracted) return null
  return normalizePdpDescription(extracted) || extracted
}

const sleep = (ms: number, sig: AbortSignal | undefined): Promise<void> =>
  new Promise((resolve, reject) => {
    if (sig?.aborted) {
      reject(sig.reason ?? new Error("aborted"))
      return
    }
    const id = setTimeout(() => {
      sig?.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(id)
      reject(sig?.reason ?? new Error("aborted"))
    }
    sig?.addEventListener("abort", onAbort, { once: true })
  })

/**
 * Resolve PDP HTML → "Featured Notes:" chunk with retry + on-progress logging.
 *
 * Resilience contract:
 *  - Successful parses (note chunk OR confirmed null content) ARE cached so a single PDP only ever
 *    parses once per process.
 *  - Transient failures (network errors, 5xx, abort-free timeouts) are NOT cached — the next caller
 *    (typically the noir-cliché rescue path) re-attempts from scratch.
 *  - Up to {@link PDP_FETCH_ATTEMPTS} attempts per call, with exponential-ish backoff between them.
 */
const tryFetchPdpNoteBootstrap = async (
  detailUrl: string,
  sig: AbortSignal | undefined,
  onProgress?: (msg: string) => void,
): Promise<string | null> => {
  const cached = pdpNoteBootstrapCache.get(detailUrl)
  if (cached !== undefined) return cached

  const html = await fetchPdpHtml(detailUrl, sig, onProgress)
  if (!html) {
    // Don't cache null HTML failures: noir-cliché rescue path may benefit from another fresh attempt.
    return null
  }
  const chunk = extractMerchantNoteBootstrapFromHtml(html)
  pdpNoteBootstrapCache.set(detailUrl, chunk)
  return chunk
}

/**
 * Some PDPs bury "Featured notes:" / "Key notes:" after long prose. Pull those labeled spans up so
 * flat-list regex reliably runs (and so runs beat noir-only tails in the same string).
 */
const augmentNotesSourceWithLabeledLists = (raw: string): string => {
  const collapsed = (raw ?? "").replace(/\r/g, "\n").replace(/\s+/g, " ").trim()
  if (!collapsed) return raw ?? ""

  const segments: string[] = [
    ...extractPatternEtsyNoteSegmentsFromPlain(collapsed),
    ...extractShopifyIndieNoteSegmentsFromPlain(collapsed),
  ]

  const re = new RegExp(
    String.raw`\b((?:featured|key|main|primary|signature|dominant)\s+notes?)\s*:\s*(.+?)${FEATURED_LIST_SECTION_STOP}`,
    "gi",
  )
  let m: RegExpExecArray | null
  while ((m = re.exec(collapsed)) !== null) {
    const label = (m[1] ?? "").trim().toLowerCase()
    const list = (m[2] ?? "").trim()
    if (list.length >= 8) segments.push(`${label}: ${list}`)
  }
  if (segments.length === 0) return raw

  const boost = [...new Set(segments)].join("\n")
  const collapsedLc = collapsed.toLowerCase()
  const allSegmentsAlreadyPresent = segments.every(seg => {
    const key = seg.slice(0, Math.min(48, seg.length)).toLowerCase()
    return key.length >= 8 && collapsedLc.includes(key)
  })
  if (allSegmentsAlreadyPresent) return raw
  return `${boost}\n\n${raw}`.trim()
}
const clearPdpCachesForTests = (): void => {
  pdpHtmlCache.clear()
  pdpNoteBootstrapCache.clear()
}

export {
  resolveProductName,
  resolveNotesSource,
  hasExplicitNoteListSignal,
  shouldAutoFetchPatternEtsyNotes,
  shouldAutoFetchAndromedaMoonNotes,
  shouldAutoFetchEtatLibreNotes,
  shouldAutoFetchWooCommerceStoreNotes,
  shouldAutoFetchShopifyProductNotes,
  tryFetchPdpNoteBootstrap,
  tryFetchEtatLibreProductDescription,
  augmentNotesSourceWithLabeledLists,
  relayerNotesWithEmbeddedLayerMarkers,
  extractMerchantNoteBootstrapFromHtml,
  extractMatierePremiereMaterialsFromPlain,
  extractMatierePremiereExtraitMaterialsFromPlain,
  pdpNoteBootstrapCache,
  searchAndromedaProductUrl,
  buildAndromedaCandidateProductUrls,
  stripEmbeddedHtmlMarkup,
  stripHtmlToPlainText,
  NON_PERFUME_ANDROMEDA_PRODUCT_URL_RE,
  extractAndromedaStackedNotesFromPlain,
  extractAndromedaScentProfileFromPlain,
  inferAndromedaAmarettoNotesFromProse,
  hasEmbeddedLayerMarkers,
  clearPdpCachesForTests,
}

// Test-only exports (Kayali / CSS bleed fixtures)
export const __testOnly = {
  extractKayaliNotesContainerFromHtml,
  extractLayeredHeadingPyramidFromPlain,
}
