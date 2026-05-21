import { Button } from "@/components/Atoms/Button/Button"
import type { ScraperImportResponse, ScraperRetryR2Response, ScraperRunResponse } from "@/types/scraper"

export type ImportCompletePanelProps = {
  importResult: ScraperImportResponse
  uploadImagesToR2: boolean
  scrapeResult: ScraperRunResponse | null
  retryingR2: boolean
  importing: boolean
  retryR2Error: string | null
  retryR2Result: ScraperRetryR2Response | null
  onRetryR2Uploads: () => void
}

export const ImportCompletePanel = ({
  importResult,
  uploadImagesToR2,
  scrapeResult,
  retryingR2,
  importing,
  retryR2Error,
  retryR2Result,
  onRetryR2Uploads,
}: ImportCompletePanelProps) => (
  <div className="rounded-lg border border-border bg-noir-dark p-4 text-noir-gold-100 border-noir-gold">
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
        <summary className="cursor-pointer text-xs text-muted-foreground">Show import errors</summary>
        <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-destructive">
          {importResult.errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      </details>
    )}

    {uploadImagesToR2 && (
      <div className="mt-4 rounded-md border border-border/70 bg-background/30 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-muted-foreground">
            If some image hosts returned 403, retry R2 uploads without re-importing notes/data.
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={onRetryR2Uploads}
            disabled={retryingR2 || importing || !scrapeResult?.records?.length}
          >
            {retryingR2 ? "Retrying R2 uploads..." : "Retry failed R2 uploads"}
          </Button>
        </div>

        {retryR2Error && (
          <pre className="mt-2 whitespace-pre-wrap text-xs text-destructive">{retryR2Error}</pre>
        )}

        {retryR2Result && (
          <div className="mt-2 text-xs text-foreground">
            Retried {retryR2Result.attemptedCount} images: {retryR2Result.uploadedCount} uploaded,{" "}
            {retryR2Result.skippedCount} skipped, {retryR2Result.errors.length} errors.
          </div>
        )}
      </div>
    )}
  </div>
)
