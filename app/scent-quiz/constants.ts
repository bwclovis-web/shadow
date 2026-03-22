export const SCENT_QUIZ_ROUTE = "/scent-quiz" as const

export const MIN_NOTE_SELECTIONS = 3
export const MAX_NOTE_SELECTIONS = 7

export const STEPS = [
  "welcome",
  "note-preferences",
  "avoid-notes",
  "season",
  "browsing-style",
] as const

export type StepId = (typeof STEPS)[number]

export const Q = {
  step: "step",
  noteIds: "noteIds",
  avoidNoteIds: "avoidNoteIds",
  season: "season",
  browsingStyle: "browsingStyle",
} as const

export const VALID_SEASONS = ["spring", "summer", "fall", "winter"] as const
export type SeasonId = (typeof VALID_SEASONS)[number]

export function parseStep(value: string | null): StepId {
  if (value && (STEPS as readonly string[]).includes(value)) return value as StepId
  return "welcome"
}
