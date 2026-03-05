"use client"

import { type ChangeEvent, type FormEvent, useEffect, useState } from "react"

import { Button } from "@/components/Atoms/Button/Button"
import HouseTypeahead from "@/components/Molecules/HouseTypeahead/HouseTypeahead"
import type {
  PerfumeCsvRecord,
  ScraperImportResponse,
  ScraperRunRequest,
  ScraperRunResponse,
} from "@/types/scraper"

// ---------------------------------------------------------------------------
// Shopify defaults
// ---------------------------------------------------------------------------
const SHOPIFY_DEFAULTS = {
  productLinkSelector: "a[href*='/products/']",
  nameSelector: "h1",
  descriptionSelector: ".product__description",
  imageSelector: ".product__media img",
}

// ---------------------------------------------------------------------------
// Small layout helpers
// ---------------------------------------------------------------------------
interface FieldProps {
  label: string
  hint?: string
  children: React.ReactNode
}

function Field({ label, hint, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  )
}

function inputClass(extra = "") {
  return `w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 ${extra}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ScraperPageClient() {
  // -- scraper config state --
  const [houseName, setHouseName] = useState("")
  const [collectionUrlsRaw, setCollectionUrlsRaw] = useState("")
  const [sampleProductUrl, setSampleProductUrl] = useState("")
  const [productLinkSelector, setProductLinkSelector] = useState(
    SHOPIFY_DEFAULTS.productLinkSelector,
  )
  const [nameSelector, setNameSelector] = useState(SHOPIFY_DEFAULTS.nameSelector)
  const [descriptionSelector, setDescriptionSelector] = useState(
    SHOPIFY_DEFAULTS.descriptionSelector,
  )
  const [imageSelector, setImageSelector] = useState(SHOPIFY_DEFAULTS.imageSelector)
  const [skipKeywordsRaw, setSkipKeywordsRaw] = useState(
    "set, sample, sampler, collection, collections",
  )
  const [baseUrl, setBaseUrl] = useState("")
  const [titleTakeBeforeDash, setTitleTakeBeforeDash] = useState(true)
  const [titleStripNumbers, setTitleStripNumbers] = useState(true)
  const [generateNoirDescriptions, setGenerateNoirDescriptions] = useState(true)

  // -- step 1 state (scrape + note extraction) --
  const [scraping, setScraping] = useState(false)
  const [scrapeElapsedSeconds, setScrapeElapsedSeconds] = useState(0)
  const [scrapeResult, setScrapeResult] = useState<ScraperRunResponse | null>(null)
  const [scrapeError, setScrapeError] = useState<string | null>(null)

  // Show elapsed time while scraper is running
  useEffect(() => {
    if (!scraping) {
      setScrapeElapsedSeconds(0)
      return
    }
    const start = Date.now()
    const interval = setInterval(() => {
      setScrapeElapsedSeconds(Math.floor((Date.now() - start) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [scraping])

  // -- step 2 state (import + R2) --
  const [uploadImagesToR2, setUploadImagesToR2] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ScraperImportResponse | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importConfirmed, setImportConfirmed] = useState(false)

  // ---------------------------------------------------------------------------
  // Step 1: Run scraper
  // ---------------------------------------------------------------------------
  const handleScrape = async (e: FormEvent) => {
    e.preventDefault()
    if (!houseName.trim()) {
      setScrapeError("Please enter or select a house name.")
      return
    }

    setScraping(true)
    setScrapeResult(null)
    setScrapeError(null)
    setImportResult(null)
    setImportError(null)
    setImportConfirmed(false)

    const collectionUrls = collectionUrlsRaw
      .split("\n")
      .map(u => u.trim())
      .filter(Boolean)

    const skipKeywords = skipKeywordsRaw
      .split(",")
      .map(k => k.trim())
      .filter(Boolean)

    const body: ScraperRunRequest = {
      houseName,
      collectionUrls,
      sampleProductUrl: sampleProductUrl || undefined,
      productLinkSelector,
      nameSelector,
      descriptionSelector,
      imageSelector,
      skipKeywords,
      baseUrl: baseUrl || undefined,
      titleTakeBeforeDash,
      titleStripNumbers,
      generateNoirDescriptions,
    }

    try {
      const res = await fetch("/api/admin/scraper/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as ScraperRunResponse

      if (!res.ok || !data.ok) {
        setScrapeError(data.errors?.join("\n") ?? `Server error ${res.status}`)
      } else {
        setScrapeResult(data)
      }
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setScraping(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Step 2: Confirm & import
  // ---------------------------------------------------------------------------
  const handleImport = async () => {
    if (!scrapeResult?.records?.length) return

    setImporting(true)
    setImportResult(null)
    setImportError(null)

    try {
      const res = await fetch("/api/admin/scraper/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          records: scrapeResult.records,
          uploadImagesToR2,
        }),
      })
      const data = (await res.json()) as ScraperImportResponse

      if (!res.ok || !data.ok) {
        setImportError(data.errors?.join("\n") ?? `Server error ${res.status}`)
      } else {
        setImportResult(data)
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setImporting(false)
      setImportConfirmed(false)
    }
  }

  // ---------------------------------------------------------------------------
  // CSV download
  // ---------------------------------------------------------------------------
  const handleDownloadCsv = () => {
    if (!scrapeResult?.csvContent) return
    const slug = houseName.toLowerCase().replace(/\s+/g, "-")
    const blob = new Blob([scrapeResult.csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `perfumes_${slug}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const records: PerfumeCsvRecord[] = scrapeResult?.records ?? []

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">House Scraper</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure and run the scraper to collect products and extract notes. After reviewing the
          results you can confirm to import them into the database.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Step 1: Scraper configuration form                                  */}
      {/* ------------------------------------------------------------------ */}
      <form onSubmit={handleScrape} className="flex flex-col gap-6">
        {/* House */}
        <section className="flex flex-col gap-4 rounded-lg border border-noir-border p-4 bg-noir-dark border-noir-gold text-noir-gold-100">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            House
          </h2>

          <Field label="House name *" hint="Search for an existing house or type a new one.">
            <HouseTypeahead
              name="_houseId"
              defaultName={houseName}
              onNameChange={setHouseName}
            />
          </Field>

          <Field
            label="Collection URLs *"
            hint="One URL per line — the listing pages that contain links to individual products."
          >
            <textarea
              className={inputClass("min-h-[100px] resize-y font-mono text-xs")}
              required
              value={collectionUrlsRaw}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setCollectionUrlsRaw(e.target.value)
              }
              placeholder={
                "https://blackheartedtart.com/collections/perfumes\nhttps://blackheartedtart.com/collections/perfumes?page=2"
              }
            />
          </Field>

          <Field
            label="Sample product URL"
            hint="Optional: a single product page to reference when tuning selectors."
          >
            <input
              className={inputClass()}
              type="url"
              value={sampleProductUrl}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSampleProductUrl(e.target.value)}
              placeholder="https://blackheartedtart.com/products/50-ft-queenie"
            />
          </Field>

          <Field
            label="Base URL"
            hint="Used to convert relative links/images to absolute URLs. Usually the homepage."
          >
            <input
              className={inputClass()}
              type="url"
              value={baseUrl}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setBaseUrl(e.target.value)}
              placeholder="https://blackheartedtart.com"
            />
          </Field>
        </section>

        {/* Selectors */}
        <section className="flex flex-col gap-4 rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            CSS Selectors
          </h2>

          <Field
            label="Product link selector *"
            hint="Matches links to individual product pages on a collection page."
          >
            <input
              className={inputClass("font-mono text-xs")}
              required
              value={productLinkSelector}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setProductLinkSelector(e.target.value)
              }
            />
          </Field>

          <Field label="Product name selector *" hint="Element containing the product name.">
            <input
              className={inputClass("font-mono text-xs")}
              required
              value={nameSelector}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNameSelector(e.target.value)}
            />
          </Field>

          <Field
            label="Description selector *"
            hint="Element containing the product description."
          >
            <input
              className={inputClass("font-mono text-xs")}
              required
              value={descriptionSelector}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setDescriptionSelector(e.target.value)
              }
            />
          </Field>

          <Field
            label="Image selector *"
            hint="An img element or a container that holds the main product image."
          >
            <input
              className={inputClass("font-mono text-xs")}
              required
              value={imageSelector}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setImageSelector(e.target.value)}
            />
          </Field>
        </section>

        {/* Skip rules */}
        <section className="flex flex-col gap-4 rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Skip rules
          </h2>

          <Field
            label="Skip keywords"
            hint="Comma-separated. Products whose names contain any of these words are skipped. Size patterns (30ml, 3.4 fl oz, etc.) are always skipped automatically."
          >
            <input
              className={inputClass()}
              value={skipKeywordsRaw}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSkipKeywordsRaw(e.target.value)}
            />
          </Field>
        </section>

        {/* Title & description rules */}
        <section className="flex flex-col gap-4 rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Title & description
          </h2>
          <p className="text-xs text-muted-foreground">
            Clean product names and choose how descriptions are generated. Notes are always extracted;
            you can strip them from the source text and have LangGraph write new film noir themed copy.
          </p>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={titleTakeBeforeDash}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setTitleTakeBeforeDash(e.target.checked)
              }
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Take only text before first &quot; - &quot; in name</span>
              <span className="text-xs text-muted-foreground">
                e.g. &quot;Velvet Vanilla - 50ml&quot; → &quot;Velvet Vanilla&quot;
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={titleStripNumbers}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setTitleStripNumbers(e.target.checked)
              }
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Strip numbers and sizes from name</span>
              <span className="text-xs text-muted-foreground">
                Remove 30ml, 1.7 fl oz, etc. from product names.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={generateNoirDescriptions}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setGenerateNoirDescriptions(e.target.checked)
              }
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Generate film noir themed descriptions</span>
              <span className="text-xs text-muted-foreground">
                Use notes + original copy to write unique, sexy, mysterious descriptions. Uncheck to
                keep original text with note phrases removed.
              </span>
            </span>
          </label>
        </section>

        <Button type="submit" variant="primary" disabled={scraping}>
          {scraping ? "Running scraper…" : "Run scraper"}
        </Button>
      </form>

      {/* Running indicator */}
      {scraping && (
        <div className="mt-8 rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
          <p className="animate-pulse font-medium">
            Scraper is running — this may take several minutes for large houses…
          </p>
          <p className="mt-2 font-mono text-xs">
            Elapsed: {Math.floor(scrapeElapsedSeconds / 60)}m {scrapeElapsedSeconds % 60}s — results
            will appear when the full run finishes (no progress stream).
          </p>
          <p className="mt-2 text-xs">
            The headless browser visits each product page; LangGraph then extracts notes from every
            description.
          </p>
        </div>
      )}

      {/* Scrape error */}
      {scrapeError && (
        <div className="mt-8 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          <p className="font-semibold">Scraper error</p>
          <pre className="mt-1 whitespace-pre-wrap text-xs">{scrapeError}</pre>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Step 2: Review + confirm import (always show when we have a result)  */}
      {/* ------------------------------------------------------------------ */}
      {scrapeResult && (
        <div className="mt-8 flex flex-col gap-6">
          {/* Summary bar */}
          <div className="rounded-lg border border-border p-4">
            <h2 className="mb-3 text-lg font-semibold">Scrape results</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Products found</dt>
                <dd className="text-2xl font-bold">{scrapeResult.scrapedCount}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Notes extracted</dt>
                <dd className="text-2xl font-bold">
                  {records.filter(r => {
                    try {
                      return (JSON.parse(r.openNotes ?? "[]") as string[]).length > 0
                    } catch {
                      return false
                    }
                  }).length}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Scrape errors</dt>
                <dd
                  className={`text-2xl font-bold ${scrapeResult.errors.length > 0 ? "text-destructive" : ""}`}
                >
                  {scrapeResult.errors.length}
                </dd>
              </div>
            </dl>

            {scrapeResult.errors.length > 0 && (
              <div className="mt-3 rounded border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium">Messages</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
                  {scrapeResult.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            {scrapeResult.scraperLog && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                  Scraper log (Python stderr)
                </summary>
                <pre className="mt-2 max-h-48 overflow-y-auto rounded border border-border bg-muted/30 p-2 font-mono text-xs whitespace-pre-wrap">
                  {scrapeResult.scraperLog}
                </pre>
              </details>
            )}

            {records.length > 0 && (
              <Button
                variant="secondary"
                className="mt-4"
                onClick={handleDownloadCsv}
                type="button"
              >
                Download CSV
              </Button>
            )}
          </div>

          {records.length > 0 && (
            <div className="rounded-lg border border-border">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold">Products preview</h3>
                <span className="text-xs text-muted-foreground">{records.length} items</span>
              </div>
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Name</th>
                      <th className="px-4 py-2 font-medium">Open notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r, i) => {
                      const notes = (() => {
                        try {
                          return (JSON.parse(r.openNotes) as string[]).slice(0, 4)
                        } catch {
                          return []
                        }
                      })()
                      return (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="max-w-[200px] truncate px-4 py-2 font-medium">{r.name}</td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {notes.length > 0 ? notes.join(", ") : (
                              <span className="italic opacity-50">none extracted</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {records.length > 0 && !importResult && (
            <div className="rounded-lg border border-border p-4">
              <h3 className="mb-1 text-base font-semibold">Import to database</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Review the products above, then confirm to write them to the database.
                This will create or update Perfume and PerfumeHouse records.
              </p>

              <label className="mb-4 flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={uploadImagesToR2}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setUploadImagesToR2(e.target.checked)
                  }
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">Upload images to R2</span>
                  <span className="text-xs text-muted-foreground">
                    Download each product image and store it in Cloudflare R2 after importing.
                  </span>
                </span>
              </label>

              {!importConfirmed ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => setImportConfirmed(true)}
                  disabled={importing}
                >
                  Confirm import ({records.length} products)
                </Button>
              ) : (
                <div className="flex items-center gap-3">
                  <p className="text-sm font-medium">
                    Are you sure? This will write {records.length} records to the database.
                  </p>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleImport}
                    disabled={importing}
                  >
                    {importing ? "Importing…" : "Yes, import"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setImportConfirmed(false)}
                    disabled={importing}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Import error */}
          {importError && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
              <p className="font-semibold">Import error</p>
              <pre className="mt-1 whitespace-pre-wrap text-xs">{importError}</pre>
            </div>
          )}

          {/* Import success */}
          {importResult && (
            <div className="rounded-lg border border-border p-4">
              <h3 className="mb-3 text-base font-semibold">Import complete</h3>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Imported</dt>
                  <dd className="text-2xl font-bold">{importResult.importedCount}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">R2 uploads</dt>
                  <dd className="text-2xl font-bold">{importResult.r2UploadCount}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Errors</dt>
                  <dd
                    className={`text-2xl font-bold ${importResult.errors.length > 0 ? "text-destructive" : ""}`}
                  >
                    {importResult.errors.length}
                  </dd>
                </div>
              </dl>

              {importResult.errors.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Show import errors
                  </summary>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-destructive">
                    {importResult.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
