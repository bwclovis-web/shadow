"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { MdClose, MdWarning } from "react-icons/md"

import { Button } from "@/components/Atoms/Button"
import CsvImportReviewScreen from "@/components/Containers/MyScents/CsvImport/CsvImportReviewScreen"
import {
  CSV_IMPORT_MAX_FILE_BYTES,
  CSV_IMPORT_MAX_ROWS,
  downloadCsvImportTemplate,
  type CsvParseError,
  type CsvParseResult,
} from "@/lib/csv-import-user"
import type { CsvMatchedRow, MatchBucket } from "@/lib/csv-import-match"
import { useCsvImport } from "@/hooks/useCsvImport"

/** Match review step enabled (IMP-252); IMP-253 commit on review screen. */
const CSV_IMPORT_REVIEW_ENABLED = true

type CsvImportStep = "upload" | "review" | "done"

type CsvImportPanelProps = {
  onClose: () => void
  onImportComplete?: () => void
}

type ImportDoneResult = {
  committed: number
  skipped: number
  errors: number
  submittedToCatalog: number
  houseSubmissionsCreated: number
  catalogErrors: number
}

const formatFileSizeKb = (bytes: number): number =>
  Math.round(bytes / 1024)

const bucketBadgeClass: Record<MatchBucket, string> = {
  confident: "border-emerald-500/60 bg-emerald-950/40 text-emerald-200",
  uncertain: "border-amber-500/60 bg-amber-950/40 text-amber-200",
  noMatch: "border-red-500/60 bg-red-950/40 text-red-200",
}

type MatchCellProps = {
  matched: CsvMatchedRow | undefined
  isMatching: boolean
  t: ReturnType<typeof useTranslations<"myScents.csvImport">>
}

const MatchCell = ({ matched, isMatching, t }: MatchCellProps) => {
  if (isMatching && !matched) {
    return <span className="text-xs text-noir-gold-100">{t("matching")}</span>
  }
  if (!matched) {
    return <span className="text-xs text-noir-gold-100">—</span>
  }

  const label =
    matched.bucket === "confident"
      ? t("buckets.confident")
      : matched.bucket === "uncertain"
        ? t("buckets.uncertain")
        : t("buckets.noMatch")

  return (
    <div className="space-y-1">
      <span
        className={`inline-block rounded px-2 py-0.5 text-xs font-medium border ${bucketBadgeClass[matched.bucket]}`}
      >
        {label}
      </span>
      {matched.match && (
        <p className="text-xs text-noir-gold-100 leading-snug">
          {matched.match.name}
          {matched.match.houseName ? ` · ${matched.match.houseName}` : ""}
        </p>
      )}
      {matched.bucket === "uncertain" && matched.alternatives.length > 0 && (
        <p className="text-xs text-noir-gold-100/80">
          {t("possibleMatch", { name: matched.alternatives[0]!.name })}
        </p>
      )}
    </div>
  )
}

type ParseResultViewProps = {
  result: CsvParseResult
  matchByRowIndex: Map<number, CsvMatchedRow>
  isMatching: boolean
  matchError: string | null
  onRetryMatch: () => void
  formatHeaderError: (code: string) => string
  formatHeaderNotice: (code: string) => string
  formatFileError: (code: string | null) => string | null
  formatParseError: (error: CsvParseError) => string
  t: ReturnType<typeof useTranslations<"myScents.csvImport">>
}

const ParseResultView = ({
  result,
  matchByRowIndex,
  isMatching,
  matchError,
  onRetryMatch,
  formatHeaderError,
  formatHeaderNotice,
  formatFileError,
  formatParseError,
  t,
}: ParseResultViewProps) => {
  const fileErrorMessage = formatFileError(result.fileError)
  const readyCount = result.rows.length
  const warnCount = result.rows.filter(row => row.parseErrors.length > 0).length

  const matchCounts = useMemo(() => {
    let confident = 0
    let uncertain = 0
    let noMatch = 0
    for (const row of matchByRowIndex.values()) {
      if (row.bucket === "confident") confident++
      else if (row.bucket === "uncertain") uncertain++
      else noMatch++
    }
    return { confident, uncertain, noMatch }
  }, [matchByRowIndex])

  const showMatchSummary = matchByRowIndex.size > 0

  return (
    <div className="space-y-3">
      {fileErrorMessage && (
        <div
          className="rounded border border-red-500/60 bg-red-950/40 px-3 py-2 text-sm text-red-200"
          role="alert"
        >
          {fileErrorMessage}
        </div>
      )}

      {result.headerNotices.length > 0 && (
        <ul className="space-y-1 text-sm text-noir-gold-100" role="status">
          {result.headerNotices.map(notice => (
            <li key={notice}>{formatHeaderNotice(notice)}</li>
          ))}
        </ul>
      )}

      {result.headerErrors.length > 0 && (
        <div
          className="rounded border border-red-500/60 bg-red-950/40 px-3 py-2 text-sm text-red-200"
          role="alert"
        >
          <ul className="list-disc list-inside space-y-1">
            {result.headerErrors.map(err => (
              <li key={err}>{formatHeaderError(err)}</li>
            ))}
          </ul>
        </div>
      )}

      {result.truncatedFrom !== null && (
        <p className="text-sm text-noir-gold-100" role="status">
          {t("truncated", {
            shown: CSV_IMPORT_MAX_ROWS,
            total: result.truncatedFrom,
          })}
        </p>
      )}

      {isMatching && (
        <p className="text-sm text-noir-gold-100" role="status" data-testid="csv-import-matching">
          {t("matching")}
        </p>
      )}

      {matchError && (
        <div
          className="flex flex-wrap items-center gap-3 rounded border border-red-500/60 bg-red-950/40 px-3 py-2 text-sm text-red-200"
          role="alert"
        >
          <span>{t("matchError")}</span>
          <Button type="button" variant="secondary" size="sm" onClick={onRetryMatch}>
            {t("retryMatch")}
          </Button>
        </div>
      )}

      {readyCount === 0 && !fileErrorMessage && result.headerErrors.length === 0 && (
        <p className="text-sm text-noir-gold-100">{t("noDataRows")}</p>
      )}

      {readyCount > 0 && result.headerErrors.length === 0 && !fileErrorMessage && (
        <>
          <p className="text-sm text-noir-gold">
            {t("summary", { ready: readyCount, warnings: warnCount })}
          </p>
          {showMatchSummary && (
            <p className="text-sm text-noir-gold-100" data-testid="csv-import-match-summary">
              {t("matchSummary", matchCounts)}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-noir-gold/40 text-noir-gold">
                  <th className="py-2 pr-3 font-semibold">#</th>
                  <th className="py-2 pr-3 font-semibold">{t("columns.perfumeName")}</th>
                  <th className="py-2 pr-3 font-semibold">{t("columns.house")}</th>
                  <th className="py-2 pr-3 font-semibold">{t("columns.amount")}</th>
                  <th className="py-2 pr-3 font-semibold">{t("columns.condition")}</th>
                  <th className="py-2 pr-3 font-semibold">{t("columns.tradePreference")}</th>
                  <th className="py-2 pr-3 font-semibold">{t("columns.match")}</th>
                  <th className="py-2 font-semibold">{t("columns.warnings")}</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map(row => (
                  <tr
                    key={row.rowIndex}
                    className="border-b border-noir-gold/20 text-noir-gold-100"
                  >
                    <td className="py-2 pr-3">{row.rowIndex}</td>
                    <td className="py-2 pr-3">{row.parsed.perfumeName || "—"}</td>
                    <td className="py-2 pr-3">{row.parsed.house || "—"}</td>
                    <td className="py-2 pr-3">{row.parsed.amount}</td>
                    <td className="py-2 pr-3">{row.parsed.condition ?? "—"}</td>
                    <td className="py-2 pr-3">{row.parsed.tradePreference}</td>
                    <td className="py-2 pr-3 min-w-[10rem]">
                      <MatchCell
                        matched={matchByRowIndex.get(row.rowIndex)}
                        isMatching={isMatching}
                        t={t}
                      />
                    </td>
                    <td className="py-2">
                      {row.parseErrors.length > 0 ? (
                        <span
                          className="inline-flex items-start gap-1 text-amber-300"
                          title={row.parseErrors.map(formatParseError).join("; ")}
                        >
                          <MdWarning size={16} className="shrink-0 mt-0.5" aria-hidden />
                          <span className="text-xs">
                            {row.parseErrors.map(formatParseError).join("; ")}
                          </span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

const CsvImportPanel = ({ onClose, onImportComplete }: CsvImportPanelProps) => {
  const t = useTranslations("myScents.csvImport")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const autoMatchStartedRef = useRef(false)
  const [step, setStep] = useState<CsvImportStep>("upload")
  const [importDoneResult, setImportDoneResult] = useState<ImportDoneResult | null>(
    null
  )
  const {
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
    canProceed,
  } = useCsvImport()

  const matchByRowIndex = useMemo(() => {
    const map = new Map<number, CsvMatchedRow>()
    if (!matchResult) return map
    for (const row of matchResult) {
      map.set(row.rowIndex, row)
    }
    return map
  }, [matchResult])

  const shouldAutoMatch =
    parseResult !== null &&
    !hasBlockingErrors &&
    parseResult.rows.length > 0 &&
    matchResult === null &&
    !isMatching &&
    matchError === null

  useEffect(() => {
    if (!shouldAutoMatch) {
      if (!parseResult) autoMatchStartedRef.current = false
      return
    }
    if (autoMatchStartedRef.current) return
    autoMatchStartedRef.current = true
    void runMatch()
  }, [shouldAutoMatch, runMatch, parseResult])

  const handleClose = useCallback(() => {
    reset()
    setStep("upload")
    setImportDoneResult(null)
    onClose()
  }, [onClose, reset])

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      autoMatchStartedRef.current = false
      setStep("upload")
      setImportDoneResult(null)
      void parseFile(file)
      event.target.value = ""
    },
    [parseFile]
  )

  const handleRetryMatch = useCallback(() => {
    autoMatchStartedRef.current = true
    void runMatch()
  }, [runMatch])

  const handleNextReview = useCallback(() => {
    if (!canProceed) return
    const saved = saveMatchDraftForReview()
    if (saved) {
      setStep("review")
    }
  }, [canProceed, saveMatchDraftForReview])

  const handleBackToUpload = useCallback(() => {
    setStep("upload")
  }, [])

  const handleReviewComplete = useCallback(
    (result: ImportDoneResult) => {
      setImportDoneResult(result)
      setStep("done")
      onImportComplete?.()
    },
    [onImportComplete]
  )

  const formatParseError = useCallback(
    (error: CsvParseError): string => {
      if (error.key === "duplicate_row" && error.params?.row !== undefined) {
        return t("errors.duplicateRow", { row: error.params.row })
      }
      return t(`errors.${error.key}`)
    },
    [t]
  )

  const formatHeaderError = useCallback(
    (code: string): string => {
      if (code === "no_rows") return t("headerErrors.noRows")
      if (code.startsWith("missing_headers:")) {
        const cols = code.replace("missing_headers:", "")
        return t("headerErrors.missingHeaders", { columns: cols })
      }
      return code
    },
    [t]
  )

  const formatHeaderNotice = useCallback(
    (code: string): string => {
      if (code === "semicolon_delimiter") return t("notices.semicolonDelimiter")
      if (code === "ml_remaining_column") return t("notices.mlRemainingColumn")
      return code
    },
    [t]
  )

  const formatFileError = useCallback(
    (code: string | null): string | null => {
      if (!code) return null
      if (code === "file_too_large") {
        return t("fileErrors.tooLarge", {
          maxKb: formatFileSizeKb(CSV_IMPORT_MAX_FILE_BYTES),
        })
      }
      if (code === "read_failed") return t("fileErrors.readFailed")
      return code
    },
    [t]
  )

  const nextDisabledHint = !CSV_IMPORT_REVIEW_ENABLED
    ? t("nextDisabledHintReview")
    : isMatching
      ? t("nextDisabledHintMatching")
      : matchError
        ? t("nextDisabledHintMatchError")
        : !matchResult
          ? t("nextDisabledHintMatching")
          : undefined

  return (
    <section
      className="inner-container mx-auto my-6 noir-border p-4 md:p-6 space-y-4"
      aria-labelledby="csv-import-heading"
      data-testid="csv-import-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="csv-import-heading" className="text-noir-gold text-xl">
            {step === "review"
              ? t("review.title")
              : step === "done"
                ? t("review.doneTitle")
                : t("title")}
          </h2>
          {step === "upload" && (
            <>
              <p className="text-noir-gold-100 text-sm mt-1">{t("description")}</p>
              <p className="text-noir-gold-100 text-xs mt-2 italic">{t("inventoryNotice")}</p>
            </>
          )}
        </div>
        <Button
          type="button"
          variant="icon"
          size="sm"
          onClick={handleClose}
          disabled={isParsing || isMatching}
          aria-label={t("closePanel")}
        >
          <MdClose size={22} />
        </Button>
      </div>

      {step === "upload" && (
        <>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={downloadCsvImportTemplate}>
          {t("downloadTemplate")}
        </Button>
        <label className="inline-flex">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={handleFileChange}
            disabled={isParsing || isMatching}
            data-testid="csv-import-file-input"
          />
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={isParsing || isMatching}
            onClick={() => fileInputRef.current?.click()}
          >
            {isParsing ? t("parsing") : t("chooseFile")}
          </Button>
        </label>
        {fileName && (
          <span className="text-sm text-noir-gold-100 truncate max-w-xs">{fileName}</span>
        )}
      </div>

      <p className="text-xs text-noir-gold-100">
        {t("limitsHint", {
          maxKb: formatFileSizeKb(CSV_IMPORT_MAX_FILE_BYTES),
          maxRows: CSV_IMPORT_MAX_ROWS,
        })}
      </p>

      {parseResult && (
        <ParseResultView
          result={parseResult}
          matchByRowIndex={matchByRowIndex}
          isMatching={isMatching}
          matchError={matchError}
          onRetryMatch={handleRetryMatch}
          formatHeaderError={formatHeaderError}
          formatHeaderNotice={formatHeaderNotice}
          formatFileError={formatFileError}
          formatParseError={formatParseError}
          t={t}
        />
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-noir-gold/30">
        <Button
          type="button"
          variant="primary"
          disabled={!canProceed || !CSV_IMPORT_REVIEW_ENABLED}
          title={!canProceed || !CSV_IMPORT_REVIEW_ENABLED ? nextDisabledHint : undefined}
          data-testid="csv-import-next"
          onClick={handleNextReview}
        >
          {t("nextReview")}
        </Button>
      </div>
        </>
      )}

      {step === "review" && (
        <CsvImportReviewScreen
          onBack={handleBackToUpload}
          onComplete={handleReviewComplete}
        />
      )}

      {step === "done" && importDoneResult && (
        <div className="space-y-4" data-testid="csv-import-done">
          <p className="text-sm text-emerald-300" role="status">
            {t("review.done", {
              committed: importDoneResult.committed,
              skipped: importDoneResult.skipped,
            })}
          </p>
          {importDoneResult.submittedToCatalog > 0 && (
            <p className="text-sm text-noir-gold-100" role="status">
              {t("review.doneCatalog", {
                count: importDoneResult.submittedToCatalog,
                houses: importDoneResult.houseSubmissionsCreated,
              })}
            </p>
          )}
          {importDoneResult.errors > 0 && (
            <p className="text-sm text-red-200" role="alert">
              {t("review.importError", { errors: importDoneResult.errors })}
            </p>
          )}
          {importDoneResult.catalogErrors > 0 && (
            <p className="text-sm text-red-200" role="alert">
              {t("review.catalogSubmitErrorCount", {
                errors: importDoneResult.catalogErrors,
              })}
            </p>
          )}
          {importDoneResult.skipped > 0 && (
            <p className="text-xs text-noir-gold-100">{t("review.duplicateSkipped")}</p>
          )}
          <Button type="button" variant="primary" onClick={handleClose}>
            {t("closePanel")}
          </Button>
        </div>
      )}
    </section>
  )
}

export default CsvImportPanel
