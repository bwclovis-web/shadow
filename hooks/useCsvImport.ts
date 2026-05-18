import { useCallback, useState } from "react"

import {
  type CsvMatchedRow,
  type CsvMatchResponseBody,
} from "@/lib/csv-import-match"
import {
  type CsvParseResult,
  parseCsvImportFile,
} from "@/lib/csv-import-user"
import { useCSRF } from "@/hooks/useCSRF"

// Parse + match only; DB writes happen in IMP-253 via POST /api/csv-import/commit.

export const CSV_IMPORT_MATCH_SESSION_KEY = "shadow:csv-import-match-draft"

export type CsvImportMatchDraft = {
  parseResult: CsvParseResult
  matchResult: CsvMatchedRow[]
}

export const useCsvImport = () => {
  const { getTokenWithFallback } = useCSRF()
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null)
  const [matchResult, setMatchResult] = useState<CsvMatchedRow[] | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isMatching, setIsMatching] = useState(false)
  const [matchError, setMatchError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const reset = useCallback(() => {
    setParseResult(null)
    setMatchResult(null)
    setFileName(null)
    setIsParsing(false)
    setIsMatching(false)
    setMatchError(null)
  }, [])

  const parseFile = useCallback(async (file: File) => {
    setIsParsing(true)
    setMatchResult(null)
    setMatchError(null)
    setFileName(file.name)
    try {
      const result = await parseCsvImportFile(file)
      setParseResult(result)
    } finally {
      setIsParsing(false)
    }
  }, [])

  const runMatch = useCallback(async () => {
    if (!parseResult) return
    if (parseResult.headerErrors.length > 0 || parseResult.fileError) return
    if (parseResult.rows.length === 0) return

    setIsMatching(true)
    setMatchError(null)
    try {
      const token = getTokenWithFallback()
      const rows = parseResult.rows.map(row => ({
        rowIndex: row.rowIndex,
        perfumeName: row.parsed.perfumeName,
        house: row.parsed.house,
      }))

      const res = await fetch("/api/csv-import/match", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "x-csrf-token": token } : {}),
        },
        body: JSON.stringify({
          rows,
          ...(token ? { _csrf: token } : {}),
        }),
      })

      const data = (await res.json().catch(() => null)) as
        | CsvMatchResponseBody
        | { success: false; error?: string }
        | null

      if (!res.ok || !data || !("success" in data) || !data.success) {
        setMatchResult(null)
        setMatchError("match_failed")
        return
      }

      setMatchResult(data.matches)
    } catch {
      setMatchResult(null)
      setMatchError("match_failed")
    } finally {
      setIsMatching(false)
    }
  }, [getTokenWithFallback, parseResult])

  const saveMatchDraftForReview = useCallback((): boolean => {
    if (!parseResult || !matchResult) return false
    try {
      const draft: CsvImportMatchDraft = { parseResult, matchResult }
      sessionStorage.setItem(CSV_IMPORT_MATCH_SESSION_KEY, JSON.stringify(draft))
      return true
    } catch {
      return false
    }
  }, [matchResult, parseResult])

  const hasBlockingErrors =
    parseResult !== null &&
    (parseResult.headerErrors.length > 0 || parseResult.fileError !== null)

  const warningCount =
    parseResult?.rows.filter(row => row.parseErrors.length > 0).length ?? 0

  const canProceed =
    parseResult !== null &&
    !hasBlockingErrors &&
    parseResult.rows.length > 0 &&
    matchResult !== null &&
    !isMatching &&
    matchError === null

  return {
    parseResult,
    matchResult,
    isParsing,
    isMatching,
    matchError,
    fileName,
    parseFile,
    runMatch,
    reset,
    saveMatchDraftForReview,
    hasBlockingErrors,
    warningCount,
    canProceed,
  }
}
