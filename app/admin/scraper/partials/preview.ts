import type {
  ImportBucket,
  NoteConfidence,
  PerfumeCsvRecord,
  ScraperNoteSource,
} from "@/types/scraper"

export type PreviewFilter =
  | "all"
  | "empty_notes"
  | "low_confidence"
  | "missing_image"
  | "duplicate_risk"
  | "needs_review"

export type PreviewRow = {
  name: string
  notesPreview: string[]
  noteSource?: ScraperNoteSource
  noteConfidence?: NoteConfidence
  importBucket?: ImportBucket
  duplicateRisk?: string
  detailURL?: string
}

export const noteSourceBadgeClass = (source?: ScraperNoteSource): string => {
  switch (source) {
    case "labeled_list":
      return "bg-emerald-900/50 text-emerald-100"
    case "pdp_bootstrap":
      return "bg-cyan-900/50 text-cyan-100"
    case "llm_description":
      return "bg-blue-900/50 text-blue-100"
    case "llm_name_literal":
      return "bg-violet-900/50 text-violet-100"
    case "llm_name_inferred":
      return "bg-amber-900/50 text-amber-100"
    case "empty":
      return "bg-neutral-800 text-neutral-400"
    default:
      return "bg-neutral-800 text-neutral-400"
  }
}

const recordHasNotes = (r: PerfumeCsvRecord): boolean => {
  try {
    return (JSON.parse(r.openNotes ?? "[]") as string[]).length > 0
  } catch {
    return false
  }
}

export const filterRecords = (
  records: PerfumeCsvRecord[],
  filter: PreviewFilter,
): PerfumeCsvRecord[] => {
  switch (filter) {
    case "empty_notes":
      return records.filter(r => !recordHasNotes(r))
    case "low_confidence":
      return records.filter(r => r.noteConfidence === "low")
    case "missing_image":
      return records.filter(r => !r.image?.trim())
    case "duplicate_risk":
      return records.filter(r => r.duplicateRisk === "high" || r.duplicateRisk === "low")
    case "needs_review":
      return records.filter(r => r.importBucket === "needs_review" || r.importBucket === "skip")
    default:
      return records
  }
}

export const buildPreviewRows = (records: PerfumeCsvRecord[]): PreviewRow[] =>
  records.map(r => {
    let notesPreview: string[] = []
    try {
      notesPreview = (JSON.parse(r.openNotes) as string[]).slice(0, 4)
    } catch {
      notesPreview = []
    }
    return {
      name: r.name,
      notesPreview,
      noteSource: r._noteSource,
      noteConfidence: r.noteConfidence,
      importBucket: r.importBucket,
      duplicateRisk: r.duplicateRisk,
      detailURL: r.detailURL,
    }
  })
