/**
 * Allowlisted OpenAI model ids for the admin scraper note pipeline (extraction / noir).
 * Server validates request overrides; client dropdown stays in sync.
 */
export const NOTES_PIPELINE_MODEL_ALLOWLIST = [
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4.1",
  "gpt-4.1-mini",
] as const

export type NotesPipelineModelId = (typeof NOTES_PIPELINE_MODEL_ALLOWLIST)[number]

export const isAllowedNotesPipelineModel = (id: string): id is NotesPipelineModelId =>
  (NOTES_PIPELINE_MODEL_ALLOWLIST as readonly string[]).includes(id)
