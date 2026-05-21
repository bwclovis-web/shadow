import type { PerfumeCsvRecord, ScraperImportResponse, ScraperRetryR2Response, ScraperRunResponse } from "@/types/scraper"

import { ImportCompletePanel } from "./ImportCompletePanel"
import { ImportPanel } from "./ImportPanel"
import { ProductsPreviewTable } from "./ProductsPreviewTable"
import type { PreviewFilter, PreviewRow } from "./preview"
import { ScrapeResultsSummary } from "./ScrapeResultsSummary"

export type ScrapeResultsPanelProps = {
  scrapeResult: ScraperRunResponse
  notesExtractedCount: number
  allRecords: PerfumeCsvRecord[]
  records: PerfumeCsvRecord[]
  previewFilter: PreviewFilter
  setPreviewFilter: (v: PreviewFilter) => void
  previewRows: PreviewRow[]
  onDownloadCsv: () => void
  importResult: ScraperImportResponse | null
  importError: string | null
  overwriteImageUrls: boolean
  setOverwriteImageUrls: (v: boolean) => void
  uploadImagesToR2: boolean
  setUploadImagesToR2: (v: boolean) => void
  allowHighDuplicateRisk: boolean
  setAllowHighDuplicateRisk: (v: boolean) => void
  importConfirmed: boolean
  setImportConfirmed: (v: boolean) => void
  importing: boolean
  onImport: () => void
  retryingR2: boolean
  retryR2Error: string | null
  retryR2Result: ScraperRetryR2Response | null
  onRetryR2Uploads: () => void
}

export const ScrapeResultsPanel = ({
  scrapeResult,
  notesExtractedCount,
  allRecords,
  records,
  previewFilter,
  setPreviewFilter,
  previewRows,
  onDownloadCsv,
  importResult,
  importError,
  overwriteImageUrls,
  setOverwriteImageUrls,
  uploadImagesToR2,
  setUploadImagesToR2,
  allowHighDuplicateRisk,
  setAllowHighDuplicateRisk,
  importConfirmed,
  setImportConfirmed,
  importing,
  onImport,
  retryingR2,
  retryR2Error,
  retryR2Result,
  onRetryR2Uploads,
}: ScrapeResultsPanelProps) => (
  <div className="mt-8 flex flex-col gap-6">
    <ScrapeResultsSummary
      scrapeResult={scrapeResult}
      notesExtractedCount={notesExtractedCount}
      allRecords={allRecords}
      onDownloadCsv={onDownloadCsv}
    />

    {allRecords.length > 0 && (
      <ProductsPreviewTable
        allRecords={allRecords}
        records={records}
        previewFilter={previewFilter}
        setPreviewFilter={setPreviewFilter}
        previewRows={previewRows}
      />
    )}

    {allRecords.length > 0 && !importResult && (
      <ImportPanel
        allRecords={allRecords}
        overwriteImageUrls={overwriteImageUrls}
        setOverwriteImageUrls={setOverwriteImageUrls}
        uploadImagesToR2={uploadImagesToR2}
        setUploadImagesToR2={setUploadImagesToR2}
        allowHighDuplicateRisk={allowHighDuplicateRisk}
        setAllowHighDuplicateRisk={setAllowHighDuplicateRisk}
        importConfirmed={importConfirmed}
        setImportConfirmed={setImportConfirmed}
        importing={importing}
        onImport={onImport}
      />
    )}

    {importError && (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
        <p className="font-semibold">Import error</p>
        <pre className="mt-1 whitespace-pre-wrap text-xs">{importError}</pre>
      </div>
    )}

    {importResult && (
      <ImportCompletePanel
        importResult={importResult}
        uploadImagesToR2={uploadImagesToR2}
        scrapeResult={scrapeResult}
        retryingR2={retryingR2}
        importing={importing}
        retryR2Error={retryR2Error}
        retryR2Result={retryR2Result}
        onRetryR2Uploads={onRetryR2Uploads}
      />
    )}
  </div>
)
