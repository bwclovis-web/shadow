/**
 * Types for the perfume-house scraper configuration and results.
 * Used by the admin form, API routes, and LangGraph note-extraction pipeline.
 */

/** How to trim product names around the first delimiter in the note-extraction pipeline. */
export type TitleDashSegment = "none" | "before" | "after"

/** Note extraction: standard may infer from name/theme; strict keeps only merchant-stated notes. */
export type NoteInferenceMode = "standard" | "strict"

/** Post-extraction note validation: `llm` runs a single bulk classifier over unique notes; `off` skips. */
export type NoteValidationMode = "llm" | "off"

/** QA provenance for admin preview (stripped before DB import). */
export type ScraperNoteSource =
  | "labeled_list"
  | "pdp_bootstrap"
  | "llm_description"
  | "llm_name_literal"
  | "llm_name_inferred"
  | "empty"

/**
 * Configuration submitted via the admin form to drive the generic scraper.
 */
export interface ScraperConfig {
  /** Display name of the perfume house, e.g. "Black Hearted Tart" */
  houseName: string

  /**
   * One collection/listing URL per entry.
   * The scraper visits each URL and collects product links.
   */
  collectionUrls: string[]

  /**
   * Optional sample product URL used to help identify/test selectors.
   * Not used by the scraper at runtime; kept for reference.
   */
  sampleProductUrl?: string

  /**
   * CSS selector that matches links to individual product pages on a collection page.
   * Example: 'a[href*="/products/"]'
   */
  productLinkSelector: string

  /**
   * CSS selector for the product name element on a product page.
   * Example: 'h1'
   */
  nameSelector: string

  /**
   * CSS selector for the product description element on a product page.
   * Example: '.product__description.rte'
   */
  descriptionSelector: string

  /**
   * Optional. CSS selector for the element containing fragrance notes.
   * If blank, description selector text is used for note extraction.
   */
  notesSelector?: string

  /**
   * CSS selector for the main product image element on a product page.
   * The scraper will look for an <img src> or background-image style attribute.
   * Example: '.product-media-modal__content img'
   */
  imageSelector: string

  /**
   * Keywords to skip a product by name (case-insensitive).
   * Example: ["set", "sample", "sampler", "collection"]
   */
  skipKeywords: string[]

  /**
   * When true (default), products whose names contain a size measurement (e.g. "100ml", "1.7 fl oz")
   * are skipped outright. Disable this when a site puts sizes in ALL product names — the scraper will
   * collect everything and deduplicate by cleaned name instead, preferring the bare-name listing when
   * both a sized and an unsized variant exist for the same product.
   */
  skipSizeVariants?: boolean

  /**
   * Base URL used to normalise relative image and product links.
   * Example: "https://blackheartedtart.com"
   */
  baseUrl?: string

  /**
   * How to trim the product name at the first of: spaced hyphen ` - `, Unicode en/em dash (`–` `—`), other hyphen-like characters, `~`, `.`, or `|` (whitespace around the character is optional).
   * - `before` — keep only text before that delimiter (e.g. "Velvet Vanilla - 50ml" → "Velvet Vanilla").
   * - `after` — keep only text after that delimiter (e.g. "Brand - Night Rose" → "Night Rose").
   * - `none` — keep the full title.
   */
  titleDashSegment?: TitleDashSegment

  /**
   * @deprecated Prefer `titleDashSegment`. When `titleDashSegment` is omitted, `true` means the same as `titleDashSegment: "before"`.
   */
  titleTakeBeforeDash?: boolean

  /**
   * How to trim the product name at the first colon `:` (common "Title: subtitle" format).
   * - `before` — keep only text before the first `:`.
   * - `after` — keep only text after the first `:`.
   * - `none` — keep the full title.
   */
  titleColonSegment?: TitleDashSegment

  /**
   * If true, keep only text after the first comma in the product name.
   * Applied independently of other delimiter settings.
   */
  titleTakeAfterFirstComma?: boolean

  /**
   * If true, keep only text before the first comma in the product name.
   * Applied independently of other delimiter settings.
   */
  titleTakeBeforeFirstComma?: boolean

  /**
   * If true, remove numbers and size patterns (e.g. 30ml, 1.7 fl oz) from product names.
   */
  titleStripNumbers?: boolean

  /**
   * Words or phrases to strip from product names (case-insensitive).
   * e.g. ["eau de toilette", "edp", "travel size"] so "Vanilla Eau de Toilette" → "Vanilla".
   */
  titleOmitWords?: string[]

  /**
   * If true, generate film noir themed descriptions from notes + original description (unique, sexy, mysterious).
   * If false, use the original description with extracted notes removed from the text.
   */
  generateNoirDescriptions?: boolean

  /**
   * When true (default for admin scraper runs), if scraped description + notesText lack a merchant note list,
   * the Node pipeline fetches the product URL once and scans HTML for "Featured notes:" / similar blocks.
   * Disable for offline tests or air-gapped runs.
   */
  fetchPdpNoteBootstrap?: boolean

  /**
   * For Etsy only: open a visible browser window so you can solve CAPTCHA if Etsy shows it.
   * Use when running locally (e.g. npm run dev). Leave unchecked when running on a server.
   */
  etsyHeaded?: boolean

  /**
   * Open a visible browser window for any site (e.g. thoo.it returns 403 in headless).
   * Use when a site blocks headless Chrome. Run locally; leave unchecked on a server.
   */
  headed?: boolean

  /**
   * Optional delay in ms between loading each collection URL. Use for sites that reset connections
   * (e.g. ERR_CONNECTION_RESET on Lush) to avoid rate limiting or bot detection. Example: 5000.
   */
  delayBetweenUrlsMs?: number

  /**
   * Optional number of retries per page load when the connection is reset or the page fails to load.
   * Implement in run_scraper.py with backoff. Example: 3.
   */
  retryAttempts?: number

  /**
   * Note extraction: `standard` (default) may infer notes from product name / encyclopedia fallback when the page has none.
   * `strict` only keeps notes grounded in scraped text (regex + PDP bootstrap); may leave notes empty.
   */
  noteInferenceMode?: NoteInferenceMode

  /**
   * Minimum count of items in a merchant flat note list (Featured notes, etc.) to treat as authoritative
   * and skip LLM merge. Default 2. Raise only if a house’s short lists are unreliable.
   */
  minConfidentFlatNotes?: number

  /**
   * OpenAI model id for extraction / merge / translate (default from env `OPENAI_NOTES_PIPELINE_MODEL` or `gpt-4o-mini`).
   * Must be in the server allowlist when set.
   */
  notesPipelineModel?: string

  /**
   * OpenAI model id for noir description generation (default from env `OPENAI_NOTES_PIPELINE_NOIR_MODEL` or same as extraction).
   */
  noirPipelineModel?: string

  /**
   * Post-extraction validation. `llm` (default) runs a single bulk classification call over the union of
   * every product's extracted notes, dropping prose/marketing fragments that survive the regex filter
   * (e.g. "a sweet", "glowing amber warmth", "sunlit burst of melon"). `off` disables it.
   * Env override: `NOTES_PIPELINE_VALIDATION` ("llm" | "off").
   */
  noteValidationMode?: NoteValidationMode
}

/**
 * Raw item emitted by the Python scraper.
 * When the Python notes pipeline is active it also sets openNotes/heartNotes/baseNotes
 * so the Node.js pipeline can be skipped entirely.
 */
export interface ScrapedItem {
  name: string
  description: string
  /** When notesSelector is set, text scraped from that element for note extraction; otherwise description is used. */
  notesText?: string
  image: string
  detailURL: string
  perfumeHouse?: string
  /** Pre-extracted top notes from the Python pipeline (skips Node.js LangGraph pipeline when present). */
  openNotes?: string[]
  /** Pre-extracted heart notes from the Python pipeline. */
  heartNotes?: string[]
  /** Pre-extracted base notes from the Python pipeline. */
  baseNotes?: string[]
  /** Evocative noir description generated by the Python pipeline. */
  noirDescription?: string
  /** Provenance tag from the Python pipeline (e.g. "html_heading_layers", "llm"). */
  _noteSource?: string
}

/**
 * A single CSV-row record after note extraction.
 * Matches the column format expected by scripts/import-csv.ts.
 */
export interface PerfumeCsvRecord {
  name: string
  description: string
  image: string
  perfumeHouse: string
  /** JSON-serialised string array, e.g. '["vanilla","rose"]' */
  openNotes: string
  /** JSON-serialised string array */
  heartNotes: string
  /** JSON-serialised string array */
  baseNotes: string
  detailURL: string
  /** Admin preview only — how notes were derived; omitted before DB import. */
  _noteSource?: ScraperNoteSource
}

// ---------------------------------------------------------------------------
// Step 1: Run scraper + note extraction
// ---------------------------------------------------------------------------

/** Body accepted by POST /api/admin/scraper/run */
/** Optional `_csrf` matches cookie for double-submit when `x-csrf-token` is stripped by a proxy. */
export type ScraperRunRequest = ScraperConfig & { _csrf?: string }

/** Response from POST /api/admin/scraper/run */
export interface ScraperRunResponse {
  ok: boolean
  scrapedCount: number
  /** Extracted records — available for preview and passed to the import step */
  records: PerfumeCsvRecord[]
  /** Full CSV text, ready for download */
  csvContent: string
  errors: string[]
  /** Python scraper stderr output (helps debug when 0 products or failures) */
  scraperLog?: string
  /** Post-run warnings (e.g. batch note uniformity / possible LLM drift). */
  batchWarnings?: string[]
}

// ---------------------------------------------------------------------------
// Step 2: Confirm & import to database
// ---------------------------------------------------------------------------

/** Body accepted by POST /api/admin/scraper/import */
export interface ScraperImportRequest {
  records: PerfumeCsvRecord[]
  uploadImagesToR2: boolean
  /** When false, do not overwrite existing image URLs in the DB (only set image for new records or when current image is empty). Default true. */
  overwriteImageUrls?: boolean
  /** Same value as `_csrf` cookie when `x-csrf-token` header cannot be sent. */
  _csrf?: string
}

/** Response from POST /api/admin/scraper/import */
export interface ScraperImportResponse {
  ok: boolean
  importedCount: number
  r2UploadCount: number
  errors: string[]
  /** Names of perfumes whose R2 upload failed during import (for retry UI). */
  failedR2Names?: string[]
}

/** Body accepted by POST /api/admin/scraper/retry-r2 */
export interface ScraperRetryR2Request {
  records: PerfumeCsvRecord[]
  _csrf?: string
}

/** Response from POST /api/admin/scraper/retry-r2 */
export interface ScraperRetryR2Response {
  ok: boolean
  attemptedCount: number
  uploadedCount: number
  skippedCount: number
  errors: string[]
  failedR2Names?: string[]
}
