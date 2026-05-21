import type { ChangeEvent } from "react"

import type { PerfumeCsvRecord } from "@/types/scraper"

import { noteSourceBadgeClass, type PreviewFilter, type PreviewRow } from "./preview"

export type ProductsPreviewTableProps = {
  allRecords: PerfumeCsvRecord[]
  records: PerfumeCsvRecord[]
  previewFilter: PreviewFilter
  setPreviewFilter: (v: PreviewFilter) => void
  previewRows: PreviewRow[]
}

export const ProductsPreviewTable = ({
  allRecords,
  records,
  previewFilter,
  setPreviewFilter,
  previewRows,
}: ProductsPreviewTableProps) => (
  <div className="rounded-lg border border-border bg-noir-dark text-noir-gold-100 border-noir-gold">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
      <h3 className="text-sm font-semibold">Products preview</h3>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="rounded border border-input bg-background px-2 py-1 text-xs"
          value={previewFilter}
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            setPreviewFilter(e.target.value as PreviewFilter)
          }
        >
          <option value="all">All ({allRecords.length})</option>
          <option value="empty_notes">Empty notes</option>
          <option value="low_confidence">Low note confidence</option>
          <option value="missing_image">Missing image</option>
          <option value="duplicate_risk">Duplicate risk</option>
          <option value="needs_review">Needs review / skip</option>
        </select>
        <span className="text-xs text-muted-foreground">
          Showing {records.length} of {allRecords.length}
        </span>
      </div>
    </div>
    <div className="max-h-72 overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-background">
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Conf.</th>
            <th className="px-4 py-2 font-medium">Bucket</th>
            <th className="px-4 py-2 font-medium">Dup.</th>
            <th className="px-4 py-2 font-medium">Open notes</th>
          </tr>
        </thead>
        <tbody>
          {previewRows.map((row, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              <td className="max-w-[160px] truncate px-4 py-2 font-medium">
                {row.detailURL ? (
                  <a
                    href={row.detailURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-primary"
                  >
                    {row.name}
                  </a>
                ) : (
                  row.name
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-2">
                <span
                  className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${noteSourceBadgeClass(row.noteSource)}`}
                >
                  {row.noteConfidence ?? row.noteSource ?? "—"}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                {row.importBucket ?? "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                {row.duplicateRisk && row.duplicateRisk !== "none" ? row.duplicateRisk : "—"}
              </td>
              <td className="px-4 py-2 text-muted-foreground">
                {row.notesPreview.length > 0 ? (
                  row.notesPreview.join(", ")
                ) : (
                  <span className="italic opacity-50">none extracted</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)
