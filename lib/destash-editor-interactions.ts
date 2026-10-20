import type { DestashApiResult } from "@/lib/destash-form-payload"

/** Whether close / Escape / backdrop / Open full page must confirm first. */
export const shouldConfirmDiscard = (isDirty: boolean): boolean => isDirty

export type EditSnapshotTransition = "clear" | "keep" | "load"

/**
 * Opening a different listing loads saved values; the same id keeps an in-progress draft.
 * Closing (`listing` null) clears the session.
 */
export const nextEditSnapshotTransition = (
  previousListingId: string | null | undefined,
  nextListingId: string | null | undefined
): EditSnapshotTransition => {
  if (!nextListingId) return "clear"
  if (previousListingId === nextListingId) return "keep"
  return "load"
}

export const isListingPresentInEditorScope = (
  listingId: string,
  activeIds: readonly string[],
  pausedIds: readonly string[]
): boolean => activeIds.includes(listingId) || pausedIds.includes(listingId)

export type DestashEditFailureKind = "gone" | "forbidden" | "generic"

/** Map API failures to rail UX (removed / unauthorized / retry). */
export const classifyDestashEditFailure = (
  result: Pick<DestashApiResult, "status" | "error" | "success" | "ok">
): DestashEditFailureKind => {
  if (result.status === 401 || result.status === 403) return "forbidden"
  if (result.status === 404) return "gone"
  const msg = (result.error ?? "").toLowerCase()
  if (
    msg.includes("not found") ||
    msg.includes("not in your collection") ||
    msg.includes("listing not found")
  ) {
    return "gone"
  }
  return "generic"
}
