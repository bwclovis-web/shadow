import type { ChangeEvent } from "react"

import { Button } from "@/components/Atoms/Button/Button"
import type { PerfumeCsvRecord } from "@/types/scraper"

export type ImportPanelProps = {
  allRecords: PerfumeCsvRecord[]
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
}

export const ImportPanel = ({
  allRecords,
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
}: ImportPanelProps) => (
  <div className="rounded-lg border border-border bg-noir-dark p-4 text-noir-gold-100 border-noir-gold">
    <h3 className="mb-1 text-base font-semibold">Import to database</h3>
    <p className="mb-4 text-sm text-muted-foreground">
      Review the products above, then confirm to write them to the database. This will create or
      update Perfume and PerfumeHouse records.
    </p>

    <label className="mb-3 flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={overwriteImageUrls}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setOverwriteImageUrls(e.target.checked)}
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">Overwrite existing image URLs</span>
        <span className="text-xs text-muted-foreground">
          When on, import replaces current image URLs with scraped ones. When off, existing images are
          left unchanged (new records still get scraped images).
        </span>
      </span>
    </label>

    <label className="mb-4 flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={uploadImagesToR2}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setUploadImagesToR2(e.target.checked)}
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">Upload images to R2</span>
        <span className="text-xs text-muted-foreground">
          Upload all imported images to your R2 bucket and update DB URLs. Images already on R2 are
          skipped automatically. Keep this on to ensure every perfume is served from your own CDN.
        </span>
      </span>
    </label>

    <label className="mb-4 flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={allowHighDuplicateRisk}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setAllowHighDuplicateRisk(e.target.checked)}
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">Import possible duplicates</span>
        <span className="text-xs text-muted-foreground">
          When off, rows flagged with high duplicate risk are skipped during import.
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
        Confirm import ({allRecords.length} products)
      </Button>
    ) : (
      <div className="flex items-center gap-3">
        <p className="text-sm font-medium">
          Are you sure? This will write {allRecords.length} records to the database.
        </p>
        <Button type="button" variant="primary" onClick={onImport} disabled={importing}>
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
)
