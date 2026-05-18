"use client"

import { useCallback } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button"
import type { CsvImportReviewRow } from "@/hooks/useCsvImportCommit"
import { useCsvImportCommit } from "@/hooks/useCsvImportCommit"

type CsvImportReviewScreenProps = {
  onBack: () => void
  onComplete: (result: {
    committed: number
    skipped: number
    errors: number
    submittedToCatalog: number
    houseSubmissionsCreated: number
    catalogErrors: number
  }) => void
}

const SectionHeader = ({ title, count }: { title: string; count: number }) => (
  <div className="flex flex-wrap items-baseline gap-2">
    <h3 className="text-noir-gold font-semibold">{title}</h3>
    <span className="text-xs text-noir-gold-100">({count})</span>
  </div>
)

type ConfidentSectionProps = {
  rows: CsvImportReviewRow[]
  decisions: ReturnType<typeof useCsvImportCommit>["decisions"]
  allSelected: boolean
  onToggleAll: (include: boolean) => void
  onToggleRow: (rowIndex: number, include: boolean, perfumeId: string) => void
  t: ReturnType<typeof useTranslations<"myScents.csvImport.review">>
  tColumns: ReturnType<typeof useTranslations<"myScents.csvImport.columns">>
}

const ConfidentSection = ({
  rows,
  decisions,
  allSelected,
  onToggleAll,
  onToggleRow,
  t,
  tColumns,
}: ConfidentSectionProps) => {
  if (rows.length === 0) return null

  return (
    <section className="space-y-3" data-testid="csv-import-review-confident">
      <SectionHeader title={t("confidentSection")} count={rows.length} />
      <label className="flex items-center gap-2 text-sm text-noir-gold cursor-pointer">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={e => onToggleAll(e.target.checked)}
          data-testid="csv-import-review-confirm-all"
        />
        {t("confirmAll")}
      </label>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="border-b border-noir-gold/40 text-noir-gold">
              <th className="py-2 pr-3 w-8" />
              <th className="py-2 pr-3 font-semibold">{tColumns("perfumeName")}</th>
              <th className="py-2 pr-3 font-semibold">{tColumns("house")}</th>
              <th className="py-2 pr-3 font-semibold">{t("matchedAs")}</th>
              <th className="py-2 pr-3 font-semibold">{tColumns("amount")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ rowIndex, parseRow, matched }) => {
              const match = matched.match
              if (!match) return null
              const decision = decisions.get(rowIndex)
              const included = decision && !decision.skip && "perfumeId" in decision
              return (
                <tr
                  key={rowIndex}
                  className="border-b border-noir-gold/20 text-noir-gold-100"
                >
                  <td className="py-2 pr-3">
                    <input
                      type="checkbox"
                      checked={!!included}
                      onChange={e =>
                        onToggleRow(rowIndex, e.target.checked, match.perfumeId)
                      }
                      aria-label={t("includeRow", { name: parseRow.parsed.perfumeName })}
                    />
                  </td>
                  <td className="py-2 pr-3">{parseRow.parsed.perfumeName}</td>
                  <td className="py-2 pr-3">{parseRow.parsed.house || "—"}</td>
                  <td className="py-2 pr-3 text-emerald-200">
                    {match.name}
                    {match.houseName ? ` · ${match.houseName}` : ""}
                  </td>
                  <td className="py-2 pr-3">{parseRow.parsed.amount}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

type UncertainSectionProps = {
  rows: CsvImportReviewRow[]
  decisions: ReturnType<typeof useCsvImportCommit>["decisions"]
  onPick: (rowIndex: number, perfumeId: string | null) => void
  t: ReturnType<typeof useTranslations<"myScents.csvImport.review">>
  tColumns: ReturnType<typeof useTranslations<"myScents.csvImport.columns">>
}

const UncertainSection = ({
  rows,
  decisions,
  onPick,
  t,
  tColumns,
}: UncertainSectionProps) => {
  if (rows.length === 0) return null

  return (
    <section className="space-y-3" data-testid="csv-import-review-uncertain">
      <SectionHeader title={t("uncertainSection")} count={rows.length} />
      <ul className="space-y-4">
        {rows.map(({ rowIndex, parseRow, matched }) => {
          const options = [
            ...(matched.match ? [matched.match] : []),
            ...matched.alternatives,
          ]
          const decision = decisions.get(rowIndex)
          const selectedId =
            decision && !decision.skip && "perfumeId" in decision
              ? decision.perfumeId
              : ""

          return (
            <li
              key={rowIndex}
              className="rounded border border-amber-500/40 bg-amber-950/20 p-3 space-y-2"
            >
              <p className="text-sm text-noir-gold">
                <span className="font-medium">{parseRow.parsed.perfumeName}</span>
                {parseRow.parsed.house ? ` · ${parseRow.parsed.house}` : ""}
                <span className="text-noir-gold-100 ml-2">
                  ({tColumns("amount")}: {parseRow.parsed.amount})
                </span>
              </p>
              <fieldset className="space-y-1">
                <legend className="sr-only">{t("pickMatch")}</legend>
                {options.map(opt => (
                  <label
                    key={opt.perfumeId}
                    className="flex items-center gap-2 text-sm text-noir-gold-100 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name={`uncertain-${rowIndex}`}
                      checked={selectedId === opt.perfumeId}
                      onChange={() => onPick(rowIndex, opt.perfumeId)}
                    />
                    {opt.name}
                    {opt.houseName ? ` · ${opt.houseName}` : ""}
                    <span className="text-xs text-noir-gold-100/70">
                      ({Math.round(opt.similarity * 100)}%)
                    </span>
                  </label>
                ))}
                <label className="flex items-center gap-2 text-sm text-noir-gold-100 cursor-pointer">
                  <input
                    type="radio"
                    name={`uncertain-${rowIndex}`}
                    checked={selectedId === ""}
                    onChange={() => onPick(rowIndex, null)}
                  />
                  {t("noneOfThese")}
                </label>
              </fieldset>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

type NoMatchSectionProps = {
  rows: CsvImportReviewRow[]
  submittableRows: CsvImportReviewRow[]
  decisions: ReturnType<typeof useCsvImportCommit>["decisions"]
  allSelected: boolean
  onToggleAll: (include: boolean) => void
  onToggleRow: (rowIndex: number, include: boolean) => void
  isSubmittable: (row: CsvImportReviewRow) => boolean
  t: ReturnType<typeof useTranslations<"myScents.csvImport.review">>
  tColumns: ReturnType<typeof useTranslations<"myScents.csvImport.columns">>
}

const NoMatchSection = ({
  rows,
  submittableRows,
  decisions,
  allSelected,
  onToggleAll,
  onToggleRow,
  isSubmittable,
  t,
  tColumns,
}: NoMatchSectionProps) => {
  if (rows.length === 0) return null

  return (
    <section className="space-y-3" data-testid="csv-import-review-no-match">
      <SectionHeader title={t("noMatchSection")} count={rows.length} />
      {submittableRows.length > 0 && (
        <label className="flex items-center gap-2 text-sm text-noir-gold cursor-pointer">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={e => onToggleAll(e.target.checked)}
            data-testid="csv-import-review-submit-catalog-all"
          />
          {t("submitCatalogAll")}
        </label>
      )}
      <p className="text-xs text-noir-gold-100 italic">{t("submitCatalogHint")}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="border-b border-noir-gold/40 text-noir-gold">
              <th className="py-2 pr-3 w-8" />
              <th className="py-2 pr-3 font-semibold">{tColumns("perfumeName")}</th>
              <th className="py-2 pr-3 font-semibold">{tColumns("house")}</th>
              <th className="py-2 pr-3 font-semibold">{tColumns("amount")}</th>
              <th className="py-2 pr-3 font-semibold">{tColumns("condition")}</th>
              <th className="py-2 pr-3 font-semibold">{tColumns("tradePreference")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const { rowIndex, parseRow } = row
              const submittable = isSubmittable(row)
              const decision = decisions.get(rowIndex)
              const included =
                submittable &&
                decision &&
                !decision.skip &&
                "submitToCatalog" in decision
              return (
                <tr
                  key={rowIndex}
                  className="border-b border-noir-gold/20 text-noir-gold-100"
                >
                  <td className="py-2 pr-3">
                    {submittable ? (
                      <input
                        type="checkbox"
                        checked={!!included}
                        onChange={e => onToggleRow(rowIndex, e.target.checked)}
                        aria-label={t("submitCatalogRow", {
                          name: parseRow.parsed.perfumeName,
                        })}
                      />
                    ) : (
                      <span className="text-xs text-noir-gold-100/60">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">{parseRow.parsed.perfumeName || "—"}</td>
                  <td className="py-2 pr-3">{parseRow.parsed.house || "—"}</td>
                  <td className="py-2 pr-3">{parseRow.parsed.amount}</td>
                  <td className="py-2 pr-3">{parseRow.parsed.condition ?? "—"}</td>
                  <td className="py-2 pr-3">{parseRow.parsed.tradePreference}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {rows.some(r => !isSubmittable(r)) && (
        <p className="text-xs text-noir-gold-100/80">{t("submitCatalogDisabled")}</p>
      )}
    </section>
  )
}

const getFinalizeLabel = (
  t: ReturnType<typeof useTranslations<"myScents.csvImport.review">>,
  importCount: number,
  catalogSubmitCount: number,
  isCommitting: boolean
): string => {
  if (isCommitting) return t("importing")
  if (importCount > 0 && catalogSubmitCount > 0) {
    return t("finalizeBoth", { importCount, catalogCount: catalogSubmitCount })
  }
  if (catalogSubmitCount > 0) {
    return t("submitCatalog", { count: catalogSubmitCount })
  }
  return t("import", { count: importCount })
}

const CsvImportReviewScreen = ({ onBack, onComplete }: CsvImportReviewScreenProps) => {
  const t = useTranslations("myScents.csvImport.review")
  const tColumns = useTranslations("myScents.csvImport.columns")
  const tRoot = useTranslations("myScents.csvImport")

  const {
    draftError,
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
    finalizeImport,
    isCommitting,
    commitError,
    isNoMatchRowSubmittable,
  } = useCsvImportCommit()

  const handleToggleConfidentRow = useCallback(
    (rowIndex: number, include: boolean, perfumeId: string) => {
      setRowDecision(rowIndex, include ? { skip: false, perfumeId } : { skip: true })
    },
    [setRowDecision]
  )

  const handleUncertainPick = useCallback(
    (rowIndex: number, perfumeId: string | null) => {
      if (perfumeId) {
        setRowDecision(rowIndex, { skip: false, perfumeId })
      } else {
        setRowDecision(rowIndex, { skip: true })
      }
    },
    [setRowDecision]
  )

  const handleToggleCatalogRow = useCallback(
    (rowIndex: number, include: boolean) => {
      setRowDecision(
        rowIndex,
        include ? { skip: false, submitToCatalog: true } : { skip: true }
      )
    },
    [setRowDecision]
  )

  const handleFinalize = useCallback(async () => {
    const outcome = await finalizeImport()
    if (!outcome.success) return
    onComplete({
      committed: outcome.result.committed,
      skipped: outcome.result.skipped,
      errors: outcome.result.commitErrors,
      submittedToCatalog: outcome.result.submittedToCatalog,
      houseSubmissionsCreated: outcome.result.houseSubmissionsCreated,
      catalogErrors: outcome.result.catalogErrors,
    })
  }, [finalizeImport, onComplete])

  if (draftError === "missing") {
    return (
      <div className="space-y-4" data-testid="csv-import-review-draft-missing">
        <div
          className="rounded border border-red-500/60 bg-red-950/40 px-3 py-2 text-sm text-red-200"
          role="alert"
        >
          {t("draftMissing")}
        </div>
        <Button type="button" variant="secondary" onClick={onBack}>
          {t("back")}
        </Button>
      </div>
    )
  }

  const actionCount = importCount + catalogSubmitCount

  return (
    <div className="space-y-6" data-testid="csv-import-review-screen">
      <h2 className="text-noir-gold text-xl">{t("title")}</h2>
      <p className="text-sm text-noir-gold-100 italic">{tRoot("inventoryNotice")}</p>

      <ConfidentSection
        rows={confidentRows}
        decisions={decisions}
        allSelected={allConfidentSelected}
        onToggleAll={setConfidentAll}
        onToggleRow={handleToggleConfidentRow}
        t={t}
        tColumns={tColumns}
      />

      <UncertainSection
        rows={uncertainRows}
        decisions={decisions}
        onPick={handleUncertainPick}
        t={t}
        tColumns={tColumns}
      />

      <NoMatchSection
        rows={noMatchRows}
        submittableRows={submittableNoMatchRows}
        decisions={decisions}
        allSelected={allCatalogSelected}
        onToggleAll={setCatalogSubmitAll}
        onToggleRow={handleToggleCatalogRow}
        isSubmittable={isNoMatchRowSubmittable}
        t={t}
        tColumns={tColumns}
      />

      {commitError && (
        <div
          className="rounded border border-red-500/60 bg-red-950/40 px-3 py-2 text-sm text-red-200"
          role="alert"
        >
          {commitError === "no_rows"
            ? t("noRowsSelected")
            : commitError === "catalog_submit_failed"
              ? t("catalogSubmitError")
              : t("importError", {
                  errors: commitError === "commit_failed" ? 1 : 0,
                })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-noir-gold/30">
        <Button type="button" variant="secondary" onClick={onBack} disabled={isCommitting}>
          {t("back")}
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={actionCount === 0 || isCommitting}
          data-testid="csv-import-commit"
          onClick={() => void handleFinalize()}
        >
          {getFinalizeLabel(t, importCount, catalogSubmitCount, isCommitting)}
        </Button>
      </div>
    </div>
  )
}

export default CsvImportReviewScreen

