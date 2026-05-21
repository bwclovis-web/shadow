import { Button } from "@/components/Atoms/Button/Button"
import type { PerfumeCsvRecord, ScraperRunResponse } from "@/types/scraper"

export type ScrapeResultsSummaryProps = {
  scrapeResult: ScraperRunResponse
  notesExtractedCount: number
  allRecords: PerfumeCsvRecord[]
  onDownloadCsv: () => void
}

export const ScrapeResultsSummary = ({
  scrapeResult,
  notesExtractedCount,
  allRecords,
  onDownloadCsv,
}: ScrapeResultsSummaryProps) => (
  <div className="rounded-lg border border-border bg-noir-dark p-4 text-noir-gold-100 border-noir-gold">
    <h2 className="mb-3 text-lg font-semibold">Scrape results</h2>
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
      <div>
        <dt className="text-muted-foreground">Products found</dt>
        <dd className="text-2xl font-bold text-noir-gold-500">{scrapeResult.scrapedCount}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Notes extracted</dt>
        <dd className="text-2xl font-bold text-noir-gold-500">{notesExtractedCount}</dd>
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

    {scrapeResult.batchWarnings && scrapeResult.batchWarnings.length > 0 && (
      <div className="mt-3 rounded border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
        <p className="font-medium">Batch warnings</p>
        <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
          {scrapeResult.batchWarnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      </div>
    )}

    {scrapeResult.scraperLog && (
      <details className="mt-3" open={scrapeResult.scrapedCount === 0}>
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
          Scraper log (Python stderr)
          {scrapeResult.scrapedCount === 0 && (
            <span className="ml-2 text-amber-600 dark:text-amber-400">
              (expanded — no products found, check log for why)
            </span>
          )}
        </summary>
        <pre className="mt-2 max-h-48 overflow-y-auto rounded border border-border bg-muted/30 p-2 font-mono text-xs whitespace-pre-wrap">
          {scrapeResult.scraperLog}
        </pre>
      </details>
    )}

    {allRecords.length > 0 && (
      <Button variant="secondary" className="mt-4" onClick={onDownloadCsv} type="button">
        Download CSV
      </Button>
    )}
  </div>
)
