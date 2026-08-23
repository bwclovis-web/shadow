import { Button } from "@/components/Atoms/Button/Button"

export type ScraperRunningIndicatorProps = {
  scrapeElapsedSeconds: number
  scrapeProgressLog: string[]
  onCancelScrape: () => void
  jobId?: string | null
}

export const ScraperRunningIndicator = ({
  scrapeElapsedSeconds,
  scrapeProgressLog,
  onCancelScrape,
  jobId,
}: ScraperRunningIndicatorProps) => (
  <div className="mt-8 rounded-lg border p-6 bg-noir-dark border-noir-gold text-noir-gold-100">
    <p className="animate-pulse text-center text-sm font-medium">
      Scraper is running — this may take several minutes for large houses…
    </p>
    <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
      <p className="font-mono text-xs text-muted-foreground">
        Elapsed: {Math.floor(scrapeElapsedSeconds / 60)}m {scrapeElapsedSeconds % 60}s
      </p>
      {jobId ? (
        <p className="font-mono text-xs text-muted-foreground">Job: {jobId}</p>
      ) : null}
      <Button type="button" variant="secondary" size="sm" onClick={onCancelScrape}>
        Cancel scrape
      </Button>
    </div>
    {scrapeProgressLog.length > 0 && (
      <div className="mt-4 rounded border border-border bg-black/30 p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Progress</p>
        <pre className="max-h-48 overflow-y-auto font-mono text-xs whitespace-pre-wrap break-words">
          {scrapeProgressLog.join("\n")}
        </pre>
      </div>
    )}
    <p className="mt-3 text-center text-xs font-medium text-amber-600 dark:text-amber-400">
      Jobs are durable — you can leave this tab; keep `npm run scraper:worker` running for
      long scrapes. Cancel preserves partial results on the job.
    </p>
  </div>
)
