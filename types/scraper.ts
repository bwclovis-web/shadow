/**
 * Types for the perfume-house scraper configuration and results.
 * Used by the admin form, API routes, and LangGraph note-extraction pipeline.
 */

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
   * Base URL used to normalise relative image and product links.
   * Example: "https://blackheartedtart.com"
   */
  baseUrl?: string
}

/**
 * Raw item emitted by the Python scraper (no note extraction yet).
 */
export interface ScrapedItem {
  name: string
  description: string
  image: string
  detailURL: string
  perfumeHouse?: string
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
}

// ---------------------------------------------------------------------------
// Step 1: Run scraper + note extraction
// ---------------------------------------------------------------------------

/** Body accepted by POST /api/admin/scraper/run */
export type ScraperRunRequest = ScraperConfig

/** Response from POST /api/admin/scraper/run */
export interface ScraperRunResponse {
  ok: boolean
  scrapedCount: number
  /** Extracted records — available for preview and passed to the import step */
  records: PerfumeCsvRecord[]
  /** Full CSV text, ready for download */
  csvContent: string
  errors: string[]
}

// ---------------------------------------------------------------------------
// Step 2: Confirm & import to database
// ---------------------------------------------------------------------------

/** Body accepted by POST /api/admin/scraper/import */
export interface ScraperImportRequest {
  records: PerfumeCsvRecord[]
  uploadImagesToR2: boolean
}

/** Response from POST /api/admin/scraper/import */
export interface ScraperImportResponse {
  ok: boolean
  importedCount: number
  r2UploadCount: number
  errors: string[]
}
