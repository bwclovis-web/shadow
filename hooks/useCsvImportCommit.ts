import { useCallback, useEffect, useMemo, useState } from "react"

import type { CsvImportCommitResponseBody } from "@/lib/csv-import-commit"
import type { CsvSubmitCatalogResponseBody } from "@/lib/csv-import-pending-submission"
import type { CsvMatchedRow } from "@/lib/csv-import-match"
import type { CsvImportRow } from "@/lib/csv-import-user"
import {
  CSV_IMPORT_MATCH_SESSION_KEY,
  type CsvImportMatchDraft,
} from "@/hooks/useCsvImport"
import { useCSRF } from "@/hooks/useCSRF"

export type RowDecision =
  | { skip: true }
  | { skip: false; perfumeId: string }
  | { skip: false; submitToCatalog: true }

export type CsvImportReviewRow = {
  rowIndex: number
  parseRow: CsvImportRow
  matched: CsvMatchedRow
}

export type CsvImportFinalizeResult = {
  committed: number
  skipped: number
  commitErrors: number
  submittedToCatalog: number
  houseSubmissionsCreated: number
  catalogErrors: number
}

const isImportDecision = (
  decision: RowDecision | undefined
): decision is { skip: false; perfumeId: string } =>
  !!decision && !decision.skip && "perfumeId" in decision

const isCatalogSubmitDecision = (
  decision: RowDecision | undefined
): decision is { skip: false; submitToCatalog: true } =>
  !!decision && !decision.skip && "submitToCatalog" in decision

const isNoMatchRowSubmittable = (row: CsvImportReviewRow): boolean => {
  const { perfumeName, house } = row.parseRow.parsed
  return (
    row.matched.bucket === "noMatch" &&
    !!perfumeName.trim() &&
    !!house.trim() &&
    row.parseRow.parseErrors.length === 0
  )
}

const loadDraft = (): CsvImportMatchDraft | null => {
  if (typeof sessionStorage === "undefined") return null
  try {
    const raw = sessionStorage.getItem(CSV_IMPORT_MATCH_SESSION_KEY)
    if (!raw) return null
    const draft = JSON.parse(raw) as CsvImportMatchDraft
    if (!draft?.parseResult?.rows || !Array.isArray(draft.matchResult)) {
      return null
    }
    return draft
  } catch {
    return null
  }
}

const buildReviewRows = (draft: CsvImportMatchDraft): CsvImportReviewRow[] => {
  const matchByIndex = new Map(draft.matchResult.map(m => [m.rowIndex, m]))
  return draft.parseResult.rows
    .map(parseRow => {
      const matched = matchByIndex.get(parseRow.rowIndex)
      if (!matched) return null
      return { rowIndex: parseRow.rowIndex, parseRow, matched }
    })
    .filter((r): r is CsvImportReviewRow => r !== null)
}

const initialDecisions = (reviewRows: CsvImportReviewRow[]): Map<number, RowDecision> => {
  const map = new Map<number, RowDecision>()
  for (const { rowIndex, matched } of reviewRows) {
    if (matched.bucket === "confident" && matched.match) {
      map.set(rowIndex, { skip: false, perfumeId: matched.match.perfumeId })
    } else {
      map.set(rowIndex, { skip: true })
    }
  }
  return map
}

export const useCsvImportCommit = () => {
  const { getTokenWithFallback } = useCSRF()
  const [draft, setDraft] = useState<CsvImportMatchDraft | null>(null)
  const [draftError, setDraftError] = useState<"missing" | null>(null)
  const [decisions, setDecisions] = useState<Map<number, RowDecision>>(new Map())
  const [isCommitting, setIsCommitting] = useState(false)
  const [commitError, setCommitError] = useState<string | null>(null)

  useEffect(() => {
    const loaded = loadDraft()
    if (!loaded) {
      setDraftError("missing")
      return
    }
    setDraft(loaded)
    const rows = buildReviewRows(loaded)
    setDecisions(initialDecisions(rows))
  }, [])

  const reviewRows = useMemo(
    () => (draft ? buildReviewRows(draft) : []),
    [draft]
  )

  const confidentRows = useMemo(
    () => reviewRows.filter(r => r.matched.bucket === "confident"),
    [reviewRows]
  )

  const uncertainRows = useMemo(
    () => reviewRows.filter(r => r.matched.bucket === "uncertain"),
    [reviewRows]
  )

  const noMatchRows = useMemo(
    () => reviewRows.filter(r => r.matched.bucket === "noMatch"),
    [reviewRows]
  )

  const submittableNoMatchRows = useMemo(
    () => noMatchRows.filter(isNoMatchRowSubmittable),
    [noMatchRows]
  )

  const importCount = useMemo(() => {
    let count = 0
    for (const decision of decisions.values()) {
      if (isImportDecision(decision)) count++
    }
    return count
  }, [decisions])

  const catalogSubmitCount = useMemo(() => {
    let count = 0
    for (const row of submittableNoMatchRows) {
      const decision = decisions.get(row.rowIndex)
      if (isCatalogSubmitDecision(decision)) count++
    }
    return count
  }, [decisions, submittableNoMatchRows])

  const setRowDecision = useCallback((rowIndex: number, decision: RowDecision) => {
    setDecisions(prev => {
      const next = new Map(prev)
      next.set(rowIndex, decision)
      return next
    })
  }, [])

  const setConfidentAll = useCallback((include: boolean) => {
    setDecisions(prev => {
      const next = new Map(prev)
      for (const row of confidentRows) {
        const match = row.matched.match
        if (!match) continue
        next.set(
          row.rowIndex,
          include ? { skip: false, perfumeId: match.perfumeId } : { skip: true }
        )
      }
      return next
    })
  }, [confidentRows])

  const setCatalogSubmitAll = useCallback((include: boolean) => {
    setDecisions(prev => {
      const next = new Map(prev)
      for (const row of submittableNoMatchRows) {
        next.set(
          row.rowIndex,
          include ? { skip: false, submitToCatalog: true } : { skip: true }
        )
      }
      return next
    })
  }, [submittableNoMatchRows])

  const allConfidentSelected = useMemo(() => {
    if (confidentRows.length === 0) return false
    return confidentRows.every(row => {
      const d = decisions.get(row.rowIndex)
      return isImportDecision(d)
    })
  }, [confidentRows, decisions])

  const allCatalogSelected = useMemo(() => {
    if (submittableNoMatchRows.length === 0) return false
    return submittableNoMatchRows.every(row => {
      const d = decisions.get(row.rowIndex)
      return isCatalogSubmitDecision(d)
    })
  }, [submittableNoMatchRows, decisions])

  const clearDraft = useCallback(() => {
    try {
      sessionStorage.removeItem(CSV_IMPORT_MATCH_SESSION_KEY)
    } catch {
      // ignore
    }
  }, [])

  const commitRows = useCallback(async (): Promise<
    | { success: true; result: CsvImportCommitResponseBody }
    | { success: false; error: string }
    | { success: true; skipped: true }
  > => {
    if (!draft) {
      return { success: false, error: "missing_draft" }
    }

    const rowsToCommit = reviewRows
      .map(({ rowIndex, parseRow }) => {
        const decision = decisions.get(rowIndex)
        if (!isImportDecision(decision)) return null
        return {
          rowIndex,
          perfumeId: decision.perfumeId,
          amount: parseRow.parsed.amount,
          condition: parseRow.parsed.condition,
          tradePreference: parseRow.parsed.tradePreference,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)

    if (rowsToCommit.length === 0) {
      return { success: true, skipped: true }
    }

    const token = getTokenWithFallback()
    const res = await fetch("/api/csv-import/commit", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "x-csrf-token": token } : {}),
      },
      body: JSON.stringify({
        rows: rowsToCommit,
        ...(token ? { _csrf: token } : {}),
      }),
    })

    const data = (await res.json().catch(() => null)) as
      | CsvImportCommitResponseBody
      | { success: false; error?: string }
      | null

    if (!res.ok || !data || !("success" in data) || !data.success) {
      const err =
        data && "error" in data && typeof data.error === "string"
          ? data.error
          : "commit_failed"
      return { success: false, error: err }
    }

    return { success: true, result: data }
  }, [decisions, draft, getTokenWithFallback, reviewRows])

  const submitCatalogRows = useCallback(async (): Promise<
    | { success: true; result: CsvSubmitCatalogResponseBody }
    | { success: false; error: string }
    | { success: true; skipped: true }
  > => {
    const rowsToSubmit = submittableNoMatchRows
      .map(({ rowIndex, parseRow }) => {
        const decision = decisions.get(rowIndex)
        if (!isCatalogSubmitDecision(decision)) return null
        return {
          rowIndex,
          perfumeName: parseRow.parsed.perfumeName,
          house: parseRow.parsed.house,
          amount: parseRow.parsed.amount,
          condition: parseRow.parsed.condition,
          tradePreference: parseRow.parsed.tradePreference,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)

    if (rowsToSubmit.length === 0) {
      return { success: true, skipped: true }
    }

    const token = getTokenWithFallback()
    const res = await fetch("/api/csv-import/submit-catalog", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "x-csrf-token": token } : {}),
      },
      body: JSON.stringify({
        rows: rowsToSubmit,
        ...(token ? { _csrf: token } : {}),
      }),
    })

    const data = (await res.json().catch(() => null)) as
      | CsvSubmitCatalogResponseBody
      | { success: false; error?: string }
      | null

    if (!res.ok || !data || !("success" in data) || !data.success) {
      const err =
        data && "error" in data && typeof data.error === "string"
          ? data.error
          : "catalog_submit_failed"
      return { success: false, error: err }
    }

    return { success: true, result: data }
  }, [decisions, getTokenWithFallback, submittableNoMatchRows])

  const finalizeImport = useCallback(async (): Promise<
    | { success: true; result: CsvImportFinalizeResult }
    | { success: false; error: string }
  > => {
    if (importCount === 0 && catalogSubmitCount === 0) {
      setCommitError("no_rows")
      return { success: false, error: "no_rows" }
    }

    setIsCommitting(true)
    setCommitError(null)

    try {
      let committed = 0
      let skipped = 0
      let commitErrors = 0

      if (importCount > 0) {
        const commitOutcome = await commitRows()
        if (!commitOutcome.success) {
          if ("error" in commitOutcome) {
            setCommitError(commitOutcome.error)
            return { success: false, error: commitOutcome.error }
          }
        } else if (!("skipped" in commitOutcome)) {
          committed = commitOutcome.result.committed
          skipped = commitOutcome.result.skipped
          commitErrors = commitOutcome.result.errors.length
        }
      }

      let submittedToCatalog = 0
      let houseSubmissionsCreated = 0
      let catalogErrors = 0

      if (catalogSubmitCount > 0) {
        const catalogOutcome = await submitCatalogRows()
        if (!catalogOutcome.success) {
          if ("error" in catalogOutcome) {
            setCommitError(catalogOutcome.error)
            return { success: false, error: catalogOutcome.error }
          }
        } else if (!("skipped" in catalogOutcome)) {
          submittedToCatalog = catalogOutcome.result.submitted
          houseSubmissionsCreated = catalogOutcome.result.houseSubmissionsCreated
          catalogErrors = catalogOutcome.result.errors.length
        }
      }

      clearDraft()
      return {
        success: true,
        result: {
          committed,
          skipped,
          commitErrors,
          submittedToCatalog,
          houseSubmissionsCreated,
          catalogErrors,
        },
      }
    } catch {
      setCommitError("commit_failed")
      return { success: false, error: "commit_failed" }
    } finally {
      setIsCommitting(false)
    }
  }, [
    catalogSubmitCount,
    clearDraft,
    commitRows,
    importCount,
    submitCatalogRows,
  ])

  return {
    draft,
    draftError,
    reviewRows,
    confidentRows,
    uncertainRows,
    noMatchRows,
    submittableNoMatchRows,
    decisions,
    importCount,
    catalogSubmitCount,
    allConfidentSelected,
    allCatalogSelected,
    setRowDecision,
    setConfidentAll,
    setCatalogSubmitAll,
    commitRows,
    submitCatalogRows,
    finalizeImport,
    isCommitting,
    commitError,
    clearDraft,
    isNoMatchRowSubmittable,
  }
}
