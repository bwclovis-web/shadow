import type {
  ExternalNoteCandidate,
  ImportBucket,
  NoteConfidence,
  PerfumeCsvRecord,
} from "@/types/scraper"

export type UserImportRow = {
  name: string
  perfumeHouse: string
  description?: string
  image?: string
  detailURL?: string
  openNotes?: string[]
  heartNotes?: string[]
  baseNotes?: string[]
  source?: "csv" | "fragrantica" | "parfumo" | "user"
}

const hasNotes = (row: UserImportRow): boolean =>
  Boolean(
    (row.openNotes?.length ?? 0) +
      (row.heartNotes?.length ?? 0) +
      (row.baseNotes?.length ?? 0),
  )

/** Score user-provided rows with the same preview buckets as the Python quality gate. */
export const scoreUserImportRow = (row: UserImportRow): {
  qualityScore: number
  qualityIssues: string[]
  importBucket: ImportBucket
  noteConfidence: NoteConfidence
} => {
  let score = 0
  const issues: string[] = []

  if (row.name?.trim()) score += 15
  else issues.push("missing_name")
  if (row.perfumeHouse?.trim()) score += 10
  else issues.push("missing_house")
  if (row.image?.trim()) score += 15
  else issues.push("missing_image")
  if (row.description?.trim()) score += 10
  else issues.push("missing_description")
  if (hasNotes(row)) score += 25
  else issues.push("missing_notes")
  if (row.detailURL?.trim()) score += 10
  else issues.push("missing_detail_url")

  const noteConfidence: NoteConfidence = hasNotes(row) ? "medium" : "low"
  if (hasNotes(row)) score += 8

  let importBucket: ImportBucket = "ready"
  if (score < 50 || issues.includes("missing_name")) importBucket = "skip"
  else if (score < 75 || issues.includes("missing_notes")) importBucket = "needs_review"

  return { qualityScore: score, qualityIssues: issues, importBucket, noteConfidence }
}

/** Convert user CSV / collection import rows into scraper preview records. */
export const userImportRowsToPreviewRecords = (
  rows: UserImportRow[],
): PerfumeCsvRecord[] =>
  rows.map(row => {
    const scored = scoreUserImportRow(row)
    const externalNoteCandidates: ExternalNoteCandidate[] | undefined =
      row.source === "fragrantica" || row.source === "parfumo"
        ? [
            {
              source: row.source,
              sourceUrl: row.detailURL ?? "",
              openNotes: row.openNotes ?? [],
              heartNotes: row.heartNotes ?? [],
              baseNotes: row.baseNotes ?? [],
              confidence: "low",
              warnings: ["user_import_requires_review"],
            },
          ]
        : undefined

    return {
      name: row.name.trim(),
      description: row.description?.trim() ?? "",
      image: row.image?.trim() ?? "",
      perfumeHouse: row.perfumeHouse.trim(),
      openNotes: JSON.stringify(row.openNotes ?? []),
      heartNotes: JSON.stringify(row.heartNotes ?? []),
      baseNotes: JSON.stringify(row.baseNotes ?? []),
      detailURL: row.detailURL?.trim() ?? "",
      noteConfidence: scored.noteConfidence,
      noteWarnings: hasNotes(row) ? [] : ["no_notes_extracted"],
      qualityScore: scored.qualityScore,
      qualityIssues: scored.qualityIssues,
      importBucket: scored.importBucket,
      externalNoteCandidates,
      _noteSource: hasNotes(row) ? "labeled_list" : "empty",
    }
  })
